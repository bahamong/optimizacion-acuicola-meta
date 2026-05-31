from dataclasses import dataclass


@dataclass
class Arista:
    """Representa una ruta de transporte entre dos nodos de la red."""

    id_origen: str
    id_destino: str
    costo_transporte: float  # $/ton
    capacidad: float         # ton máximas por período
    distancia: float         # km
    estado: str = "activa"   # "activa" | "bloqueada" | "degradada"
    umbral_calidad: float = 0.0   # %: si la calidad de origen/destino cae por debajo → ruta en riesgo
    flujo_actual: float = 0.0
    tiempo_transito: float = 0.0  # horas (calculado)
    velocidad: float = 65.0       # km/h promedio

    @property
    def costo_total(self) -> float:
        """Costo de transportar el flujo actual."""
        return self.flujo_actual * self.costo_transporte

    @property
    def utilizacion(self) -> float:
        """Fracción de capacidad usada [0, 1]."""
        return self.flujo_actual / self.capacidad if self.capacidad > 0 else 0.0

    @property
    def disponible(self) -> bool:
        return self.estado == "activa"

    def calcular_tiempo_transito(self) -> float:
        if self.velocidad > 0:
            self.tiempo_transito = self.distancia / self.velocidad
        return self.tiempo_transito

    def validar(self) -> None:
        if self.costo_transporte < 0:
            raise ValueError(f"Costo negativo en arista {self.id_origen}→{self.id_destino}")
        if self.capacidad <= 0:
            raise ValueError(f"Capacidad no positiva en arista {self.id_origen}→{self.id_destino}")
        if self.distancia <= 0:
            raise ValueError(f"Distancia no positiva en arista {self.id_origen}→{self.id_destino}")
        if self.flujo_actual < 0:
            raise ValueError(f"Flujo negativo en arista {self.id_origen}→{self.id_destino}")

    def __repr__(self) -> str:
        return f"Arista({self.id_origen}→{self.id_destino}, costo={self.costo_transporte}, cap={self.capacidad})"
