"""
Datos por defecto de la red logística "Acuícola Real del Meta"
y funciones auxiliares de conversión.

Toda la red opera ÚNICAMENTE en los departamentos de Cundinamarca y Meta.
Red: 6 orígenes + 10 acopios + 25 supermercados = 41 nodos

Las distancias de las rutas se calculan automáticamente (haversine × factor vial)
y el costo de transporte se deriva de la distancia. El usuario no las edita.
La tasa de merma de un acopio se deriva de su tasa de calidad.
"""

import math

from models.arista import Arista
from models.grafo import GrafoRed
from models.nodo import Nodo, TipoNodo

# Factor que aproxima la distancia por carretera a partir de la distancia recta
FACTOR_VIAL = 1.30
# Costo de transporte: base + proporcional a la distancia ($/ton)
COSTO_BASE = 2.0
COSTO_POR_KM = 0.08


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia en km entre dos coordenadas (fórmula de haversine)."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def distancia_vial(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia aproximada por carretera (km), redondeada."""
    return round(haversine_km(lat1, lng1, lat2, lng2) * FACTOR_VIAL, 1)


def costo_desde_distancia(distancia_km: float) -> float:
    """Costo de transporte ($/ton) derivado de la distancia."""
    return round(COSTO_BASE + distancia_km * COSTO_POR_KM, 2)


def merma_desde_calidad(tasa_calidad: float) -> float:
    """
    La merma de un acopio se deriva directamente de su calidad:
    merma = 100% - calidad. Calidad 1.0 → 0% merma; calidad 0.85 → 15% merma.
    """
    return round(1.0 - max(0.0, min(1.0, tasa_calidad)), 4)


def construir_red_acuicola() -> GrafoRed:
    """
    Construye la red de Acuícola Real del Meta en Cundinamarca y Meta.
    Distancias y costos de las aristas se calculan automáticamente.
    """
    grafo = GrafoRed()

    # ── ORÍGENES (6 estaciones: 3 Meta, 3 Cundinamarca) ───────────────────────
    origenes = [
        Nodo("O1", TipoNodo.ORIGEN, "Estación Puerto López", "Puerto López", "Meta",
             4.0854, -72.9508, 120, oferta=120),
        Nodo("O2", TipoNodo.ORIGEN, "Estación Puerto Gaitán", "Puerto Gaitán", "Meta",
             4.3112, -72.0825, 100, oferta=100),
        Nodo("O3", TipoNodo.ORIGEN, "Estación San Martín", "San Martín", "Meta",
             3.6931, -73.6997, 90, oferta=90),
        Nodo("O4", TipoNodo.ORIGEN, "Estación Girardot", "Girardot", "Cundinamarca",
             4.3037, -74.8035, 80, oferta=80),
        Nodo("O5", TipoNodo.ORIGEN, "Estación Fusagasugá", "Fusagasugá", "Cundinamarca",
             4.3373, -74.3637, 110, oferta=110),
        Nodo("O6", TipoNodo.ORIGEN, "Estación Facatativá", "Facatativá", "Cundinamarca",
             4.8145, -74.3548, 95, oferta=95),
    ]

    # ── ACOPIOS (10 centros: Cundinamarca + Meta) ─────────────────────────────
    # (id, nombre, municipio, depto, lat, lng, capacidad, calidad, costo_op)
    acopios_def = [
        ("A1",  "Centro Bogotá",        "Bogotá",        "Cundinamarca", 4.7110, -74.0721, 200, 0.95, 50.0),
        ("A2",  "Centro Villavicencio", "Villavicencio", "Meta",         4.1420, -73.6266, 150, 0.92, 45.0),
        ("A3",  "Centro Soacha",        "Soacha",        "Cundinamarca", 4.5790, -74.2168, 140, 0.90, 40.0),
        ("A4",  "Centro Zipaquirá",     "Zipaquirá",     "Cundinamarca", 5.0221, -74.0048, 120, 0.93, 38.0),
        ("A5",  "Centro Acacías",       "Acacías",       "Meta",         3.9889, -73.7558, 110, 0.88, 36.0),
        ("A6",  "Centro Granada",       "Granada",       "Meta",         3.5460, -73.7064, 100, 0.85, 35.0),
        ("A7",  "Centro Chía",          "Chía",          "Cundinamarca", 4.8614, -74.0586, 120, 0.94, 42.0),
        ("A8",  "Centro Mosquera",      "Mosquera",      "Cundinamarca", 4.7059, -74.2300, 110, 0.91, 38.0),
        ("A9",  "Centro Cumaral",       "Cumaral",       "Meta",         4.2706, -73.4889,  90, 0.89, 34.0),
        ("A10", "Centro Madrid",        "Madrid",        "Cundinamarca", 4.7324, -74.2659, 100, 0.90, 36.0),
    ]
    acopios = [
        Nodo(i, TipoNodo.ACOPIO, nom, mun, dep, lat, lng, cap,
             tasa_merma=merma_desde_calidad(cal), tasa_calidad=cal, costo_operacion=cop)
        for (i, nom, mun, dep, lat, lng, cap, cal, cop) in acopios_def
    ]

    # ── DESTINOS (25 supermercados en Cundinamarca + Meta) ────────────────────
    # (id, nombre, municipio, depto, lat, lng, capacidad, demanda)
    destinos_def = [
        # Bogotá (6)
        ("D1",  "Súper Norte Bogotá",      "Bogotá", "Cundinamarca", 4.7500, -74.0500, 30, 18),
        ("D2",  "Súper Sur Bogotá",        "Bogotá", "Cundinamarca", 4.6300, -74.1100, 25, 15),
        ("D3",  "Súper Centro Bogotá",     "Bogotá", "Cundinamarca", 4.6950, -74.0357, 35, 20),
        ("D4",  "Súper Oriente Bogotá",    "Bogotá", "Cundinamarca", 4.6800, -74.0000, 20, 12),
        ("D5",  "Súper Occidente Bogotá",  "Bogotá", "Cundinamarca", 4.6600, -74.1400, 25, 16),
        ("D6",  "Súper Suba Bogotá",       "Bogotá", "Cundinamarca", 4.7450, -74.0830, 22, 14),
        # Villavicencio (4)
        ("D7",  "Súper Norte Villavicencio", "Villavicencio", "Meta", 4.1600, -73.6300, 20, 13),
        ("D8",  "Súper Sur Villavicencio",   "Villavicencio", "Meta", 4.1200, -73.6400, 18, 11),
        ("D9",  "Súper Centro Villavicencio","Villavicencio", "Meta", 4.1480, -73.6320, 25, 15),
        ("D10", "Súper Este Villavicencio",  "Villavicencio", "Meta", 4.1500, -73.6100, 15,  9),
        # Soacha (2)
        ("D11", "Súper Centro Soacha", "Soacha", "Cundinamarca", 4.5840, -74.2230, 20, 12),
        ("D12", "Súper Norte Soacha",  "Soacha", "Cundinamarca", 4.5900, -74.2100, 18, 10),
        # Zipaquirá (2)
        ("D13", "Súper Centro Zipaquirá", "Zipaquirá", "Cundinamarca", 5.0270, -74.0010, 14,  8),
        ("D14", "Súper Sur Zipaquirá",    "Zipaquirá", "Cundinamarca", 5.0100, -74.0100, 15,  9),
        # Acacías (2)
        ("D15", "Súper Centro Acacías", "Acacías", "Meta", 3.9940, -73.7610, 16, 10),
        ("D16", "Súper Norte Acacías",  "Acacías", "Meta", 3.9950, -73.7500, 13,  8),
        # Granada (2)
        ("D17", "Súper Centro Granada", "Granada", "Meta", 3.5510, -73.7110, 15,  9),
        ("D18", "Súper Sur Granada",    "Granada", "Meta", 3.5400, -73.7100, 12,  7),
        # Chía (2)
        ("D19", "Súper Centro Chía", "Chía", "Cundinamarca", 4.8660, -74.0540, 14,  8),
        ("D20", "Súper Norte Chía",  "Chía", "Cundinamarca", 4.8700, -74.0500, 16, 10),
        # Fusagasugá (2)
        ("D21", "Súper Centro Fusagasugá", "Fusagasugá", "Cundinamarca", 4.3373, -74.3637, 12,  7),
        ("D22", "Súper Norte Fusagasugá",  "Fusagasugá", "Cundinamarca", 4.3450, -74.3600, 15,  9),
        # Facatativá (1), Girardot (1), Cumaral (1)
        ("D23", "Súper Centro Facatativá", "Facatativá", "Cundinamarca", 4.8145, -74.3548, 18, 11),
        ("D24", "Súper Centro Girardot",   "Girardot",   "Cundinamarca", 4.3037, -74.8035, 12,  7),
        ("D25", "Súper Centro Cumaral",    "Cumaral",    "Meta",         4.2756, -73.4840, 13,  8),
    ]
    destinos = [
        Nodo(i, TipoNodo.DESTINO, nom, mun, dep, lat, lng, cap, demanda=dem)
        for (i, nom, mun, dep, lat, lng, cap, dem) in destinos_def
    ]

    for n in origenes + acopios + destinos:
        grafo.agregar_nodo(n)

    # ── ARISTAS (origen, destino, capacidad) — distancia y costo automáticos ──
    conexiones = [
        # Origen → Acopio
        ("O1", "A2", 80), ("O1", "A9", 50),
        ("O2", "A2", 70), ("O2", "A9", 40),
        ("O3", "A2", 60), ("O3", "A5", 50), ("O3", "A6", 50),
        ("O4", "A3", 60), ("O4", "A1", 50),
        ("O5", "A3", 70), ("O5", "A1", 60),
        ("O6", "A8", 70), ("O6", "A10", 60), ("O6", "A1", 50),
        # Acopio → Acopio (redistribución)
        ("A2", "A1", 120), ("A5", "A2", 60), ("A6", "A2", 50), ("A9", "A2", 50),
        ("A1", "A3", 80), ("A1", "A7", 80), ("A1", "A8", 70),
        ("A7", "A4", 50), ("A10", "A8", 50),
        # Acopio → Destino (última milla)
        ("A1", "D1", 30), ("A1", "D2", 25), ("A1", "D3", 35),
        ("A1", "D4", 20), ("A1", "D5", 25), ("A1", "D6", 22),
        ("A2", "D7", 20), ("A2", "D8", 18), ("A2", "D9", 25), ("A2", "D10", 15),
        ("A3", "D11", 20), ("A3", "D12", 18),
        ("A4", "D13", 14), ("A4", "D14", 15),
        ("A5", "D15", 16), ("A5", "D16", 13),
        ("A6", "D17", 15), ("A6", "D18", 12),
        ("A7", "D19", 14), ("A7", "D20", 16),
        ("A3", "D21", 14), ("A3", "D22", 15),   # Soacha → Fusagasugá
        ("A10", "D23", 18),                       # Madrid → Facatativá
        ("A3", "D24", 12),                        # Soacha → Girardot
        ("A9", "D25", 13),                        # Cumaral → Cumaral
    ]

    for u, v, cap in conexiones:
        nu, nv = grafo.obtener_nodo(u), grafo.obtener_nodo(v)
        dist = distancia_vial(nu.latitud, nu.longitud, nv.latitud, nv.longitud)
        costo = costo_desde_distancia(dist)
        grafo.agregar_arista(Arista(u, v, costo, cap, dist))

    return grafo


def flujos_a_dict(grafo: GrafoRed) -> dict:
    """Convierte los flujos actuales del grafo a un dict serializable."""
    return {
        f"{a.id_origen}→{a.id_destino}": round(a.flujo_actual, 4)
        for a in grafo.aristas.values()
    }


def calcular_metricas_resultado(grafo: GrafoRed, resultado_gradiente: dict) -> dict:
    """Calcula KPIs de la solución para el panel de la interfaz."""
    destinos = grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)
    demanda_total = sum(d.demanda for d in destinos)

    flujos = resultado_gradiente.get("flujos", {})
    demanda_cumplida = 0.0
    for destino in destinos:
        flujo_recibido = sum(
            v for k, v in flujos.items() if k.endswith(f"→{destino.id}")
        )
        demanda_cumplida += min(flujo_recibido, destino.demanda)

    pct_cumplida = (demanda_cumplida / demanda_total * 100) if demanda_total > 0 else 0.0

    return {
        "oferta_total": grafo.oferta_total(),
        "demanda_total": demanda_total,
        "demanda_cumplida": round(demanda_cumplida, 2),
        "porcentaje_demanda_cumplida": round(pct_cumplida, 2),
        "costo_total": resultado_gradiente.get("costo_minimo", 0.0),
        "ganancia_total": resultado_gradiente.get("ganancia", 0.0),
        "num_nodos": len(grafo.nodos),
        "num_aristas": len(grafo.aristas),
        "num_origenes": len(grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)),
        "num_acopios": len(grafo.obtener_nodos_por_tipo(TipoNodo.ACOPIO)),
        "num_destinos": len(grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)),
    }
