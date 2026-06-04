-- ============================================================
-- RESET COMPLETO DE LA RED — Acuícola Real del Meta
-- Distribución nacional: Meta + Cundinamarca → todo Colombia
-- Supermercados reales: Éxito, Jumbo, Carulla, Olímpica, La 14
-- ============================================================

-- ============================================================
-- PASO 1 — BORRAR DATOS ACTUALES
-- Orden: primero aristas (FK), luego nodos, luego auxiliares
-- ============================================================

DELETE FROM public.aristas;
DELETE FROM public.nodos;
DELETE FROM public.soluciones;
DELETE FROM public.escenarios_historial;
DELETE FROM public.rutas_osrm_cache;


-- ============================================================
-- PASO 2 — ORÍGENES (6)
-- 3 en Meta · 3 en Cundinamarca
-- Estaciones piscícolas reales de la región
-- ============================================================

INSERT INTO public.nodos
  (id, tipo, nombre, municipio, departamento,
   latitud, longitud, capacidad, oferta, demanda,
   tasa_merma, tasa_calidad, costo_operacion)
VALUES
  -- META (producción acuícola: llanos orientales, ríos Metica y Manacacías)
  ('O1', 'origen', 'Estación Piscícola Puerto López',
   'Puerto López',  'Meta',          4.0854, -72.9508,
   120.0, 120.0, 0.0, 0.0, 1.0, 0.0),

  ('O2', 'origen', 'Estación Piscícola Puerto Gaitán',
   'Puerto Gaitán', 'Meta',          4.3112, -72.0825,
   100.0, 100.0, 0.0, 0.0, 1.0, 0.0),

  ('O3', 'origen', 'Estación Piscícola San Martín',
   'San Martín',    'Meta',          3.6931, -73.6997,
   90.0,   90.0, 0.0, 0.0, 1.0, 0.0),

  -- CUNDINAMARCA (piscicultura en cuenca del río Magdalena y afluentes)
  ('O4', 'origen', 'Estación Piscícola Girardot',
   'Girardot',      'Cundinamarca',  4.3037, -74.8035,
   80.0,   80.0, 0.0, 0.0, 1.0, 0.0),

  ('O5', 'origen', 'Estación Piscícola Fusagasugá',
   'Fusagasugá',    'Cundinamarca',  4.3373, -74.3637,
   110.0, 110.0, 0.0, 0.0, 1.0, 0.0),

  ('O6', 'origen', 'Estación Piscícola La Palma',
   'La Palma',      'Cundinamarca',  4.9769, -74.4074,
   95.0,   95.0, 0.0, 0.0, 1.0, 0.0);


-- ============================================================
-- PASO 3 — CENTROS DE ACOPIO (10)
-- Distribuidos por todo el país para crear rutas largas
-- y variadas — ideal para demostrar los algoritmos
-- ============================================================

INSERT INTO public.nodos
  (id, tipo, nombre, municipio, departamento,
   latitud, longitud, capacidad, oferta, demanda,
   tasa_merma, tasa_calidad, costo_operacion)
VALUES
  -- Hub del Llano (recibe producción Meta y redistribuye a Bogotá)
  ('A1', 'acopio', 'Centro Logístico Villavicencio',
   'Villavicencio', 'Meta',            4.1420, -73.6266,
   150.0, 0.0, 0.0, 0.07, 0.93, 45.0),

  -- Hub Bogotá (núcleo principal: recibe de Llano y Cundinamarca,
  --             despacha a todo el país)
  ('A2', 'acopio', 'Centro Logístico Bogotá',
   'Bogotá',        'Cundinamarca',    4.6482, -74.0877,
   300.0, 0.0, 0.0, 0.05, 0.95, 80.0),

  -- Hub Antioquia (occidente: abastece Medellín, Pereira y Costa)
  ('A3', 'acopio', 'Centro Logístico Medellín',
   'Medellín',      'Antioquia',       6.2442, -75.5812,
   200.0, 0.0, 0.0, 0.08, 0.92, 65.0),

  -- Hub Pacífico (suroccidente: Cali y Neiva)
  ('A4', 'acopio', 'Centro Logístico Cali',
   'Cali',          'Valle del Cauca', 3.4516, -76.5320,
   180.0, 0.0, 0.0, 0.10, 0.90, 60.0),

  -- Hub Nororiente (puente entre Bogotá y Costa Caribe)
  ('A5', 'acopio', 'Centro Logístico Bucaramanga',
   'Bucaramanga',   'Santander',       7.1193, -73.1227,
   150.0, 0.0, 0.0, 0.09, 0.91, 50.0),

  -- Hub Costa Caribe (extremo norte del país)
  ('A6', 'acopio', 'Centro Logístico Barranquilla',
   'Barranquilla',  'Atlántico',      10.9878, -74.7889,
   130.0, 0.0, 0.0, 0.12, 0.88, 55.0),

  -- Hub Eje Cafetero (Pereira — triángulo Medellín/Bogotá/Cali)
  ('A7', 'acopio', 'Centro Logístico Pereira',
   'Pereira',       'Risaralda',       4.8133, -75.6961,
   120.0, 0.0, 0.0, 0.07, 0.93, 42.0),

  -- Hub Tolima (paso obligado entre Bogotá, Cali y Neiva)
  ('A8', 'acopio', 'Centro Logístico Ibagué',
   'Ibagué',        'Tolima',          4.4389, -75.2322,
   140.0, 0.0, 0.0, 0.11, 0.89, 48.0),

  -- Hub Huila (sur del país)
  ('A9', 'acopio', 'Centro Logístico Neiva',
   'Neiva',         'Huila',           2.9273, -75.2819,
   110.0, 0.0, 0.0, 0.13, 0.87, 40.0),

  -- Hub Boyacá (corredor Bogotá → Santander)
  ('A10','acopio', 'Centro Logístico Tunja',
   'Tunja',         'Boyacá',          5.5353, -73.3678,
   130.0, 0.0, 0.0, 0.08, 0.92, 44.0);


-- ============================================================
-- PASO 4 — SUPERMERCADOS DESTINO (30)
-- Cadenas reales: Éxito · Jumbo · Carulla · Olímpica · La 14
-- 6 Bogotá · 4 Medellín · 4 Cali · 3 Bucaramanga
-- 3 Barranquilla · 2 Pereira · 2 Ibagué · 2 Neiva
-- 2 Tunja · 2 Villavicencio
-- ============================================================

INSERT INTO public.nodos
  (id, tipo, nombre, municipio, departamento,
   latitud, longitud, capacidad, oferta, demanda,
   tasa_merma, tasa_calidad, costo_operacion)
VALUES

  -- ── BOGOTÁ (6 supermercados) ──────────────────────────────
  ('D1',  'destino', 'Éxito 170 — Usaquén',
   'Bogotá', 'Cundinamarca',  4.7467, -74.0476, 30.0, 0.0, 20.0, 0.0, 1.0, 0.0),

  ('D2',  'destino', 'Jumbo Calle 80 — Suba',
   'Bogotá', 'Cundinamarca',  4.7098, -74.0697, 28.0, 0.0, 18.0, 0.0, 1.0, 0.0),

  ('D3',  'destino', 'Carulla Unicentro — Chapinero',
   'Bogotá', 'Cundinamarca',  4.6907, -74.0483, 32.0, 0.0, 22.0, 0.0, 1.0, 0.0),

  ('D4',  'destino', 'Éxito Hayuelos — Fontibón',
   'Bogotá', 'Cundinamarca',  4.6616, -74.1461, 25.0, 0.0, 16.0, 0.0, 1.0, 0.0),

  ('D5',  'destino', 'Jumbo El Campín — Teusaquillo',
   'Bogotá', 'Cundinamarca',  4.6450, -74.0800, 24.0, 0.0, 15.0, 0.0, 1.0, 0.0),

  ('D6',  'destino', 'Carulla Chapinero — Calle 72',
   'Bogotá', 'Cundinamarca',  4.6720, -74.0560, 26.0, 0.0, 17.0, 0.0, 1.0, 0.0),

  -- ── MEDELLÍN (4 supermercados) ────────────────────────────
  ('D7',  'destino', 'Éxito Oviedo — El Poblado',
   'Medellín', 'Antioquia',   6.2087, -75.5686, 22.0, 0.0, 15.0, 0.0, 1.0, 0.0),

  ('D8',  'destino', 'Jumbo — Bello',
   'Bello',    'Antioquia',   6.3358, -75.5552, 20.0, 0.0, 13.0, 0.0, 1.0, 0.0),

  ('D9',  'destino', 'Carulla El Tesoro — Las Vegas',
   'Medellín', 'Antioquia',   6.1970, -75.5710, 18.0, 0.0, 12.0, 0.0, 1.0, 0.0),

  ('D10', 'destino', 'Éxito Laureles — Conquistadores',
   'Medellín', 'Antioquia',   6.2520, -75.6012, 17.0, 0.0, 11.0, 0.0, 1.0, 0.0),

  -- ── CALI (4 supermercados) ────────────────────────────────
  ('D11', 'destino', 'Éxito Chipichape — Norte',
   'Cali', 'Valle del Cauca', 3.4695, -76.5228, 20.0, 0.0, 14.0, 0.0, 1.0, 0.0),

  ('D12', 'destino', 'Jumbo Calima — Centro',
   'Cali', 'Valle del Cauca', 3.4420, -76.5340, 18.0, 0.0, 12.0, 0.0, 1.0, 0.0),

  ('D13', 'destino', 'La 14 Calima — Centro',
   'Cali', 'Valle del Cauca', 3.4482, -76.5320, 16.0, 0.0, 11.0, 0.0, 1.0, 0.0),

  ('D14', 'destino', 'Éxito Unicentro — Norte',
   'Cali', 'Valle del Cauca', 3.4900, -76.5100, 15.0, 0.0, 10.0, 0.0, 1.0, 0.0),

  -- ── BUCARAMANGA (3 supermercados) ────────────────────────
  ('D15', 'destino', 'Éxito Cabecera — Cabecera del Llano',
   'Bucaramanga', 'Santander', 7.1061, -73.1114, 16.0, 0.0, 10.0, 0.0, 1.0, 0.0),

  ('D16', 'destino', 'Jumbo Bucaramanga — Cañaveral',
   'Bucaramanga', 'Santander', 7.0973, -73.1189, 14.0, 0.0,  9.0, 0.0, 1.0, 0.0),

  ('D17', 'destino', 'Olímpica Sur — Floridablanca',
   'Floridablanca','Santander', 7.0639, -73.0891, 12.0, 0.0,  8.0, 0.0, 1.0, 0.0),

  -- ── BARRANQUILLA (3 supermercados) ────────────────────────
  ('D18', 'destino', 'Éxito Buenavista — Norte',
   'Barranquilla', 'Atlántico',11.0175, -74.8418, 18.0, 0.0, 12.0, 0.0, 1.0, 0.0),

  ('D19', 'destino', 'Jumbo Country — El Golf',
   'Barranquilla', 'Atlántico',10.9928, -74.8228, 16.0, 0.0, 10.0, 0.0, 1.0, 0.0),

  ('D20', 'destino', 'Olímpica Centro — Barranquilla',
   'Barranquilla', 'Atlántico',10.9635, -74.7895, 14.0, 0.0,  9.0, 0.0, 1.0, 0.0),

  -- ── PEREIRA (2 supermercados) ─────────────────────────────
  ('D21', 'destino', 'Éxito Unicentro — Pereira',
   'Pereira',  'Risaralda',   4.8175, -75.6935, 14.0, 0.0,  9.0, 0.0, 1.0, 0.0),

  ('D22', 'destino', 'Jumbo Pereira — Cuba',
   'Pereira',  'Risaralda',   4.7920, -75.7050, 12.0, 0.0,  8.0, 0.0, 1.0, 0.0),

  -- ── IBAGUÉ (2 supermercados) ──────────────────────────────
  ('D23', 'destino', 'Éxito Ibagué — La Pola',
   'Ibagué',   'Tolima',      4.4353, -75.2300, 12.0, 0.0,  8.0, 0.0, 1.0, 0.0),

  ('D24', 'destino', 'Olímpica Ibagué — El Jordán',
   'Ibagué',   'Tolima',      4.4420, -75.2400, 11.0, 0.0,  7.0, 0.0, 1.0, 0.0),

  -- ── NEIVA (2 supermercados) ───────────────────────────────
  ('D25', 'destino', 'Éxito Lago — Neiva',
   'Neiva',    'Huila',       2.9280, -75.2850, 11.0, 0.0,  7.0, 0.0, 1.0, 0.0),

  ('D26', 'destino', 'Olímpica Neiva — San Pedro',
   'Neiva',    'Huila',       2.9400, -75.2950, 10.0, 0.0,  6.0, 0.0, 1.0, 0.0),

  -- ── TUNJA (2 supermercados) ───────────────────────────────
  ('D27', 'destino', 'Éxito Tunja — La Fuente',
   'Tunja',    'Boyacá',      5.5358, -73.3695, 11.0, 0.0,  7.0, 0.0, 1.0, 0.0),

  ('D28', 'destino', 'Olímpica Tunja — Centro',
   'Tunja',    'Boyacá',      5.5220, -73.3660, 10.0, 0.0,  6.0, 0.0, 1.0, 0.0),

  -- ── VILLAVICENCIO (2 supermercados) ──────────────────────
  ('D29', 'destino', 'Éxito Llano Center — Villavicencio',
   'Villavicencio', 'Meta',   4.1547, -73.6284, 15.0, 0.0, 10.0, 0.0, 1.0, 0.0),

  ('D30', 'destino', 'Olímpica Barzal — Villavicencio',
   'Villavicencio', 'Meta',   4.1340, -73.6380, 13.0, 0.0,  8.0, 0.0, 1.0, 0.0);


-- ============================================================
-- PASO 5 — ARISTAS (61 rutas)
-- Costo = 2.0 + distancia * 0.08  ($/ton)
-- Distancias en km por carretera (factor vial real incluido)
-- ============================================================

INSERT INTO public.aristas
  (id_origen, id_destino, costo_transporte, capacidad, distancia, estado, umbral_calidad)
VALUES

  -- ══════════════════════════════════════════════════════════
  -- BLOQUE A: ORÍGENES → ACOPIOS (primer tramo)
  -- Las estaciones están en zonas rurales remotas.
  -- El producto llega primero al hub regional más cercano.
  -- ══════════════════════════════════════════════════════════

  -- O1 Puerto López → A1 Villavicencio (80 km por ruta 40)
  ('O1','A1',  9.20,  80.0,  90.0, 'activa', 0.0),
  -- O1 Puerto López → A2 Bogotá (195 km vía Villavicencio)
  ('O1','A2', 17.60,  60.0, 195.0, 'activa', 0.0),

  -- O2 Puerto Gaitán → A1 Villavicencio (150 km por llanos)
  ('O2','A1', 14.00,  70.0, 150.0, 'activa', 0.0),
  -- O2 Puerto Gaitán → A2 Bogotá (via Apiay, ~290 km)
  ('O2','A2', 25.20,  45.0, 290.0, 'activa', 0.0),

  -- O3 San Martín → A1 Villavicencio (65 km ruta 40)
  ('O3','A1',  7.20,  60.0,  65.0, 'activa', 0.0),
  -- O3 San Martín → A9 Neiva (280 km vía Acacías)
  ('O3','A9', 24.40,  45.0, 280.0, 'activa', 0.0),

  -- O4 Girardot → A2 Bogotá (135 km autopista Sur)
  ('O4','A2', 12.80,  60.0, 135.0, 'activa', 0.0),
  -- O4 Girardot → A8 Ibagué (85 km ruta 40 Magdalena)
  ('O4','A8',  8.80,  55.0,  85.0, 'activa', 0.0),
  -- O4 Girardot → A4 Cali (295 km vía Ibagué–Armenia)
  ('O4','A4', 25.60,  35.0, 295.0, 'activa', 0.0),

  -- O5 Fusagasugá → A2 Bogotá (65 km autopista Sur)
  ('O5','A2',  7.20,  75.0,  65.0, 'activa', 0.0),
  -- O5 Fusagasugá → A8 Ibagué (130 km vía Girardot)
  ('O5','A8', 12.40,  55.0, 130.0, 'activa', 0.0),

  -- O6 La Palma → A2 Bogotá (165 km vía Villeta)
  ('O6','A2', 15.20,  65.0, 165.0, 'activa', 0.0),
  -- O6 La Palma → A10 Tunja (115 km vía Chiquinquirá)
  ('O6','A10',11.20,  50.0, 115.0, 'activa', 0.0),

  -- ══════════════════════════════════════════════════════════
  -- BLOQUE B: ACOPIOS → ACOPIOS (redistribución nacional)
  -- Rutas largas entre hubs — aquí se ven las distancias reales
  -- y los cuellos de botella del sistema
  -- ══════════════════════════════════════════════════════════

  -- A1 Villavicencio → A2 Bogotá (115 km vía La Calera / Buena Vista)
  ('A1','A2', 11.20, 130.0, 115.0, 'activa', 0.0),

  -- A2 Bogotá → A3 Medellín (415 km vía Manizales / autopista Medellín)
  ('A2','A3', 35.20, 150.0, 415.0, 'activa', 0.0),
  -- A2 Bogotá → A4 Cali (460 km vía túnel La Línea)
  ('A2','A4', 38.80, 100.0, 460.0, 'activa', 0.0),
  -- A2 Bogotá → A5 Bucaramanga (400 km vía autopista al Llano / Sogamoso)
  ('A2','A5', 34.00, 100.0, 400.0, 'activa', 0.0),
  -- A2 Bogotá → A6 Barranquilla (1050 km vía Bucaramanga / Valledupar)
  ('A2','A6', 86.00,  70.0,1050.0, 'activa', 0.0),
  -- A2 Bogotá → A7 Pereira (290 km vía Armenia)
  ('A2','A7', 25.20, 120.0, 290.0, 'activa', 0.0),
  -- A2 Bogotá → A8 Ibagué (200 km autopista al Llano)
  ('A2','A8', 18.00, 110.0, 200.0, 'activa', 0.0),
  -- A2 Bogotá → A10 Tunja (150 km autopista Norte)
  ('A2','A10',14.00, 100.0, 150.0, 'activa', 0.0),

  -- A3 Medellín → A4 Cali (415 km vía Cartago)
  ('A3','A4', 35.20, 120.0, 415.0, 'activa', 0.0),
  -- A3 Medellín → A6 Barranquilla (640 km vía Montería / Sincelejo)
  ('A3','A6', 53.20,  80.0, 640.0, 'activa', 0.0),
  -- A3 Medellín → A7 Pereira (175 km vía Santa Rosa)
  ('A3','A7', 16.00, 100.0, 175.0, 'activa', 0.0),

  -- A4 Cali → A9 Neiva (305 km vía Popayán)
  ('A4','A9', 26.40,  80.0, 305.0, 'activa', 0.0),

  -- A5 Bucaramanga → A6 Barranquilla (480 km vía Bosconia / Valledupar)
  ('A5','A6', 40.40,  90.0, 480.0, 'activa', 0.0),

  -- A7 Pereira → A4 Cali (215 km vía Cartago)
  ('A7','A4', 19.20, 100.0, 215.0, 'activa', 0.0),

  -- A8 Ibagué → A4 Cali (350 km vía Armenia)
  ('A8','A4', 30.00,  90.0, 350.0, 'activa', 0.0),
  -- A8 Ibagué → A9 Neiva (195 km vía Campoalegre)
  ('A8','A9', 17.60, 100.0, 195.0, 'activa', 0.0),

  -- A9 Neiva → A4 Cali (305 km vía Popayán — ruta alternativa)
  ('A9','A4', 26.40,  75.0, 305.0, 'activa', 0.0),

  -- A10 Tunja → A5 Bucaramanga (280 km vía San Gil)
  ('A10','A5',24.40,  80.0, 280.0, 'activa', 0.0),

  -- ══════════════════════════════════════════════════════════
  -- BLOQUE C: ACOPIOS → SUPERMERCADOS (última milla)
  -- Distribución urbana dentro de cada ciudad
  -- ══════════════════════════════════════════════════════════

  -- A2 Bogotá → Supermercados Bogotá (D1–D6)
  ('A2','D1',  2.96,  30.0,  12.0, 'activa', 0.0),  -- A2→Éxito 170 (norte)
  ('A2','D2',  2.64,  28.0,   8.0, 'activa', 0.0),  -- A2→Jumbo Calle 80
  ('A2','D3',  2.40,  32.0,   5.0, 'activa', 0.0),  -- A2→Carulla Unicentro
  ('A2','D4',  3.12,  25.0,  14.0, 'activa', 0.0),  -- A2→Éxito Hayuelos (oeste)
  ('A2','D5',  2.48,  24.0,   6.0, 'activa', 0.0),  -- A2→Jumbo El Campín
  ('A2','D6',  2.32,  26.0,   4.0, 'activa', 0.0),  -- A2→Carulla Chapinero

  -- A3 Medellín → Supermercados Medellín (D7–D10)
  ('A3','D7',  2.40,  22.0,   5.0, 'activa', 0.0),  -- Éxito Oviedo
  ('A3','D8',  2.96,  20.0,  12.0, 'activa', 0.0),  -- Jumbo Bello (norte)
  ('A3','D9',  2.48,  18.0,   6.0, 'activa', 0.0),  -- Carulla El Tesoro (sur)
  ('A3','D10', 2.24,  17.0,   3.0, 'activa', 0.0),  -- Éxito Laureles

  -- A4 Cali → Supermercados Cali (D11–D14)
  ('A4','D11', 2.40,  20.0,   5.0, 'activa', 0.0),  -- Éxito Chipichape
  ('A4','D12', 2.24,  18.0,   3.0, 'activa', 0.0),  -- Jumbo Calima
  ('A4','D13', 2.24,  16.0,   3.0, 'activa', 0.0),  -- La 14 Calima
  ('A4','D14', 2.64,  15.0,   8.0, 'activa', 0.0),  -- Éxito Unicentro (norte)

  -- A5 Bucaramanga → Supermercados Bucaramanga/Floridablanca (D15–D17)
  ('A5','D15', 2.32,  16.0,   4.0, 'activa', 0.0),  -- Éxito Cabecera
  ('A5','D16', 2.24,  14.0,   3.0, 'activa', 0.0),  -- Jumbo Cañaveral
  ('A5','D17', 2.56,  12.0,   7.0, 'activa', 0.0),  -- Olímpica Floridablanca

  -- A6 Barranquilla → Supermercados Barranquilla (D18–D20)
  ('A6','D18', 2.96,  18.0,  12.0, 'activa', 0.0),  -- Éxito Buenavista (norte)
  ('A6','D19', 2.48,  16.0,   6.0, 'activa', 0.0),  -- Jumbo Country
  ('A6','D20', 2.24,  14.0,   3.0, 'activa', 0.0),  -- Olímpica Centro

  -- A7 Pereira → Supermercados Pereira (D21–D22)
  ('A7','D21', 2.16,  14.0,   2.0, 'activa', 0.0),  -- Éxito Unicentro
  ('A7','D22', 2.40,  12.0,   5.0, 'activa', 0.0),  -- Jumbo Cuba (sur)

  -- A8 Ibagué → Supermercados Ibagué (D23–D24)
  ('A8','D23', 2.16,  12.0,   2.0, 'activa', 0.0),  -- Éxito La Pola
  ('A8','D24', 2.24,  11.0,   3.0, 'activa', 0.0),  -- Olímpica El Jordán

  -- A9 Neiva → Supermercados Neiva (D25–D26)
  ('A9','D25', 2.16,  11.0,   2.0, 'activa', 0.0),  -- Éxito Lago
  ('A9','D26', 2.24,  10.0,   3.0, 'activa', 0.0),  -- Olímpica San Pedro

  -- A10 Tunja → Supermercados Tunja (D27–D28)
  ('A10','D27',2.16,  11.0,   2.0, 'activa', 0.0),  -- Éxito La Fuente
  ('A10','D28',2.24,  10.0,   3.0, 'activa', 0.0),  -- Olímpica Centro

  -- A1 Villavicencio → Supermercados Villavicencio (D29–D30)
  ('A1','D29', 2.16,  15.0,   2.0, 'activa', 0.0),  -- Éxito Llano Center
  ('A1','D30', 2.24,  13.0,   3.0, 'activa', 0.0);  -- Olímpica Barzal


-- ============================================================
-- VERIFICACIÓN RÁPIDA
-- ============================================================

-- Total nodos esperados: 6 + 10 + 30 = 46
SELECT tipo, COUNT(*) AS cantidad FROM public.nodos GROUP BY tipo ORDER BY tipo;

-- Total aristas esperadas: 13 + 18 + 30 = 61
SELECT COUNT(*) AS total_aristas FROM public.aristas;

-- Oferta total vs Demanda total
SELECT
  (SELECT SUM(oferta) FROM public.nodos WHERE tipo = 'origen') AS oferta_total,
  (SELECT SUM(demanda) FROM public.nodos WHERE tipo = 'destino') AS demanda_total,
  (SELECT SUM(oferta) FROM public.nodos WHERE tipo = 'origen') -
  (SELECT SUM(demanda) FROM public.nodos WHERE tipo = 'destino') AS superavit;
