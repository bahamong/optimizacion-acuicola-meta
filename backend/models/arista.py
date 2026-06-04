# Archivo: backend/models/arista.py
from dataclasses import dataclass


# Multiplicador del costo según el estado (situación) de la vía.
# El costo total por tonelada = costo base * multiplicador.
# "bloqueada" inutiliza la ruta (mult = None → sin costo utilizable).
MULTIPLICADOR_ESTADO = {
    "activa": 1.00,           # Normal
    "gasolina_alta": 1.15,    # Gasolina alta (+15%)
    "via_deteriorada": 1.25,  # Vía deteriorada (+25%)
    "bloqueada": None,        # Vía bloqueada
}


def costo_total_segun_estado(costo_base: float, estado: str) -> float:
    """Costo total por tonelada ajustado según el estado de la vía.

    Una vía bloqueada devuelve 0.0 (no hay costo de transporte utilizable).
    """
    mult = MULTIPLICADOR_ESTADO.get(estado, 1.0)
    if mult is None:
        return 0.0
    return round(float(costo_base) * mult, 2)


@dataclass
class Arista:
    """Representa una ruta de transporte entre dos nodos de la red."""

    id_origen: str
    id_destino: str
    costo_transporte: float  # $/ton — costo base (editable)
    capacidad: float         # ton máximas por período
    distancia: float         # km
    estado: str = "activa"   # "activa" | "gasolina_alta" | "via_deteriorada" | "bloqueada"
    umbral_calidad: float = 0.0   # %: si la calidad de origen/destino cae por debajo → ruta en riesgo
    flujo_actual: float = 0.0
    tiempo_transito: float = 0.0  # horas (calculado)
    velocidad: float = 65.0       # km/h promedio
    fuente_distancia: str = "manual"
    generada_automaticamente: bool = False
    factor_costo: float = 1.0
    penalizacion: float = 0.0

    @property
    def multiplicador_estado(self) -> float:
        """Factor de costo derivado del estado de la vía (1.0 si bloqueada/desconocido)."""
        mult = MULTIPLICADOR_ESTADO.get(self.estado, 1.0)
        return 1.0 if mult is None else mult

    @property
    def costo_base(self) -> float:
        """Costo de transporte base por tonelada, sin ajustar por el estado de la vía."""
        return self.costo_transporte

    @property
    def costo_total_unitario(self) -> float:
        """Costo total por tonelada ajustado según el estado de la vía (no editable)."""
        costo_ajustado = self.costo_transporte * self.factor_costo + self.penalizacion
        return costo_total_segun_estado(costo_ajustado, self.estado)

    @property
    def fuente_arista(self) -> str:
        """Origen logico de la arista dentro del grafo en memoria."""
        return "generada" if self.generada_automaticamente else "base_datos"

    @property
    def costo_total(self) -> float:
        """Costo de transportar el flujo actual (ajustado por el estado de la vía)."""
        return self.flujo_actual * self.costo_total_unitario

    @property
    def utilizacion(self) -> float:
        """Fracción de capacidad usada [0, 1]."""
        return self.flujo_actual / self.capacidad if self.capacidad > 0 else 0.0

    @property
    def disponible(self) -> bool:
        return self.estado != "bloqueada"

    def calcular_tiempo_transito(self) -> float:
        if self.velocidad > 0:
            self.tiempo_transito = self.distancia / self.velocidad
        return self.tiempo_transito

    def validar(self) -> None:
        if self.costo_transporte < 0:
            raise ValueError(f"Costo negativo en arista {self.id_origen}→{self.id_destino}")
        if self.factor_costo <= 0:
            raise ValueError(f"Factor de costo no positivo en arista {self.id_origen}â†’{self.id_destino}")
        if self.costo_transporte * self.factor_costo + self.penalizacion < 0:
            raise ValueError(f"Costo ajustado negativo en arista {self.id_origen}â†’{self.id_destino}")
        if self.capacidad <= 0:
            raise ValueError(f"Capacidad no positiva en arista {self.id_origen}→{self.id_destino}")
        if self.distancia <= 0:
            raise ValueError(f"Distancia no positiva en arista {self.id_origen}→{self.id_destino}")
        if self.flujo_actual < 0:
            raise ValueError(f"Flujo negativo en arista {self.id_origen}→{self.id_destino}")

    def __repr__(self) -> str:
        return f"Arista({self.id_origen}→{self.id_destino}, costo={self.costo_transporte}, cap={self.capacidad})"
