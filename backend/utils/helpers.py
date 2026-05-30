"""
Datos por defecto de la red logística "Acuícola Real del Meta"
y funciones auxiliares de conversión.

Red: 6 orígenes + 10 acopios + 25 supermercados = 41 nodos
     Oferta total: 595 ton | Demanda total: 307 ton
"""

from models.arista import Arista
from models.grafo import GrafoRed
from models.nodo import Nodo, TipoNodo


def construir_red_acuicola() -> GrafoRed:
    """
    Construye y retorna el grafo completo de Acuícola Real del Meta
    con datos geográficos y logísticos reales de Colombia.
    """
    grafo = GrafoRed()

    # ── ORÍGENES (6 estaciones de producción) ────────────────────────────────
    origenes = [
        Nodo("O1", TipoNodo.ORIGEN, "Estación Puerto López", "Puerto López", "Meta",
             4.0854, -72.9508, 120, oferta=120),
        Nodo("O2", TipoNodo.ORIGEN, "Estación Puerto Gaitán", "Puerto Gaitán", "Meta",
             4.3147, -72.0806, 100, oferta=100),
        Nodo("O3", TipoNodo.ORIGEN, "Estación San Martín", "San Martín", "Meta",
             3.6931, -73.6997, 90, oferta=90),
        Nodo("O4", TipoNodo.ORIGEN, "Estación Girardot", "Girardot", "Cundinamarca",
             4.3020, -74.8025, 80, oferta=80),
        Nodo("O5", TipoNodo.ORIGEN, "Estación Fusagasugá", "Fusagasugá", "Cundinamarca",
             4.3433, -74.3640, 110, oferta=110),
        Nodo("O6", TipoNodo.ORIGEN, "Estación Facatativá", "Facatativá", "Cundinamarca",
             4.8145, -74.3564, 95, oferta=95),
    ]
    for n in origenes:
        grafo.agregar_nodo(n)

    # ── ACOPIOS (10 centros de distribución) ─────────────────────────────────
    acopios = [
        Nodo("A1", TipoNodo.ACOPIO, "Centro Bogotá", "Bogotá", "Cundinamarca",
             4.7110, -74.0721, 200, tasa_merma=0.010, tasa_calidad=0.95, costo_operacion=50.0),
        Nodo("A2", TipoNodo.ACOPIO, "Centro Villavicencio", "Villavicencio", "Meta",
             4.1420, -73.6266, 150, tasa_merma=0.020, tasa_calidad=0.92, costo_operacion=40.0),
        Nodo("A3", TipoNodo.ACOPIO, "Centro Medellín", "Medellín", "Antioquia",
             6.2442, -75.5812, 180, tasa_merma=0.015, tasa_calidad=0.90, costo_operacion=55.0),
        Nodo("A4", TipoNodo.ACOPIO, "Centro Cali", "Cali", "Valle del Cauca",
             3.4516, -76.5320, 160, tasa_merma=0.020, tasa_calidad=0.88, costo_operacion=45.0),
        Nodo("A5", TipoNodo.ACOPIO, "Centro Barranquilla", "Barranquilla", "Atlántico",
             10.9685, -74.7813, 140, tasa_merma=0.025, tasa_calidad=0.85, costo_operacion=50.0),
        Nodo("A6", TipoNodo.ACOPIO, "Centro Manizales", "Manizales", "Caldas",
             5.0689, -75.5174, 120, tasa_merma=0.018, tasa_calidad=0.91, costo_operacion=35.0),
        Nodo("A7", TipoNodo.ACOPIO, "Centro Bucaramanga", "Bucaramanga", "Santander",
             7.1254, -73.1198, 130, tasa_merma=0.020, tasa_calidad=0.89, costo_operacion=40.0),
        Nodo("A8", TipoNodo.ACOPIO, "Centro Cúcuta", "Cúcuta", "Norte de Santander",
             7.8939, -72.5078, 100, tasa_merma=0.022, tasa_calidad=0.87, costo_operacion=35.0),
        Nodo("A9", TipoNodo.ACOPIO, "Centro Pereira", "Pereira", "Risaralda",
             4.8087, -75.6906, 110, tasa_merma=0.016, tasa_calidad=0.93, costo_operacion=35.0),
        Nodo("A10", TipoNodo.ACOPIO, "Centro Ibagué", "Ibagué", "Tolima",
             4.4389, -75.2322, 125, tasa_merma=0.017, tasa_calidad=0.90, costo_operacion=35.0),
    ]
    for n in acopios:
        grafo.agregar_nodo(n)

    # ── DESTINOS (25 supermercados) ───────────────────────────────────────────
    destinos = [
        # Bogotá (5)
        Nodo("D1", TipoNodo.DESTINO, "Súper Norte Bogotá", "Bogotá", "Cundinamarca",
             4.7500, -74.0500, 30, demanda=18),
        Nodo("D2", TipoNodo.DESTINO, "Súper Sur Bogotá", "Bogotá", "Cundinamarca",
             4.6300, -74.1100, 25, demanda=15),
        Nodo("D3", TipoNodo.DESTINO, "Súper Centro Bogotá", "Bogotá", "Cundinamarca",
             4.6950, -74.0357, 35, demanda=20),
        Nodo("D4", TipoNodo.DESTINO, "Súper Oriente Bogotá", "Bogotá", "Cundinamarca",
             4.6800, -74.0000, 20, demanda=12),
        Nodo("D5", TipoNodo.DESTINO, "Súper Occidente Bogotá", "Bogotá", "Cundinamarca",
             4.6600, -74.1400, 25, demanda=16),
        # Medellín (4)
        Nodo("D6", TipoNodo.DESTINO, "Súper Norte Medellín", "Medellín", "Antioquia",
             6.2700, -75.5600, 22, demanda=14),
        Nodo("D7", TipoNodo.DESTINO, "Súper Sur Medellín", "Medellín", "Antioquia",
             6.2100, -75.5800, 20, demanda=12),
        Nodo("D8", TipoNodo.DESTINO, "Súper Centro Medellín", "Medellín", "Antioquia",
             6.2500, -75.5700, 28, demanda=16),
        Nodo("D9", TipoNodo.DESTINO, "Súper Oriente Medellín", "Medellín", "Antioquia",
             6.2300, -75.5400, 18, demanda=10),
        # Cali (4)
        Nodo("D10", TipoNodo.DESTINO, "Súper Norte Cali", "Cali", "Valle del Cauca",
             3.4800, -76.5100, 20, demanda=13),
        Nodo("D11", TipoNodo.DESTINO, "Súper Sur Cali", "Cali", "Valle del Cauca",
             3.4200, -76.5400, 18, demanda=11),
        Nodo("D12", TipoNodo.DESTINO, "Súper Centro Cali", "Cali", "Valle del Cauca",
             3.4600, -76.5200, 25, demanda=15),
        Nodo("D13", TipoNodo.DESTINO, "Súper Oriente Cali", "Cali", "Valle del Cauca",
             3.4400, -76.4900, 15, demanda=9),
        # Barranquilla (3)
        Nodo("D14", TipoNodo.DESTINO, "Súper Norte Barranquilla", "Barranquilla", "Atlántico",
             11.0000, -74.8100, 20, demanda=12),
        Nodo("D15", TipoNodo.DESTINO, "Súper Centro Barranquilla", "Barranquilla", "Atlántico",
             10.9600, -74.7600, 18, demanda=10),
        Nodo("D16", TipoNodo.DESTINO, "Súper Sur Barranquilla", "Barranquilla", "Atlántico",
             10.9300, -74.7900, 22, demanda=14),
        # Bucaramanga (2)
        Nodo("D17", TipoNodo.DESTINO, "Súper Norte Bucaramanga", "Bucaramanga", "Santander",
             7.1400, -73.1300, 15, demanda=9),
        Nodo("D18", TipoNodo.DESTINO, "Súper Sur Bucaramanga", "Bucaramanga", "Santander",
             7.1000, -73.1100, 18, demanda=11),
        # Villavicencio (2)
        Nodo("D19", TipoNodo.DESTINO, "Súper Norte Villavicencio", "Villavicencio", "Meta",
             4.1600, -73.6300, 15, demanda=8),
        Nodo("D20", TipoNodo.DESTINO, "Súper Sur Villavicencio", "Villavicencio", "Meta",
             4.1200, -73.6400, 15, demanda=10),
        # Manizales (2)
        Nodo("D21", TipoNodo.DESTINO, "Súper Norte Manizales", "Manizales", "Caldas",
             5.0800, -75.5100, 12, demanda=7),
        Nodo("D22", TipoNodo.DESTINO, "Súper Sur Manizales", "Manizales", "Caldas",
             5.0500, -75.5300, 15, demanda=9),
        # Pereira (1)
        Nodo("D23", TipoNodo.DESTINO, "Súper Centro Pereira", "Pereira", "Risaralda",
             4.8100, -75.6900, 15, demanda=8),
        # Cúcuta (1)
        Nodo("D24", TipoNodo.DESTINO, "Súper Centro Cúcuta", "Cúcuta", "Norte de Santander",
             7.9000, -72.5100, 12, demanda=7),
        # Ibagué (1)
        Nodo("D25", TipoNodo.DESTINO, "Súper Centro Ibagué", "Ibagué", "Tolima",
             4.4400, -75.2300, 18, demanda=11),
    ]
    for n in destinos:
        grafo.agregar_nodo(n)

    # ── ARISTAS Origen → Acopio ───────────────────────────────────────────────
    # (id_origen, id_destino, costo_transport $/ton, capacidad ton, distancia km)
    rutas_origen_acopio = [
        # Meta → Villavicencio (hub regional del Meta)
        ("O1", "A2", 12.5, 80, 86),
        ("O2", "A2", 18.0, 70, 190),
        ("O3", "A2", 11.0, 60, 75),
        # Meta → Bogotá
        ("O1", "A1", 15.0, 60, 185),
        ("O2", "A7", 35.0, 40, 450),  # Puerto Gaitán → Bucaramanga
        ("O3", "A10", 14.0, 50, 150), # San Martín → Ibagué
        # Cundinamarca → Bogotá
        ("O4", "A1", 12.0, 70, 132),
        ("O5", "A1", 10.0, 80, 75),
        ("O6", "A1", 8.0, 90, 45),
        # Cundinamarca → otros
        ("O4", "A10", 10.0, 50, 90),  # Girardot → Ibagué
        ("O4", "A4", 22.0, 40, 280),  # Girardot → Cali
        ("O5", "A10", 12.0, 50, 105), # Fusagasugá → Ibagué
        ("O5", "A9", 18.0, 40, 210),  # Fusagasugá → Pereira
        ("O6", "A3", 28.0, 50, 340),  # Facatativá → Medellín
        ("O6", "A6", 22.0, 40, 250),  # Facatativá → Manizales
    ]
    for u, v, costo, cap, dist in rutas_origen_acopio:
        grafo.agregar_arista(Arista(u, v, costo, cap, dist))

    # ── ARISTAS Acopio → Acopio (redistribución inter-centros) ───────────────
    rutas_acopio_acopio = [
        ("A2", "A1", 10.0, 120, 99),   # Villavicencio → Bogotá
        ("A1", "A3", 32.0, 100, 415),  # Bogotá → Medellín
        ("A1", "A5", 55.0, 80, 1000),  # Bogotá → Barranquilla
        ("A1", "A7", 30.0, 80, 395),   # Bogotá → Bucaramanga
        ("A1", "A6", 25.0, 60, 290),   # Bogotá → Manizales
        ("A1", "A9", 24.0, 60, 285),   # Bogotá → Pereira
        ("A3", "A4", 33.0, 80, 420),   # Medellín → Cali
        ("A3", "A6", 20.0, 60, 205),   # Medellín → Manizales
        ("A6", "A9", 8.0, 50, 45),     # Manizales → Pereira
        ("A7", "A8", 18.0, 50, 200),   # Bucaramanga → Cúcuta
        ("A10", "A4", 22.0, 60, 260),  # Ibagué → Cali
        ("A10", "A9", 13.0, 50, 120),  # Ibagué → Pereira
    ]
    for u, v, costo, cap, dist in rutas_acopio_acopio:
        grafo.agregar_arista(Arista(u, v, costo, cap, dist))

    # ── ARISTAS Acopio → Destino (última milla) ───────────────────────────────
    # Bogotá (A1 → D1..D5)
    ultima_milla = [
        ("A1", "D1", 8.0, 30, 12), ("A1", "D2", 8.5, 25, 18),
        ("A1", "D3", 7.5, 35, 8),  ("A1", "D4", 9.0, 20, 15),
        ("A1", "D5", 8.5, 25, 16),
        # Medellín (A3 → D6..D9)
        ("A3", "D6", 7.5, 22, 10), ("A3", "D7", 8.0, 20, 14),
        ("A3", "D8", 7.5, 28, 8),  ("A3", "D9", 8.0, 18, 12),
        # Cali (A4 → D10..D13)
        ("A4", "D10", 7.5, 20, 9), ("A4", "D11", 8.0, 18, 12),
        ("A4", "D12", 7.5, 25, 7), ("A4", "D13", 8.0, 15, 11),
        # Barranquilla (A5 → D14..D16)
        ("A5", "D14", 8.0, 20, 10), ("A5", "D15", 8.5, 18, 12),
        ("A5", "D16", 7.5, 22, 8),
        # Bucaramanga (A7 → D17..D18)
        ("A7", "D17", 7.5, 15, 8), ("A7", "D18", 8.0, 18, 10),
        # Villavicencio (A2 → D19..D20)
        ("A2", "D19", 6.5, 15, 5), ("A2", "D20", 7.0, 15, 8),
        # Manizales (A6 → D21..D22)
        ("A6", "D21", 7.5, 12, 8), ("A6", "D22", 8.0, 15, 10),
        # Pereira, Cúcuta, Ibagué
        ("A9", "D23", 6.5, 15, 5),
        ("A8", "D24", 7.5, 12, 8),
        ("A10", "D25", 6.5, 18, 5),
    ]
    for u, v, costo, cap, dist in ultima_milla:
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
