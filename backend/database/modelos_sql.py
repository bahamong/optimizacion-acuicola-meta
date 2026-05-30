"""
Modelos SQLAlchemy para persistir nodos, aristas, soluciones y escenarios.
"""

import json
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class NodoSQL(Base):
    __tablename__ = "nodos"

    id = Column(String, primary_key=True)
    tipo = Column(String, nullable=False)
    nombre = Column(String, nullable=False)
    municipio = Column(String)
    departamento = Column(String)
    latitud = Column(Float)
    longitud = Column(Float)
    capacidad = Column(Float, default=0.0)
    oferta = Column(Float, default=0.0)
    demanda = Column(Float, default=0.0)
    tasa_merma = Column(Float, default=0.0)
    tasa_calidad = Column(Float, default=1.0)
    costo_operacion = Column(Float, default=0.0)

    def __repr__(self):
        return f"<NodoSQL {self.id} ({self.tipo})>"


class AristaSQL(Base):
    __tablename__ = "aristas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_origen = Column(String, nullable=False)
    id_destino = Column(String, nullable=False)
    costo_transporte = Column(Float, nullable=False)
    capacidad = Column(Float, nullable=False)
    distancia = Column(Float, nullable=False)
    estado = Column(String, default="activa")

    def __repr__(self):
        return f"<AristaSQL {self.id_origen}→{self.id_destino}>"


class SolucionSQL(Base):
    __tablename__ = "soluciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    tipo_escenario = Column(String, default="base")
    ganancia_total = Column(Float)
    costo_total = Column(Float)
    num_rutas_activas = Column(Integer)
    porcentaje_demanda_cumplida = Column(Float)
    flujos_json = Column(Text)   # JSON: {origen→destino: flujo}
    stocks_json = Column(Text)   # JSON: {acopio_id: stock}
    metricas_json = Column(Text) # JSON: métricas adicionales

    def set_flujos(self, flujos: dict):
        self.flujos_json = json.dumps(flujos, ensure_ascii=False)

    def get_flujos(self) -> dict:
        return json.loads(self.flujos_json) if self.flujos_json else {}

    def set_stocks(self, stocks: dict):
        self.stocks_json = json.dumps(stocks, ensure_ascii=False)

    def get_stocks(self) -> dict:
        return json.loads(self.stocks_json) if self.stocks_json else {}

    def set_metricas(self, metricas: dict):
        self.metricas_json = json.dumps(metricas, ensure_ascii=False)

    def get_metricas(self) -> dict:
        return json.loads(self.metricas_json) if self.metricas_json else {}

    def __repr__(self):
        return f"<SolucionSQL id={self.id} ganancia={self.ganancia_total}>"


class EscenarioHistorialSQL(Base):
    __tablename__ = "escenarios_historial"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    tipo = Column(String, nullable=False)   # "combustible" | "via_cerrada" | "calidad"
    parametros_json = Column(Text)
    ganancia_base = Column(Float)
    ganancia_escenario = Column(Float)
    impacto_absoluto = Column(Float)
    impacto_porcentual = Column(Float)
    resultado_json = Column(Text)

    def set_parametros(self, params: dict):
        self.parametros_json = json.dumps(params, ensure_ascii=False)

    def get_parametros(self) -> dict:
        return json.loads(self.parametros_json) if self.parametros_json else {}

    def __repr__(self):
        return f"<EscenarioHistorialSQL {self.tipo} impacto={self.impacto_absoluto}>"
