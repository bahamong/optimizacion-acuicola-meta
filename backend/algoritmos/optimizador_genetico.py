# Archivo: backend/algoritmos/optimizador_genetico.py
"""
Optimización por Algoritmo Genético (metaheurística).

Resuelve el MISMO problema que el optimizador por grafos —asignar los flujos
x_ij que maximizan la ganancia respetando oferta, demanda y capacidad sobre la
cadena Origen → Acopio → Destino— pero usando un algoritmo genético en lugar
del flujo de mínimo costo exacto.

Diseño del algoritmo
────────────────────
Codificación basada en PRIORIDADES de caminos (decodificador siempre factible):

  • Un "camino" es una cadena válida O → A → D (existen las aristas O→A y A→D).
  • El cromosoma es un vector de claves reales en [0, 1], una por camino: la
    "prioridad" con la que ese camino se llena.
  • El decodificador ordena los caminos por prioridad descendente y asigna a cada
    uno el máximo flujo posible que aún permitan la oferta del origen, la demanda
    del destino y las capacidades de las dos aristas. Así CUALQUIER cromosoma se
    traduce en una solución factible (nunca viola restricciones), y el AG solo
    necesita explorar el orden/prioridad de llenado.

La función de aptitud (fitness) es la ganancia real del negocio
(ingreso − costo de transporte − costo de operación de acopios − penalización
por demanda incumplida), con una penalización suave por usar acopios de baja
calidad, coherente con la lógica del optimizador por grafos.

Operadores genéticos clásicos: selección por torneo, cruce aritmético (blend),
mutación gaussiana y elitismo.
"""

import random
from dataclasses import dataclass
from typing import Dict, List, Tuple

import networkx as nx

import config
from algoritmos.resultado import construir_resultado
from models.grafo import GrafoRed
from models.nodo import TipoNodo
from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class Camino:
    """Cadena factible Origen → Acopio → Destino con sus dos aristas."""
    origen: str
    acopio: str
    destino: str
    arista_oa: Tuple[str, str]   # clave (origen, acopio)
    arista_ad: Tuple[str, str]   # clave (acopio, destino)
    # Costo unitario "de dirección" usado solo para inicializar la población
    # con buenas semillas (no es el costo real reportado).
    costo_guia: float


class OptimizadorGenetico:
    """Asigna flujos óptimos sobre la cadena O→A→D mediante un Algoritmo Genético."""

    def __init__(
        self,
        grafo: GrafoRed,
        tam_poblacion: int = 120,
        generaciones: int = 250,
        prob_cruce: float = 0.85,
        prob_mutacion: float = 0.20,
        fraccion_elite: float = 0.10,
        tam_torneo: int = 3,
        paciencia: int = 60,
        semilla: int | None = 42,
    ) -> None:
        self.grafo = grafo
        self.tam_poblacion = max(10, tam_poblacion)
        self.generaciones = max(1, generaciones)
        self.prob_cruce = prob_cruce
        self.prob_mutacion = prob_mutacion
        self.num_elite = max(1, int(round(fraccion_elite * self.tam_poblacion)))
        self.tam_torneo = max(2, tam_torneo)
        self.paciencia = max(1, paciencia)
        self._rng = random.Random(semilla)

        self.origenes = grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)
        self.acopios = grafo.obtener_nodos_por_tipo(TipoNodo.ACOPIO)
        self.destinos = grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)

        self.acopios_penalizados: List[str] = [
            a.id for a in self.acopios if a.tasa_calidad < config.UMBRAL_CALIDAD
        ]
        self._set_penalizados = set(self.acopios_penalizados)

        # Datos por nodo/arista para el decodificador.
        self._oferta = {o.id: float(o.oferta) for o in self.origenes}
        self._demanda = {d.id: float(d.demanda) for d in self.destinos}
        self._precio = {
            d.id: (d.precio_venta if getattr(d, "precio_venta", 0.0) > 0 else config.PRECIO_VENTA_TON)
            for d in self.destinos
        }
        self._costo_op = {a.id: float(a.costo_operacion) for a in self.acopios}

        # Capacidad efectiva por arista: la salida de un acopio se reduce por su
        # merma (para entregar X hay que disponer de X tras la pérdida).
        self._cap = {}
        for clave, arista in grafo.aristas.items():
            u, _v = clave
            nodo_u = grafo.obtener_nodo(u)
            cap = float(arista.capacidad)
            if nodo_u is not None and nodo_u.tipo == TipoNodo.ACOPIO:
                cap *= max(0.0, 1.0 - nodo_u.tasa_merma)
            self._cap[clave] = max(0.0, cap)

        self.caminos: List[Camino] = self._construir_caminos()

    # ── Construcción de caminos O→A→D ─────────────────────────────────────────

    def _construir_caminos(self) -> List[Camino]:
        ids_origen = {o.id for o in self.origenes}
        ids_acopio = {a.id for a in self.acopios}
        ids_destino = {d.id for d in self.destinos}

        # Aristas entrantes a cada acopio (desde orígenes) y salientes (a destinos).
        entrantes: Dict[str, List[str]] = {a: [] for a in ids_acopio}
        salientes: Dict[str, List[str]] = {a: [] for a in ids_acopio}

        for (u, v) in self.grafo.aristas.keys():
            if u in ids_origen and v in ids_acopio:
                entrantes[v].append(u)
            elif u in ids_acopio and v in ids_destino:
                salientes[u].append(v)

        caminos: List[Camino] = []
        for acopio in ids_acopio:
            for o in entrantes[acopio]:
                for d in salientes[acopio]:
                    a_oa = (o, acopio)
                    a_ad = (acopio, d)
                    costo_oa = self.grafo.aristas[a_oa].costo_transporte
                    costo_ad = self.grafo.aristas[a_ad].costo_transporte
                    costo_op_unit = 0.0
                    nodo_a = self.grafo.obtener_nodo(acopio)
                    if nodo_a is not None and nodo_a.costo_operacion > 0:
                        costo_op_unit = nodo_a.costo_operacion / max(nodo_a.capacidad * 0.5, 1.0)
                    pen = config.PENALIZACION_CALIDAD if acopio in self._set_penalizados else 0.0
                    caminos.append(Camino(
                        origen=o, acopio=acopio, destino=d,
                        arista_oa=a_oa, arista_ad=a_ad,
                        costo_guia=costo_oa + costo_ad + costo_op_unit + pen,
                    ))
        return caminos

    # ── Decodificador: cromosoma → flujos factibles ───────────────────────────

    def _decodificar(self, cromosoma: List[float]) -> Dict[Tuple[str, str], float]:
        """Convierte un vector de prioridades en flujos factibles por arista."""
        rem_oferta = dict(self._oferta)
        rem_demanda = dict(self._demanda)
        rem_cap = dict(self._cap)
        flujos: Dict[Tuple[str, str], float] = {}

        # Orden de llenado: mayor prioridad primero.
        orden = sorted(range(len(self.caminos)), key=lambda i: cromosoma[i], reverse=True)

        for i in orden:
            cam = self.caminos[i]
            f = min(
                rem_oferta.get(cam.origen, 0.0),
                rem_demanda.get(cam.destino, 0.0),
                rem_cap.get(cam.arista_oa, 0.0),
                rem_cap.get(cam.arista_ad, 0.0),
            )
            if f <= 1e-9:
                continue
            rem_oferta[cam.origen] -= f
            rem_demanda[cam.destino] -= f
            rem_cap[cam.arista_oa] -= f
            rem_cap[cam.arista_ad] -= f
            flujos[cam.arista_oa] = flujos.get(cam.arista_oa, 0.0) + f
            flujos[cam.arista_ad] = flujos.get(cam.arista_ad, 0.0) + f

        return flujos

    # ── Reparación: maximizar la cobertura de demanda ─────────────────────────

    def _maximizar_cobertura(
        self, flujos: Dict[Tuple[str, str], float]
    ) -> Dict[Tuple[str, str], float]:
        """Garantiza que la solución cubra la MÁXIMA demanda físicamente posible.

        El decodificador voraz puede dejar un pequeño déficit en redes ajustadas
        (cuando una asignación temprana "consume" una ruta escasa que hacía falta
        para otro destino). Este paso construye la red RESIDUAL del flujo actual
        (con aristas de retorno que permiten redirigir) y busca caminos de
        aumento Origen → Acopio → Destino para satisfacer la demanda que quede.

        El resultado es un flujo de cobertura máxima —idéntica a la que alcanza el
        método exacto—, por lo que el Algoritmo Genético deja de reportar déficits
        que la red sí puede cubrir. La reparación solo toca la parte faltante: el
        grueso del ruteo (optimizado en costo por el AG) se conserva.
        """
        S, T = "__S__", "__T__"

        # Flujo usado por origen y recibido por destino en la solución actual.
        usado_origen = {o.id: 0.0 for o in self.origenes}
        recibido_dest = {d.id: 0.0 for d in self.destinos}
        for (u, v), f in flujos.items():
            if u in usado_origen:
                usado_origen[u] += f
            if v in recibido_dest:
                recibido_dest[v] += f

        # Si ya no hay demanda pendiente, no hay nada que reparar.
        deficit = sum(max(0.0, d.demanda - recibido_dest[d.id]) for d in self.destinos)
        if deficit <= 1e-9:
            return flujos

        # Construir la red residual: capacidad hacia adelante = capacidad libre,
        # capacidad de retorno = flujo ya enviado (permite redirigir).
        R = nx.DiGraph()

        def _agregar_residual(a, b, libre, usado):
            if libre > 1e-9:
                R.add_edge(a, b, capacity=R.get_edge_data(a, b, {}).get("capacity", 0.0) + libre)
            if usado > 1e-9:
                R.add_edge(b, a, capacity=R.get_edge_data(b, a, {}).get("capacity", 0.0) + usado)

        for o in self.origenes:
            _agregar_residual(S, o.id, o.oferta - usado_origen[o.id], usado_origen[o.id])

        for clave, cap in self._cap.items():
            u, v = clave
            f = flujos.get(clave, 0.0)
            _agregar_residual(u, v, cap - f, f)

        for d in self.destinos:
            _agregar_residual(d.id, T, d.demanda - recibido_dest[d.id], recibido_dest[d.id])

        if S not in R or T not in R:
            return flujos

        try:
            _, aug = nx.maximum_flow(R, S, T, capacity="capacity")
        except Exception:
            return flujos

        # Flujo neto por arista = flujo original + aumento − retorno.
        reparado = dict(flujos)
        for clave, cap in self._cap.items():
            u, v = clave
            adelante = aug.get(u, {}).get(v, 0.0)
            atras = aug.get(v, {}).get(u, 0.0)
            nuevo = flujos.get(clave, 0.0) + adelante - atras
            reparado[clave] = max(0.0, min(cap, nuevo))

        return reparado

    # ── Aptitud (fitness) ─────────────────────────────────────────────────────

    def _aptitud(self, flujos: Dict[Tuple[str, str], float]) -> float:
        """Ganancia real del negocio con penalización suave por baja calidad."""
        # Ingreso y penalización por demanda incumplida.
        recibido_por_destino: Dict[str, float] = {d.id: 0.0 for d in self.destinos}
        for (u, v), f in flujos.items():
            if v in recibido_por_destino:
                recibido_por_destino[v] += f

        ingreso = 0.0
        penalizacion_demanda = 0.0
        for d in self.destinos:
            recibido = recibido_por_destino[d.id]
            ingreso += min(recibido, d.demanda) * self._precio[d.id]
            penalizacion_demanda += max(0.0, d.demanda - recibido) * config.PENALIZACION_INCUMPLIMIENTO

        # Costo de transporte real (costo base por tonelada).
        costo_transporte = sum(
            f * self.grafo.aristas[clave].costo_transporte
            for clave, f in flujos.items()
        )

        # Costo de operación de los acopios activos (con flujo entrante).
        flujo_entrante_acopio: Dict[str, float] = {a.id: 0.0 for a in self.acopios}
        for (u, v), f in flujos.items():
            if v in flujo_entrante_acopio:
                flujo_entrante_acopio[v] += f
        costo_operacion = sum(
            self._costo_op[a] for a, fin in flujo_entrante_acopio.items() if fin > 1e-6
        )

        # Penalización suave por usar acopios de baja calidad (steering, igual
        # que la penalización de costo del optimizador por grafos).
        penalizacion_calidad = 0.0
        for (u, v), f in flujos.items():
            if u in self._set_penalizados:   # arista de salida de acopio penalizado
                penalizacion_calidad += f * config.PENALIZACION_CALIDAD

        return ingreso - costo_transporte - costo_operacion - penalizacion_demanda - penalizacion_calidad

    # ── Operadores genéticos ──────────────────────────────────────────────────

    def _individuo_aleatorio(self) -> List[float]:
        return [self._rng.random() for _ in self.caminos]

    def _individuo_semilla(self) -> List[float]:
        """Semilla guiada: prioriza caminos baratos (mejor costo_guia → mayor
        prioridad), con algo de ruido para diversidad."""
        if not self.caminos:
            return []
        costos = [c.costo_guia for c in self.caminos]
        cmin, cmax = min(costos), max(costos)
        rango = (cmax - cmin) or 1.0
        return [
            max(0.0, min(1.0, (1.0 - (c - cmin) / rango) + self._rng.uniform(-0.1, 0.1)))
            for c in costos
        ]

    def _seleccion_torneo(self, poblacion: List[List[float]], aptitudes: List[float]) -> List[float]:
        mejor_idx = self._rng.randrange(len(poblacion))
        for _ in range(self.tam_torneo - 1):
            challenger = self._rng.randrange(len(poblacion))
            if aptitudes[challenger] > aptitudes[mejor_idx]:
                mejor_idx = challenger
        return poblacion[mejor_idx]

    def _cruce(self, p1: List[float], p2: List[float]) -> Tuple[List[float], List[float]]:
        """Cruce aritmético (blend): cada gen es una mezcla convexa de los padres."""
        if self._rng.random() > self.prob_cruce:
            return p1[:], p2[:]
        h1, h2 = [], []
        for g1, g2 in zip(p1, p2):
            alfa = self._rng.random()
            h1.append(alfa * g1 + (1 - alfa) * g2)
            h2.append(alfa * g2 + (1 - alfa) * g1)
        return h1, h2

    def _mutar(self, individuo: List[float]) -> List[float]:
        """Mutación gaussiana gen a gen, recortada a [0, 1]."""
        for i in range(len(individuo)):
            if self._rng.random() < self.prob_mutacion:
                individuo[i] = min(1.0, max(0.0, individuo[i] + self._rng.gauss(0.0, 0.15)))
        return individuo

    @staticmethod
    def _registrar_generacion(gen: int, aptitudes: List[float], mejor_global: float) -> dict:
        """Resumen de una generación: mejor, promedio, peor y diversidad."""
        n = len(aptitudes) or 1
        promedio = sum(aptitudes) / n
        mejor = max(aptitudes)
        peor = min(aptitudes)
        # Diversidad: dispersión relativa de la aptitud en la población.
        diversidad = (mejor - peor)
        return {
            "generacion": gen,
            "mejor": round(mejor, 2),
            "promedio": round(promedio, 2),
            "peor": round(peor, 2),
            "mejor_global": round(mejor_global, 2),
            "diversidad": round(diversidad, 2),
        }

    # ── Bucle evolutivo ───────────────────────────────────────────────────────

    def ejecutar(self) -> dict:
        if not self.caminos:
            logger.warning("AG: no hay cadenas Origen→Acopio→Destino; resultado vacío.")
            for arista in self.grafo.aristas.values():
                arista.flujo_actual = 0.0
            return construir_resultado(
                self.grafo, self.acopios_penalizados,
                algoritmo="Algoritmo Genético",
                extra={"generaciones_ejecutadas": 0, "historia_fitness": []},
            )

        # Población inicial: mezcla de semillas guiadas y aleatorias.
        poblacion: List[List[float]] = []
        num_semillas = max(1, self.tam_poblacion // 5)
        for _ in range(num_semillas):
            poblacion.append(self._mutar(self._individuo_semilla()))
        while len(poblacion) < self.tam_poblacion:
            poblacion.append(self._individuo_aleatorio())

        aptitudes = [self._aptitud(self._decodificar(ind)) for ind in poblacion]

        mejor_idx = max(range(len(poblacion)), key=lambda i: aptitudes[i])
        mejor_individuo = poblacion[mejor_idx][:]
        mejor_aptitud = aptitudes[mejor_idx]

        historia: List[float] = [round(mejor_aptitud, 2)]
        # Traza completa del proceso evolutivo (una fila por generación).
        historia_generaciones: List[dict] = [self._registrar_generacion(0, aptitudes, mejor_aptitud)]
        sin_mejora = 0
        generaciones_ejecutadas = 0

        for gen in range(self.generaciones):
            generaciones_ejecutadas = gen + 1

            # Elitismo: conservar a los mejores individuos.
            orden = sorted(range(len(poblacion)), key=lambda i: aptitudes[i], reverse=True)
            nueva_poblacion = [poblacion[orden[k]][:] for k in range(self.num_elite)]

            # Reproducción hasta completar la población.
            while len(nueva_poblacion) < self.tam_poblacion:
                p1 = self._seleccion_torneo(poblacion, aptitudes)
                p2 = self._seleccion_torneo(poblacion, aptitudes)
                h1, h2 = self._cruce(p1, p2)
                nueva_poblacion.append(self._mutar(h1))
                if len(nueva_poblacion) < self.tam_poblacion:
                    nueva_poblacion.append(self._mutar(h2))

            poblacion = nueva_poblacion
            aptitudes = [self._aptitud(self._decodificar(ind)) for ind in poblacion]

            gen_mejor_idx = max(range(len(poblacion)), key=lambda i: aptitudes[i])
            if aptitudes[gen_mejor_idx] > mejor_aptitud + 1e-6:
                mejor_aptitud = aptitudes[gen_mejor_idx]
                mejor_individuo = poblacion[gen_mejor_idx][:]
                sin_mejora = 0
            else:
                sin_mejora += 1

            historia.append(round(mejor_aptitud, 2))
            historia_generaciones.append(
                self._registrar_generacion(generaciones_ejecutadas, aptitudes, mejor_aptitud)
            )

            # Parada temprana por convergencia.
            if sin_mejora >= self.paciencia:
                logger.info(f"AG: convergencia en la generación {generaciones_ejecutadas}.")
                break

        # Volcar el mejor cromosoma como flujos sobre la red real, tras un paso
        # de reparación que garantiza la máxima cobertura de demanda factible.
        mejores_flujos = self._decodificar(mejor_individuo)
        mejores_flujos = self._maximizar_cobertura(mejores_flujos)
        for clave, arista in self.grafo.aristas.items():
            arista.flujo_actual = max(0.0, float(mejores_flujos.get(clave, 0.0)))

        resultado = construir_resultado(
            self.grafo,
            self.acopios_penalizados,
            algoritmo="Algoritmo Genético",
            extra={
                "generaciones_ejecutadas": generaciones_ejecutadas,
                "tam_poblacion": self.tam_poblacion,
                "num_caminos": len(self.caminos),
                "fitness_inicial": round(historia_generaciones[0]["mejor"], 4),
                "fitness_final": round(mejor_aptitud, 4),
                "historia_fitness": historia,
                "historia_generaciones": historia_generaciones,
                "parametros_ag": {
                    "tam_poblacion": self.tam_poblacion,
                    "generaciones_max": self.generaciones,
                    "prob_cruce": self.prob_cruce,
                    "prob_mutacion": self.prob_mutacion,
                    "num_elite": self.num_elite,
                    "tam_torneo": self.tam_torneo,
                },
            },
        )

        logger.info(
            f"Optimización por AG: {resultado['num_rutas_activas']} rutas activas, "
            f"costo={resultado['costo_minimo']:.2f}, ganancia={resultado['ganancia']:.2f}, "
            f"generaciones={generaciones_ejecutadas}, "
            f"acopios_penalizados={self.acopios_penalizados}"
        )

        return resultado
