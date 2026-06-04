"""
Optimizacion por flujo de minimo costo sobre el grafo logistico generado.

La red en memoria ya contiene aristas validas Origen->Acopio y Acopio->Destino.
Este optimizador agrega super-fuente/super-sumidero y parte los centros de
acopio en dos nodos internos para limitar su capacidad total de proceso.
"""

import networkx as nx

import config
from algoritmos.resultado import construir_resultado
from models.grafo import GrafoRed
from models.nodo import TipoNodo
from utils.logger import get_logger


logger = get_logger(__name__)

# Factor para convertir costos ($/ton, flotante) a enteros.
ESCALA_COSTO = 100


class OptimizadorGrafo:
    """Asigna flujos optimos usando max_flow_min_cost de NetworkX."""

    def __init__(self, grafo: GrafoRed) -> None:
        self.grafo = grafo
        self.origenes = grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)
        self.acopios = grafo.obtener_nodos_por_tipo(TipoNodo.ACOPIO)
        self.destinos = grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)
        self.acopios_penalizados: list = []

    def _es_acopio(self, nodo_id: str) -> bool:
        nodo = self.grafo.obtener_nodo(nodo_id)
        return bool(nodo and nodo.tipo == TipoNodo.ACOPIO)

    def _entrada(self, nodo_id: str) -> str:
        return f"{nodo_id}__in" if self._es_acopio(nodo_id) else nodo_id

    def _salida(self, nodo_id: str) -> str:
        return f"{nodo_id}__out" if self._es_acopio(nodo_id) else nodo_id

    @staticmethod
    def _capacidad_entera(valor: float) -> int:
        return max(int(round(valor)), 0)

    @staticmethod
    def _peso_entero(costo: float) -> int:
        return max(int(round(costo * ESCALA_COSTO)), 0)

    def _construir_red(self) -> nx.DiGraph:
        """Construye la red temporal con acopios partidos."""
        G = nx.DiGraph()
        G.add_node("__S__")
        G.add_node("__T__")

        ids_origen = {o.id for o in self.origenes}
        ids_destino = {d.id for d in self.destinos}

        for origen in self.origenes:
            G.add_edge(
                "__S__",
                origen.id,
                capacity=self._capacidad_entera(origen.oferta),
                weight=0,
            )

        for destino in self.destinos:
            G.add_edge(
                destino.id,
                "__T__",
                capacity=self._capacidad_entera(destino.demanda),
                weight=0,
            )

        for acopio in self.acopios:
            capacidad_promedio = max(acopio.capacidad * 0.5, 1.0)
            costo_op_por_ton = acopio.costo_operacion / capacidad_promedio
            G.add_edge(
                self._entrada(acopio.id),
                self._salida(acopio.id),
                capacity=self._capacidad_entera(acopio.capacidad),
                weight=self._peso_entero(costo_op_por_ton),
            )

        self.acopios_penalizados = [
            a.id for a in self.acopios if a.tasa_calidad < config.UMBRAL_CALIDAD
        ]
        set_penalizados = set(self.acopios_penalizados)

        for (u, v), arista in self.grafo.aristas.items():
            if u in ids_origen and v in ids_destino:
                logger.warning(
                    "Arista directa Origen->Destino omitida del optimizador: "
                    f"{u}->{v}. La cadena obligatoria es Origen->Acopio->Destino."
                )
                continue

            nodo_u = self.grafo.obtener_nodo(u)
            costo_unitario = arista.costo_total_unitario
            capacidad = float(arista.capacidad)

            if nodo_u is not None and nodo_u.tipo == TipoNodo.ACOPIO:
                factor_merma = max(0.0, 1.0 - nodo_u.tasa_merma)
                capacidad *= factor_merma

            if u in set_penalizados:
                costo_unitario += config.PENALIZACION_CALIDAD

            G.add_edge(
                self._salida(u),
                self._entrada(v),
                capacity=self._capacidad_entera(capacidad),
                weight=self._peso_entero(costo_unitario),
            )

        return G

    def _flujo_arista_original(self, flujo_dict: dict, u: str, v: str) -> float:
        return float(
            flujo_dict.get(self._salida(u), {}).get(self._entrada(v), 0.0)
        )

    def ejecutar(self) -> dict:
        G = self._construir_red()
        flujo_dict: dict = {}
        costo_objetivo = 0.0

        try:
            flujo_dict = nx.max_flow_min_cost(
                G, "__S__", "__T__", capacity="capacity", weight="weight"
            )
            costo_objetivo = nx.cost_of_flow(G, flujo_dict, weight="weight") / ESCALA_COSTO
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"max_flow_min_cost fallo ({e}), usando maximum_flow como fallback"
            )
            try:
                _, flujo_dict = nx.maximum_flow(G, "__S__", "__T__", capacity="capacity")
            except Exception:
                flujo_dict = {}

        rutas_activas = []
        flujos_optimos: Dict[str, float] = {}
        costo_total = 0.0

        for (u, v), arista in self.grafo.aristas.items():
            flujo = float(flujo_dict.get(u, {}).get(v, 0.0))
            arista.flujo_actual = max(0.0, flujo)

            if flujo > 1e-6:
                flujos_optimos[f"{u}→{v}"] = round(flujo, 4)
                # Costo ajustado por el estado de la vía (costo base * multiplicador).
                costo_total += flujo * arista.costo_total_unitario
                rutas_activas.append({
                    "origen": u,
                    "destino": v,
                    "flujo": round(flujo, 4),
                    "costo": round(arista.costo_base, 4),
                    "costo_total": round(arista.costo_total_unitario, 4),
                    "capacidad": arista.capacidad,
                    "utilizacion": round(arista.utilizacion, 4),
                })

        # Cambio 2: merma total estimada por el producto que pasa por acopios.
        merma_total_estimada = 0.0
        for (u, v), arista in self.grafo.aristas.items():
            nodo_u = self.grafo.obtener_nodo(u)
            if (
                nodo_u is not None
                and nodo_u.tipo == TipoNodo.ACOPIO
                and arista.flujo_actual > 1e-6
            ):
                merma_total_estimada += arista.flujo_actual * nodo_u.tasa_merma

        # Cambio 3: costo de operación de los acopios activos (con flujo entrante).
        costo_operacion_total = 0.0
        acopios_activos = []
        for acopio in self.acopios:
            flujo_entrante = sum(
                self.grafo.obtener_arista(u, acopio.id).flujo_actual
                for u in self.grafo.vecinos_entrada(acopio.id)
                if self.grafo.obtener_arista(u, acopio.id)
            )
            if flujo_entrante > 1e-6:
                costo_operacion_total += acopio.costo_operacion
                acopios_activos.append(acopio.id)

        ganancia = self._calcular_ganancia(costo_operacion_total)

        logger.info(
            f"Optimización por grafos: {len(rutas_activas)} rutas activas, "
            f"costo={costo_total:.2f}, ganancia={ganancia:.2f}, "
            f"acopios_penalizados={self.acopios_penalizados}"
        )

        return {
            "exito": True,
            "ganancia": round(ganancia, 4),
            "costo_minimo": round(costo_total, 4),
            "flujos": flujos_optimos,
            "stocks": {},
            "num_rutas_activas": len(rutas_activas),
            "num_rutas_total": len(self.grafo.aristas),
            "rutas_activas": rutas_activas,
            # Cambios 1-3 y 5: trazabilidad de los ajustes del optimizador.
            "acopios_penalizados": self.acopios_penalizados,
            "merma_total_estimada": round(merma_total_estimada, 4),
            "costo_operacion_acopios": round(costo_operacion_total, 4),
            "acopios_activos": acopios_activos,
            "cadena_valida": True,
            "restriccion": "Origen → Acopio → Destino (obligatorio)",
        }

    def _calcular_ganancia(self, costo_operacion_total: float = 0.0) -> float:
        """Ingreso por demanda cubierta − costo de transporte − costo de
        operación de acopios − penalización por demanda no satisfecha.
        Usa los flujos ya asignados en el grafo.

        Cambio 4a: el ingreso usa el precio_venta individual de cada destino
        (cae al precio global solo si el nodo no define uno positivo).
        Cambio 3B: descuenta el costo de operación de los acopios activos.
        """
        ingreso = 0.0
        penalizacion = 0.0

        for destino in self.destinos:
            recibido = sum(
                self.grafo.obtener_arista(u, destino.id).flujo_actual
                for u in self.grafo.vecinos_entrada(destino.id)
            )
            cubierto = min(recibido, destino.demanda)
            precio = (
                destino.precio_venta
                if getattr(destino, "precio_venta", 0.0) > 0
                else config.PRECIO_VENTA_TON
            )
            ingreso += cubierto * precio
            penalizacion += max(0.0, destino.demanda - recibido) * config.PENALIZACION_INCUMPLIMIENTO

        costo = sum(a.flujo_actual * a.costo_transporte for a in self.grafo.aristas.values())

        return ingreso - costo - costo_operacion_total - penalizacion
