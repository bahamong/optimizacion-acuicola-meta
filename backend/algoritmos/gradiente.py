"""
Método de Gradiente (SciPy SLSQP) para optimización de flujos continuos.

Recibe el conjunto de rutas activas seleccionado por el Algoritmo Genético
y determina los flujos exactos x_ij y el stock s_j en cada acopio para
minimizar el costo total de la red.

Variables de decisión continuas:
  x = [x_0, x_1, ..., x_m, s_0, s_1, ..., s_p]
       (flujos en aristas activas)  (stock en acopios)

Función objetivo (minimizar costo total):
  f(x) = Σ c_ij · x_ij + Σ costo_almacen_j · s_j + Σ precio · merma_j

Restricciones:
  - Oferta:     Σ_j x_ij ≤ oferta_i          ∀ i ∈ Orígenes
  - Demanda:    Σ_i x_ij ≥ demanda_j          ∀ j ∈ Destinos
  - Capacidad:  0 ≤ x_ij ≤ cap_ij
  - Balance:    entrada_j = salida_j + s_j + merma_j  ∀ j ∈ Acopios
  - No neg.:    x_ij ≥ 0, s_j ≥ 0
"""

from typing import Dict, List, Optional, Tuple

import numpy as np
from scipy.optimize import minimize

import config
from models.arista import Arista
from models.grafo import GrafoRed
from models.nodo import TipoNodo
from utils.logger import get_logger

logger = get_logger(__name__)


class MetodoGradiente:
    """
    Optimizador de flujos continuos mediante gradiente descendente proyectado
    (implementado con SciPy SLSQP — Sequential Least Squares Programming).

    Recibe: grafo completo + lista de aristas activas (salida del AG).
    Retorna: flujos óptimos x_ij y stocks s_j que minimizan el costo total.
    """

    def __init__(self, grafo: GrafoRed, aristas_activas: List[Arista]) -> None:
        self.grafo = grafo
        self.aristas_activas = aristas_activas

        self.orígenes = grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)
        self.acopios = grafo.obtener_nodos_por_tipo(TipoNodo.ACOPIO)
        self.destinos = grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)

        # Índices de variables
        self.n_flujos = len(aristas_activas)
        self.n_stocks = len(self.acopios)
        self.n_vars = self.n_flujos + self.n_stocks

        # Mapeo arista→índice y acopio→índice
        self._arista_idx: Dict[Tuple[str, str], int] = {
            (a.id_origen, a.id_destino): i for i, a in enumerate(aristas_activas)
        }
        self._acopio_idx: Dict[str, int] = {
            a.id: i for i, a in enumerate(self.acopios)
        }

    # ── Función objetivo ──────────────────────────────────────────────────────

    def _funcion_costo(self, variables: np.ndarray) -> float:
        """
        Costo total a minimizar:
          transporte + almacenamiento + pérdida por mermas
        """
        x = variables[: self.n_flujos]
        s = variables[self.n_flujos :]

        costo_transporte = sum(
            x[i] * a.costo_transporte for i, a in enumerate(self.aristas_activas)
        )
        costo_almacenamiento = config.COSTO_ALMACENAMIENTO * s.sum()

        costo_mermas = 0.0
        for j, acopio in enumerate(self.acopios):
            merma = s[j] * acopio.tasa_merma
            costo_mermas += merma * config.PRECIO_VENTA_TON

        return costo_transporte + costo_almacenamiento + costo_mermas

    # ── Restricciones ─────────────────────────────────────────────────────────

    def _restricciones(self) -> List[dict]:
        """
        Define las restricciones para SciPy.
        - 'ineq': g(x) ≥ 0
        - 'eq':   h(x) = 0
        """
        restricciones = []

        # R1. Oferta: oferta_i - Σ x_ij ≥ 0
        for origen in self.orígenes:
            indices_salida = [
                self._arista_idx[(origen.id, v)]
                for v in self.grafo.vecinos_salida(origen.id)
                if (origen.id, v) in self._arista_idx
            ]
            cap_oferta = origen.oferta

            def r_oferta(variables, idx=indices_salida, cap=cap_oferta):
                x = variables[: self.n_flujos]
                return cap - sum(x[i] for i in idx)

            restricciones.append({"type": "ineq", "fun": r_oferta})

        # R2. Demanda: Σ x_jk - demanda_k ≥ 0
        for destino in self.destinos:
            indices_entrada = [
                self._arista_idx[(u, destino.id)]
                for u in self.grafo.vecinos_entrada(destino.id)
                if (u, destino.id) in self._arista_idx
            ]
            dem = destino.demanda

            def r_demanda(variables, idx=indices_entrada, d=dem):
                x = variables[: self.n_flujos]
                return sum(x[i] for i in idx) - d

            restricciones.append({"type": "ineq", "fun": r_demanda})

        # R3. Balance de acopio: entrada_j - salida_j - s_j - merma_j = 0
        for j, acopio in enumerate(self.acopios):
            idx_entrada = [
                self._arista_idx[(u, acopio.id)]
                for u in self.grafo.vecinos_entrada(acopio.id)
                if (u, acopio.id) in self._arista_idx
            ]
            idx_salida = [
                self._arista_idx[(acopio.id, v)]
                for v in self.grafo.vecinos_salida(acopio.id)
                if (acopio.id, v) in self._arista_idx
            ]
            tasa = acopio.tasa_merma
            j_idx = j  # captura por valor

            def r_balance(variables, ie=idx_entrada, is_=idx_salida, t=tasa, j=j_idx):
                x = variables[: self.n_flujos]
                s = variables[self.n_flujos :]
                entrada = sum(x[i] for i in ie)
                salida = sum(x[i] for i in is_)
                merma = s[j] * t
                return entrada - salida - s[j] - merma  # debe ser ≈ 0

            restricciones.append({"type": "eq", "fun": r_balance})

        return restricciones

    # ── Punto de inicio ───────────────────────────────────────────────────────

    def _punto_inicial(self) -> np.ndarray:
        """
        Punto de inicio factible: distribuye uniformemente la demanda
        entre las rutas activas que llegan a cada destino.
        """
        x0 = np.zeros(self.n_vars)

        for destino in self.destinos:
            rutas_entrantes = [
                (u, destino.id)
                for u in self.grafo.vecinos_entrada(destino.id)
                if (u, destino.id) in self._arista_idx
            ]
            if not rutas_entrantes:
                continue
            flujo_por_ruta = destino.demanda / len(rutas_entrantes)
            for clave in rutas_entrantes:
                arista = self.grafo.obtener_arista(*clave)
                flujo = min(flujo_por_ruta, arista.capacidad if arista else flujo_por_ruta)
                x0[self._arista_idx[clave]] = flujo

        # Stock inicial conservador (5 % de capacidad)
        for j, acopio in enumerate(self.acopios):
            x0[self.n_flujos + j] = acopio.capacidad * 0.05

        return x0

    # ── Ejecución ─────────────────────────────────────────────────────────────

    def ejecutar(self) -> dict:
        """
        Ejecuta la optimización por gradiente usando SciPy SLSQP.
        Retorna flujos óptimos, stocks, costo mínimo y métricas de convergencia.
        """
        if self.n_flujos == 0:
            logger.warning("Sin rutas activas para optimizar con gradiente.")
            return {
                "exito": False,
                "mensaje": "Sin rutas activas",
                "costo_minimo": 0.0,
                "flujos": {},
                "stocks": {},
                "iteraciones": 0,
            }

        x0 = self._punto_inicial()

        # Límites: flujos ∈ [0, cap_ij], stocks ∈ [0, cap_acopio]
        limites = (
            [(0.0, a.capacidad) for a in self.aristas_activas]
            + [(0.0, acopio.capacidad) for acopio in self.acopios]
        )

        restricciones = self._restricciones()

        logger.info(
            f"Iniciando gradiente: {self.n_flujos} flujos + {self.n_stocks} stocks, "
            f"max_iter={config.GRAD_ITERACIONES}"
        )

        resultado = minimize(
            fun=self._funcion_costo,
            x0=x0,
            method="SLSQP",
            bounds=limites,
            constraints=restricciones,
            options={"ftol": config.GRAD_TOLERANCIA, "maxiter": config.GRAD_ITERACIONES, "disp": False},
        )

        x_opt = resultado.x[: self.n_flujos]
        s_opt = resultado.x[self.n_flujos :]

        flujos_optimos = {
            f"{a.id_origen}→{a.id_destino}": round(float(x_opt[i]), 4)
            for i, a in enumerate(self.aristas_activas)
        }
        stocks_optimos = {
            acopio.id: round(float(s_opt[j]), 4)
            for j, acopio in enumerate(self.acopios)
        }

        # Actualizar flujos en el grafo
        for i, arista in enumerate(self.aristas_activas):
            arista.flujo_actual = max(0.0, float(x_opt[i]))

        ganancia = self._calcular_ganancia(x_opt, s_opt)

        logger.info(
            f"Gradiente finalizado: éxito={resultado.success}, "
            f"costo={resultado.fun:.2f}, iter={resultado.nit}"
        )

        return {
            "exito": resultado.success,
            "mensaje": resultado.message,
            "costo_minimo": round(float(resultado.fun), 4),
            "ganancia": round(ganancia, 4),
            "flujos": flujos_optimos,
            "stocks": stocks_optimos,
            "iteraciones": resultado.nit,
        }

    def _calcular_ganancia(self, x_opt: np.ndarray, s_opt: np.ndarray) -> float:
        ingreso = sum(
            min(
                sum(
                    x_opt[self._arista_idx[(u, d.id)]]
                    for u in self.grafo.vecinos_entrada(d.id)
                    if (u, d.id) in self._arista_idx
                ),
                d.demanda,
            ) * config.PRECIO_VENTA_TON
            for d in self.destinos
        )
        costo = self._funcion_costo(np.concatenate([x_opt, s_opt]))
        return ingreso - costo
