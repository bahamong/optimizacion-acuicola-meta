from typing import Dict, List, Tuple

from models.grafo import GrafoRed
from models.nodo import TipoNodo


class ValidadorRestricciones:
    """
    Verifica que una solución (flujos asignados) cumpla todas las restricciones
    del modelo matemático:

    1. Oferta: flujo_salida_i ≤ oferta_i  ∀ i ∈ Orígenes
    2. Demanda: flujo_entrada_k ≥ demanda_k  ∀ k ∈ Destinos
    3. Capacidad aristas: flujo_ij ≤ capacidad_ij
    4. Balance de flujo: entrada_j = salida_j + stock_j + merma_j  ∀ j ∈ Acopios
    5. Calidad: si tasa_calidad_j < umbral → penalizar o bloquear
    6. No negatividad: flujo_ij ≥ 0
    """

    UMBRAL_CALIDAD = 0.5

    def __init__(self, grafo: GrafoRed) -> None:
        self.grafo = grafo

    def verificar_oferta(
        self, flujos: Dict[Tuple[str, str], float]
    ) -> List[dict]:
        """Retorna violaciones de restricción de oferta."""
        violaciones = []
        for origen in self.grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN):
            salida = sum(
                flujos.get((origen.id, dest), 0.0)
                for dest in self.grafo.vecinos_salida(origen.id)
            )
            if salida > origen.oferta + 1e-6:
                violaciones.append({
                    "tipo": "oferta",
                    "nodo": origen.id,
                    "nombre": origen.nombre,
                    "valor": salida,
                    "limite": origen.oferta,
                    "exceso": salida - origen.oferta,
                })
        return violaciones

    def verificar_demanda(
        self, flujos: Dict[Tuple[str, str], float]
    ) -> List[dict]:
        """Retorna violaciones de restricción de demanda (déficit)."""
        violaciones = []
        for destino in self.grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO):
            entrada = sum(
                flujos.get((orig, destino.id), 0.0)
                for orig in self.grafo.vecinos_entrada(destino.id)
            )
            if entrada < destino.demanda - 1e-6:
                violaciones.append({
                    "tipo": "demanda",
                    "nodo": destino.id,
                    "nombre": destino.nombre,
                    "recibido": round(entrada, 4),
                    "demanda": destino.demanda,
                    "deficit": round(destino.demanda - entrada, 4),
                })
        return violaciones

    def verificar_capacidad_aristas(
        self, flujos: Dict[Tuple[str, str], float]
    ) -> List[dict]:
        """Retorna violaciones de capacidad en aristas."""
        violaciones = []
        for (u, v), arista in self.grafo.aristas.items():
            f = flujos.get((u, v), 0.0)
            if f < -1e-6:
                violaciones.append({
                    "tipo": "no_negatividad",
                    "arista": f"{u}→{v}",
                    "flujo": f,
                })
            elif f > arista.capacidad + 1e-6:
                violaciones.append({
                    "tipo": "capacidad_arista",
                    "arista": f"{u}→{v}",
                    "flujo": round(f, 4),
                    "capacidad": arista.capacidad,
                    "exceso": round(f - arista.capacidad, 4),
                })
        return violaciones

    def verificar_balance_acopios(
        self,
        flujos: Dict[Tuple[str, str], float],
        stock: Dict[str, float],
    ) -> List[dict]:
        """
        Balance de flujo en nodos de acopio:
        entrada_j = salida_j + stock_j + merma_j
        """
        violaciones = []
        for acopio in self.grafo.obtener_nodos_por_tipo(TipoNodo.ACOPIO):
            entrada = sum(
                flujos.get((orig, acopio.id), 0.0)
                for orig in self.grafo.vecinos_entrada(acopio.id)
            )
            salida = sum(
                flujos.get((acopio.id, dest), 0.0)
                for dest in self.grafo.vecinos_salida(acopio.id)
            )
            s = stock.get(acopio.id, 0.0)
            merma = self.grafo.calcular_merma(acopio.id, s)
            balance = entrada - salida - s - merma
            if abs(balance) > 1.0:  # tolerancia de 1 ton
                violaciones.append({
                    "tipo": "balance_acopio",
                    "nodo": acopio.id,
                    "nombre": acopio.nombre,
                    "entrada": round(entrada, 4),
                    "salida": round(salida, 4),
                    "stock": round(s, 4),
                    "merma": round(merma, 4),
                    "desequilibrio": round(balance, 4),
                })
        return violaciones

    def verificar_calidad(self) -> List[dict]:
        """Identifica acopios con tasa de calidad por debajo del umbral."""
        alertas = []
        for acopio in self.grafo.obtener_nodos_por_tipo(TipoNodo.ACOPIO):
            if acopio.tasa_calidad < self.UMBRAL_CALIDAD:
                alertas.append({
                    "tipo": "calidad",
                    "nodo": acopio.id,
                    "nombre": acopio.nombre,
                    "tasa_calidad": acopio.tasa_calidad,
                    "umbral": self.UMBRAL_CALIDAD,
                    "accion": "bloquear_flujo" if acopio.tasa_calidad == 0 else "penalizar",
                })
        return alertas

    def validar_completo(
        self,
        flujos: Dict[Tuple[str, str], float],
        stock: Dict[str, float],
    ) -> dict:
        """Ejecuta todas las validaciones y retorna un reporte consolidado."""
        v_oferta = self.verificar_oferta(flujos)
        v_demanda = self.verificar_demanda(flujos)
        v_capacidad = self.verificar_capacidad_aristas(flujos)
        v_balance = self.verificar_balance_acopios(flujos, stock)
        v_calidad = self.verificar_calidad()

        todas = v_oferta + v_demanda + v_capacidad + v_balance
        valido = len(todas) == 0

        return {
            "valido": valido,
            "violaciones_oferta": v_oferta,
            "violaciones_demanda": v_demanda,
            "violaciones_capacidad": v_capacidad,
            "violaciones_balance": v_balance,
            "alertas_calidad": v_calidad,
            "total_violaciones": len(todas),
            "deficit_total": sum(v["deficit"] for v in v_demanda),
        }
