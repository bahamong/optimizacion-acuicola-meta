"""
Tests de integración para los endpoints REST de la API.
Ejecutar: pytest tests/test_api.py -v
"""

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# ── Datos de prueba ───────────────────────────────────────────────────────────

DATOS_MINIMOS = {
    "nodos": [
        {"id": "O1", "tipo": "origen", "nombre": "Origen Test", "municipio": "M", "departamento": "D",
         "latitud": 4.0, "longitud": -72.0, "capacidad": 100, "oferta": 100},
        {"id": "A1", "tipo": "acopio", "nombre": "Acopio Test", "municipio": "M", "departamento": "D",
         "latitud": 4.5, "longitud": -73.0, "capacidad": 150, "tasa_merma": 0.02},
        {"id": "D1", "tipo": "destino", "nombre": "Destino Test", "municipio": "M", "departamento": "D",
         "latitud": 5.0, "longitud": -74.0, "capacidad": 50, "demanda": 50},
    ],
    "aristas": [
        {"id_origen": "O1", "id_destino": "A1", "costo_transporte": 5.0, "capacidad": 100, "distancia": 50},
        {"id_origen": "A1", "id_destino": "D1", "costo_transporte": 10.0, "capacidad": 80, "distancia": 30},
    ],
}


# ── Health check ──────────────────────────────────────────────────────────────

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── Cargar datos ──────────────────────────────────────────────────────────────

def test_cargar_datos_ok():
    r = client.post("/api/cargar_datos", json=DATOS_MINIMOS)
    assert r.status_code == 200
    d = r.json()
    assert d["nodos_cargados"] == 3
    assert d["aristas_cargadas"] == 2
    assert d["oferta_total"] == 100.0
    assert d["demanda_total"] == 50.0


def test_cargar_datos_tipo_invalido():
    datos_malos = dict(DATOS_MINIMOS)
    datos_malos["nodos"] = [
        {"id": "X1", "tipo": "invalido", "nombre": "X", "municipio": "M", "departamento": "D",
         "latitud": 4.0, "longitud": -72.0, "capacidad": 100},
    ]
    datos_malos["aristas"] = []
    r = client.post("/api/cargar_datos", json=datos_malos)
    assert r.status_code == 400


def test_cargar_red_defecto():
    r = client.post("/api/cargar_red_defecto")
    assert r.status_code == 200
    d = r.json()
    assert d["nodos_cargados"] == 41
    assert d["oferta_total"] == 595.0
    assert d["demanda_total"] == 307.0


# ── Grafo JSON ────────────────────────────────────────────────────────────────

def test_grafo_json_requiere_datos():
    # Limpiar estado interno
    import api.rutas as rutas_mod
    rutas_mod.grafo_actual = None
    r = client.get("/api/grafo_json")
    assert r.status_code == 400


def test_grafo_json_ok():
    client.post("/api/cargar_datos", json=DATOS_MINIMOS)
    r = client.get("/api/grafo_json")
    assert r.status_code == 200
    d = r.json()
    assert "nodos" in d and "aristas" in d
    assert len(d["nodos"]) == 3


# ── Métricas ──────────────────────────────────────────────────────────────────

def test_metricas_ok():
    client.post("/api/cargar_datos", json=DATOS_MINIMOS)
    r = client.get("/api/metricas")
    assert r.status_code == 200
    d = r.json()
    assert d["nodos_totales"] == 3
    assert d["num_origenes"] == 1
    assert d["num_acopios"] == 1
    assert d["num_destinos"] == 1


# ── Ruta óptima (Dijkstra) ────────────────────────────────────────────────────

def test_ruta_optima_ok():
    client.post("/api/cargar_datos", json=DATOS_MINIMOS)
    r = client.get("/api/ruta_optima?origen=O1&destino=D1")
    assert r.status_code == 200
    d = r.json()
    assert d["existe"] is True
    assert d["ruta"] == ["O1", "A1", "D1"]
    assert d["costo_total"] == pytest.approx(15.0)


def test_ruta_optima_nodo_inexistente():
    client.post("/api/cargar_datos", json=DATOS_MINIMOS)
    r = client.get("/api/ruta_optima?origen=X99&destino=D1")
    assert r.status_code == 404


# ── Flujo máximo ──────────────────────────────────────────────────────────────

def test_flujo_maximo_ok():
    client.post("/api/cargar_datos", json=DATOS_MINIMOS)
    r = client.get("/api/flujo_maximo?fuente=O1&sumidero=D1")
    assert r.status_code == 200
    d = r.json()
    assert "flujo_maximo" in d
    assert d["flujo_maximo"] > 0


# ── Optimización (prueba de integración con AG reducido) ─────────────────────

def test_optimizar_ok():
    import config
    config.AG_GENERACIONES = 5
    config.AG_POBLACION = 5

    client.post("/api/cargar_datos", json=DATOS_MINIMOS)
    r = client.post("/api/optimizar")

    config.AG_GENERACIONES = 150
    config.AG_POBLACION = 60

    assert r.status_code == 200
    d = r.json()
    assert "ganancia" in d
    assert "rutas_activas" in d


def test_resultados_sin_optimizacion():
    import api.rutas as rutas_mod
    rutas_mod.resultado_optimizacion = None
    r = client.get("/api/resultados")
    assert r.status_code == 400


# ── Sensibilidad ──────────────────────────────────────────────────────────────

def test_sensibilidad_combustible():
    import config
    config.AG_GENERACIONES = 5
    config.AG_POBLACION = 5

    client.post("/api/cargar_datos", json=DATOS_MINIMOS)
    r = client.post("/api/sensibilidad/combustible", json={"porcentaje_aumento": 15.0})

    config.AG_GENERACIONES = 150
    config.AG_POBLACION = 60

    assert r.status_code == 200
    d = r.json()
    assert "ganancia_base" in d
    assert "ganancia_escenario" in d
    assert "impacto_absoluto" in d


def test_sensibilidad_via_cerrada():
    import config
    config.AG_GENERACIONES = 5
    config.AG_POBLACION = 5

    client.post("/api/cargar_datos", json=DATOS_MINIMOS)
    r = client.post(
        "/api/sensibilidad/via_cerrada",
        json={"id_origen": "O1", "id_destino": "A1"},
    )

    config.AG_GENERACIONES = 150
    config.AG_POBLACION = 60

    assert r.status_code == 200


def test_sensibilidad_calidad():
    import config
    config.AG_GENERACIONES = 5
    config.AG_POBLACION = 5

    client.post("/api/cargar_datos", json=DATOS_MINIMOS)
    r = client.post(
        "/api/sensibilidad/calidad",
        json={"id_acopio": "A1", "tasa_calidad_nueva": 0.2},
    )

    config.AG_GENERACIONES = 150
    config.AG_POBLACION = 60

    assert r.status_code == 200
    d = r.json()
    assert "impacto_porcentual" in d
