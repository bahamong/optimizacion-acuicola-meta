# Archivo: backend/models/nodo.py
from enum import Enum
from dataclasses import dataclass, field


class TipoNodo(str, Enum):
    ORIGEN = "origen"
    ACOPIO = "acopio"
    DESTINO = "destino"


@dataclass
class Nodo:
    """Representa un nodo en la red logística (origen, acopio o supermercado destino)."""

    id: str
    tipo: TipoNodo
    nombre: str
    municipio: str
    departamento: str
    latitud: float
    longitud: float
    capacidad: float          # ton (producción para origen, almacenamiento para acopio)
    oferta: float = 0.0       # ton disponibles (solo orígenes)
    demanda: float = 0.0      # ton requeridas (solo destinos)
    tasa_merma: float = 0.0   # fracción de pérdida diaria (solo acopios)
    tasa_calidad: float = 1.0 # probabilidad de pasar control de calidad [0, 1]
    costo_operacion: float = 0.0  # $/día (solo acopios)
    precio_venta: float = 250.0   # $/ton (solo destinos)

    def validar(self) -> None:
        if self.capacidad < 0:
            raise ValueError(f"Capacidad negativa en nodo {self.id}")
        if self.oferta < 0:
            raise ValueError(f"Oferta negativa en nodo {self.id}")
        if self.demanda < 0:
            raise ValueError(f"Demanda negativa en nodo {self.id}")
        if not (0.0 <= self.tasa_calidad <= 1.0):
            raise ValueError(f"tasa_calidad en {self.id} debe estar en [0, 1]")
        if not (-90 <= self.latitud <= 90):
            raise ValueError(f"Latitud inválida en {self.id}: {self.latitud}")
        if not (-180 <= self.longitud <= 180):
            raise ValueError(f"Longitud inválida en {self.id}: {self.longitud}")

    def __repr__(self) -> str:
        return f"Nodo({self.id}, {self.tipo.value}, {self.nombre})"
