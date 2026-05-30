"""
Algoritmo Genético para optimización de rutas activas en la red logística.

Cromosoma: vector binario y_ij ∈ {0,1} por cada arista del grafo.
  - y_ij = 1 → la ruta i→j está activa
  - y_ij = 0 → la ruta no se usa

Fitness = Ganancia estimada = Ingresos_demanda_alcanzable
                             - Costo_transporte_estimado
                             - Penalización_demanda_incumplida
                             - Penalización_calidad

Tras convergencia, la mejor combinación de rutas activas se pasa al
método de gradiente para optimizar los flujos continuos x_ij.
"""

import random
from typing import Dict, List, Tuple

import networkx as nx
from deap import algorithms, base, creator, tools

import config
from models.grafo import GrafoRed
from models.nodo import TipoNodo
from utils.logger import get_logger

logger = get_logger(__name__)

# DEAP usa estado global en el módulo creator — se crean una sola vez
if not hasattr(creator, "FitnessMax"):
    creator.create("FitnessMax", base.Fitness, weights=(1.0,))
if not hasattr(creator, "IndividuoRuta"):
    creator.create("IndividuoRuta", list, fitness=creator.FitnessMax)


class AlgoritmoGenetico:
    """
    Implementa un Algoritmo Genético para seleccionar el conjunto óptimo
    de rutas activas en la red logística de Acuícola Real del Meta.

    Parámetros AG (configurables en config.py):
      - Tamaño de población: AG_POBLACION (default 60)
      - Generaciones:        AG_GENERACIONES (default 150)
      - Tasa cruzamiento:    AG_TASA_CRUZAMIENTO (default 0.85)
      - Tasa mutación:       AG_TASA_MUTACION (default 0.05)
      - Selección:           Torneo de tamaño 3
      - Cruzamiento:         Dos puntos (cxTwoPoint)
      - Mutación:            Flip de bits (mutFlipBit)
    """

    def __init__(self, grafo: GrafoRed) -> None:
        self.grafo = grafo
        self.aristas_lista: List = list(grafo.aristas.values())
        self.num_genes: int = len(self.aristas_lista)
        self.orígenes = [n.id for n in grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)]
        self.acopios = grafo.obtener_nodos_por_tipo(TipoNodo.ACOPIO)
        self.destinos = grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)
        self.demanda_total = sum(d.demanda for d in self.destinos)
        self.mejor_individuo: List[int] = []
        self.mejor_fitness: float = float("-inf")
        self.historial: List[float] = []

        self.toolbox = self._configurar_toolbox()

    # ── Configuración DEAP ────────────────────────────────────────────────────

    def _configurar_toolbox(self) -> base.Toolbox:
        tb = base.Toolbox()
        tb.register("bit", random.randint, 0, 1)
        tb.register(
            "individual",
            tools.initRepeat,
            creator.IndividuoRuta,
            tb.bit,
            n=self.num_genes,
        )
        tb.register("population", tools.initRepeat, list, tb.individual)
        tb.register("evaluate", self._evaluar_fitness)
        tb.register("mate", tools.cxTwoPoint)
        tb.register("mutate", tools.mutFlipBit, indpb=config.AG_TASA_MUTACION)
        tb.register("select", tools.selTournament, tournsize=3)
        return tb

    # ── Función de fitness ────────────────────────────────────────────────────

    def _evaluar_fitness(self, individuo: List[int]) -> Tuple[float]:
        """
        Función de aptitud: estima la ganancia con las rutas activas del cromosoma.

        Paso 1: Construir subgrafo con rutas activas.
        Paso 2: Para cada destino, verificar si existe camino desde algún origen.
        Paso 3: Estimar costo de transporte de las rutas activas.
        Paso 4: Penalizar demanda no alcanzable y baja calidad.
        Retorna: (ganancia_estimada,)  — mayor es mejor.
        """
        if sum(individuo) == 0:
            return (-1_000_000.0,)

        # Subgrafo con solo las rutas activas
        G_sub = nx.DiGraph()
        for nodo_id in self.grafo.nodos:
            G_sub.add_node(nodo_id)
        costo_rutas_activas = 0.0
        for i, bit in enumerate(individuo):
            if bit == 1:
                a = self.aristas_lista[i]
                G_sub.add_edge(a.id_origen, a.id_destino)
                # Estimación de costo: supone ~60 % de utilización promedio
                costo_rutas_activas += a.costo_transporte * (a.capacidad * 0.6)

        # Demanda alcanzable
        demanda_alcanzable = 0.0
        for dest in self.destinos:
            for orig in self.orígenes:
                try:
                    if nx.has_path(G_sub, orig, dest.id):
                        demanda_alcanzable += dest.demanda
                        break
                except nx.NodeNotFound:
                    pass

        demanda_no_alcanzable = self.demanda_total - demanda_alcanzable

        # Penalización por acopios con baja calidad en rutas activas
        penalizacion_calidad = 0.0
        for i, bit in enumerate(individuo):
            if bit == 1:
                a = self.aristas_lista[i]
                nodo_dest = self.grafo.obtener_nodo(a.id_destino)
                if nodo_dest and nodo_dest.tipo == TipoNodo.ACOPIO:
                    if nodo_dest.tasa_calidad < 0.5:
                        penalizacion_calidad += config.PENALIZACION_CALIDAD

        ingreso_estimado = demanda_alcanzable * config.PRECIO_VENTA_TON
        penalizacion_demanda = demanda_no_alcanzable * config.PENALIZACION_INCUMPLIMIENTO
        ganancia = ingreso_estimado - costo_rutas_activas - penalizacion_demanda - penalizacion_calidad
        return (ganancia,)

    # ── Ejecución ─────────────────────────────────────────────────────────────

    def ejecutar(self) -> dict:
        """
        Ejecuta el Algoritmo Genético.

        Estrategia generacional con elitismo (preserva el mejor individuo).
        Retorna el mejor cromosoma encontrado y el historial de convergencia.
        """
        logger.info(
            f"Iniciando AG: población={config.AG_POBLACION}, generaciones={config.AG_GENERACIONES}"
        )
        poblacion = self.toolbox.population(n=config.AG_POBLACION)

        # Estadísticas — extraer [0] porque fitness.values es una tupla (ganancia,)
        stats = tools.Statistics(lambda ind: ind.fitness.values[0])
        stats.register("max", max)
        stats.register("avg", lambda vals: sum(vals) / len(vals))

        hall_of_fame = tools.HallOfFame(1)

        poblacion, logbook = algorithms.eaSimple(
            poblacion,
            self.toolbox,
            cxpb=config.AG_TASA_CRUZAMIENTO,
            mutpb=config.AG_TASA_MUTACION,
            ngen=config.AG_GENERACIONES,
            stats=stats,
            halloffame=hall_of_fame,
            verbose=False,
        )

        self.mejor_individuo = list(hall_of_fame[0])
        self.mejor_fitness = hall_of_fame[0].fitness.values[0]
        self.historial = [
            record["max"][0] if isinstance(record["max"], tuple) else record["max"]
            for record in logbook
        ]

        rutas_activas = [
            {
                "origen": self.aristas_lista[i].id_origen,
                "destino": self.aristas_lista[i].id_destino,
                "costo": self.aristas_lista[i].costo_transporte,
                "capacidad": self.aristas_lista[i].capacidad,
            }
            for i, bit in enumerate(self.mejor_individuo)
            if bit == 1
        ]

        logger.info(
            f"AG finalizado: fitness={self.mejor_fitness:.2f}, "
            f"rutas_activas={len(rutas_activas)}/{self.num_genes}"
        )

        return {
            "mejor_individuo": self.mejor_individuo,
            "mejor_fitness": round(self.mejor_fitness, 4),
            "rutas_activas": rutas_activas,
            "num_rutas_activas": len(rutas_activas),
            "num_rutas_total": self.num_genes,
            "historial_fitness": [round(f, 2) for f in self.historial],
        }

    def rutas_activas_del_mejor(self) -> List:
        """Retorna las aristas activas según el mejor cromosoma."""
        return [
            self.aristas_lista[i]
            for i, bit in enumerate(self.mejor_individuo)
            if bit == 1
        ]
