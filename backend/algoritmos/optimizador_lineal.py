# Archivo: backend/algoritmos/optimizador_lineal.py
"""
Optimización por PROGRAMACIÓN LINEAL — Modelo de Transporte con Transbordo.

El producto no viaja directo de las estaciones a los supermercados: primero
pasa por centros de acopio (transbordo). Además, un acopio puede reenviar
producto a otro acopio (transbordo multi-escalón), de modo que la cadena real
es:  Estación → Acopio → … → Acopio → Supermercado.

El modelo decide cuántas toneladas enviar por cada ruta para MAXIMIZAR la
ganancia (equivalente a cubrir la mayor demanda posible al MENOR costo de
transporte), respetando oferta, capacidad de acopio, demanda y la regla de que
todo pase por al menos un acopio (no se permite estación → supermercado directo).

────────────────────────────────────────────────────────────────────────────
Formulación (Programación Lineal — flujo en red con transbordo):

  Variable de decisión
    f[u,v] = toneladas enviadas por la ruta u → v

  Función objetivo  (maximizar ganancia neta)
    max  Σ_d (precio_d + P) · recibido_d  −  Σ_(u,v) costo_uv · f[u,v]
                                           −  Σ Pcal · (salida de acopios malos)
    donde recibido_d = lo que llega al supermercado d, P prioriza cubrir la
    demanda y Pcal penaliza usar acopios con calidad bajo el umbral.
    Minimizar el costo de transporte está embebido en los términos negativos.

  Restricciones
    (1) Oferta:      salida(o) − entrada(o) ≤ oferta_o        ∀ estación o
    (2) Acopio:      entrada(a) ≤ capacidad_a                 ∀ acopio a
    (3) Demanda:     entrada(d) − salida(d) ≤ demanda_d       ∀ supermercado d
    (4) Transbordo:  entrada(a) = salida(a)                   ∀ acopio a
                     (lo que entra a un acopio vuelve a salir — conservación)
    (5) Capacidad de ruta y no negatividad:
            0 ≤ f[u,v] ≤ cap_uv
            Para rutas que SALEN de un acopio, cap_uv = capacidad · (1 − merma):
            la merma reduce lo que el acopio puede despachar.
    (6) Cadena obligatoria: se ignoran las rutas directas estación→supermercado.

Se resuelve con PuLP (solver CBC), un solver exacto de programación lineal.
La merma se modela como reducción de la capacidad de salida del acopio para
mantener la conservación de flujo (entrada = salida), coherente con el resto
del sistema y con el validador de restricciones.
"""

from typing import Dict, Tuple

import pulp

import config
from algoritmos.resultado import construir_resultado
from models.grafo import GrafoRed
from models.nodo import TipoNodo
from utils.logger import get_logger

logger = get_logger(__name__)


class OptimizadorLineal:
    """Modelo de transporte con transbordo (multi-escalón) por Programación Lineal."""

    def __init__(self, grafo: GrafoRed) -> None:
        self.grafo = grafo
        self.origenes = grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)
        self.acopios = grafo.obtener_nodos_por_tipo(TipoNodo.ACOPIO)
        self.destinos = grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)

        self.acopios_penalizados = [
            a.id for a in self.acopios if a.tasa_calidad < config.UMBRAL_CALIDAD
        ]
        self._set_penalizados = set(self.acopios_penalizados)

        self._ids_origen = {o.id for o in self.origenes}
        self._ids_acopio = {a.id for a in self.acopios}
        self._ids_destino = {d.id for d in self.destinos}

        # Rutas válidas (todas menos las directas estación → supermercado) y su
        # capacidad efectiva (reducida por la merma del acopio que despacha).
        self.aristas: list[Tuple[str, str]] = []
        self.cap: Dict[Tuple[str, str], float] = {}
        merma = {a.id: float(a.tasa_merma) for a in self.acopios}
        for (u, v), arista in self.grafo.aristas.items():
            if u in self._ids_origen and v in self._ids_destino:
                logger.warning(
                    f"Ruta directa Estación→Supermercado ignorada (debe pasar por "
                    f"un acopio): {u}→{v}."
                )
                continue
            capacidad = float(arista.capacidad)
            if u in self._ids_acopio:
                capacidad *= max(0.0, 1.0 - merma.get(u, 0.0))
            self.aristas.append((u, v))
            self.cap[(u, v)] = max(0.0, capacidad)

        # Contadores informativos por tipo de tramo.
        self.num_oa = sum(1 for (u, v) in self.aristas if u in self._ids_origen and v in self._ids_acopio)
        self.num_aa = sum(1 for (u, v) in self.aristas if u in self._ids_acopio and v in self._ids_acopio)
        self.num_ad = sum(1 for (u, v) in self.aristas if u in self._ids_acopio and v in self._ids_destino)

    def _salidas(self, nodo_id: str):
        return [(u, v) for (u, v) in self.aristas if u == nodo_id]

    def _entradas(self, nodo_id: str):
        return [(u, v) for (u, v) in self.aristas if v == nodo_id]

    def ejecutar(self) -> dict:
        if not self.aristas:
            logger.warning("PL: la red no tiene rutas válidas.")
            for arista in self.grafo.aristas.values():
                arista.flujo_actual = 0.0
            return construir_resultado(
                self.grafo, self.acopios_penalizados,
                algoritmo="Programación Lineal (Transbordo)",
                extra={"estado_lp": "Sin rutas válidas", "num_variables": 0,
                       "num_restricciones": 0},
            )

        precio = {
            d.id: (d.precio_venta if getattr(d, "precio_venta", 0.0) > 0 else config.PRECIO_VENTA_TON)
            for d in self.destinos
        }
        P = config.PENALIZACION_INCUMPLIMIENTO   # prioriza cubrir la demanda
        Pcal = config.PENALIZACION_CALIDAD       # desincentiva acopios malos

        prob = pulp.LpProblem("Transporte_con_Transbordo", pulp.LpMaximize)

        # Variable f[u,v] por cada ruta válida.
        f = {
            (u, v): pulp.LpVariable(f"f_{u}_{v}", lowBound=0, upBound=self.cap[(u, v)])
            for (u, v) in self.aristas
        }

        # ── Función objetivo: maximizar ganancia neta ─────────────────────────
        terminos = []
        # Ingreso (con prioridad de cobertura) por lo que recibe cada supermercado.
        for d in self.destinos:
            recibido = pulp.lpSum(f[e] for e in self._entradas(d.id)) \
                - pulp.lpSum(f[e] for e in self._salidas(d.id))
            terminos.append((precio[d.id] + P) * recibido)
        # Costo de transporte de cada ruta usada.
        for (u, v) in self.aristas:
            terminos.append(-float(self.grafo.aristas[(u, v)].costo_transporte) * f[(u, v)])
        # Penalización suave por despachar desde acopios de baja calidad.
        for (u, v) in self.aristas:
            if u in self._set_penalizados:
                terminos.append(-Pcal * f[(u, v)])
        prob += pulp.lpSum(terminos), "Ganancia_neta"

        # ── Restricciones ─────────────────────────────────────────────────────
        # (1) Oferta: salida neta de cada estación ≤ su oferta.
        for o in self.origenes:
            sale = pulp.lpSum(f[e] for e in self._salidas(o.id))
            entra = pulp.lpSum(f[e] for e in self._entradas(o.id))
            prob += (sale - entra) <= float(o.oferta), f"oferta_{o.id}"

        # (2) Capacidad de acopio y (4) transbordo (conservación).
        for a in self.acopios:
            entra = pulp.lpSum(f[e] for e in self._entradas(a.id))
            sale = pulp.lpSum(f[e] for e in self._salidas(a.id))
            prob += entra <= float(a.capacidad), f"cap_acopio_{a.id}"
            prob += entra == sale, f"transbordo_{a.id}"

        # (3) Demanda: entrada neta de cada supermercado ≤ su demanda.
        for d in self.destinos:
            entra = pulp.lpSum(f[e] for e in self._entradas(d.id))
            sale = pulp.lpSum(f[e] for e in self._salidas(d.id))
            prob += (entra - sale) <= float(d.demanda), f"demanda_{d.id}"

        # ── Resolver ──────────────────────────────────────────────────────────
        prob.solve(pulp.PULP_CBC_CMD(msg=0))
        estado_lp = pulp.LpStatus[prob.status]

        # Volcar la solución sobre las aristas de la red real.
        for arista in self.grafo.aristas.values():
            arista.flujo_actual = 0.0
        for (u, v), var in f.items():
            self.grafo.aristas[(u, v)].flujo_actual = max(0.0, float(var.value() or 0.0))

        resultado = construir_resultado(
            self.grafo,
            self.acopios_penalizados,
            algoritmo="Programación Lineal (Transbordo)",
            extra={
                "estado_lp": estado_lp,
                "valor_objetivo": round(float(pulp.value(prob.objective) or 0.0), 4),
                "num_variables": len(f),
                "num_restricciones": len(prob.constraints),
                "num_rutas_oa": self.num_oa,
                "num_rutas_aa": self.num_aa,
                "num_rutas_ad": self.num_ad,
                "modelo": "Transporte con transbordo multi-escalón (Estación → Acopio → … → Supermercado)",
            },
        )

        logger.info(
            f"Optimización por PL: estado={estado_lp}, "
            f"{resultado['num_rutas_activas']} rutas activas, "
            f"costo={resultado['costo_minimo']:.2f}, ganancia={resultado['ganancia']:.2f}, "
            f"variables={len(f)}, restricciones={len(prob.constraints)} "
            f"(O→A={self.num_oa}, A→A={self.num_aa}, A→D={self.num_ad})"
        )

        return resultado
