-- Migración: Red Logística Acuícola Real del Meta
-- Tablas principales + datos por defecto

-- ── Tabla de nodos ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nodos (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('origen', 'acopio', 'destino')),
    nombre TEXT NOT NULL,
    municipio TEXT DEFAULT '',
    departamento TEXT DEFAULT '',
    latitud DOUBLE PRECISION DEFAULT 0,
    longitud DOUBLE PRECISION DEFAULT 0,
    capacidad DOUBLE PRECISION DEFAULT 0,
    oferta DOUBLE PRECISION DEFAULT 0,
    demanda DOUBLE PRECISION DEFAULT 0,
    tasa_merma DOUBLE PRECISION DEFAULT 0,
    tasa_calidad DOUBLE PRECISION DEFAULT 1.0,
    costo_operacion DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabla de aristas ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aristas (
    id SERIAL PRIMARY KEY,
    id_origen TEXT NOT NULL,
    id_destino TEXT NOT NULL,
    costo_transporte DOUBLE PRECISION NOT NULL,
    capacidad DOUBLE PRECISION NOT NULL,
    distancia DOUBLE PRECISION NOT NULL,
    estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'bloqueada')),
    umbral_calidad DOUBLE PRECISION DEFAULT 0,
    UNIQUE(id_origen, id_destino)
);

-- ── Tabla de soluciones ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS soluciones (
    id SERIAL PRIMARY KEY,
    tipo_escenario TEXT DEFAULT 'base',
    ganancia_total DOUBLE PRECISION,
    costo_total DOUBLE PRECISION,
    num_rutas_activas INTEGER,
    porcentaje_demanda_cumplida DOUBLE PRECISION,
    flujos_json JSONB DEFAULT '{}',
    stocks_json JSONB DEFAULT '{}',
    metricas_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabla de historial de escenarios ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escenarios_historial (
    id SERIAL PRIMARY KEY,
    tipo TEXT NOT NULL,
    parametros_json JSONB DEFAULT '{}',
    ganancia_base DOUBLE PRECISION,
    ganancia_escenario DOUBLE PRECISION,
    impacto_absoluto DOUBLE PRECISION,
    impacto_porcentual DOUBLE PRECISION,
    resultado_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Restricción única en aristas (por si la tabla ya existía sin ella) ───────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'aristas_id_origen_id_destino_key'
          AND conrelid = 'aristas'::regclass
    ) THEN
        ALTER TABLE aristas
            ADD CONSTRAINT aristas_id_origen_id_destino_key
            UNIQUE (id_origen, id_destino);
    END IF;
END $$;

-- ── Tabla de caché de rutas OSRM ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rutas_osrm_cache (
    id SERIAL PRIMARY KEY,
    ruta_key TEXT UNIQUE NOT NULL,
    path_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Datos por defecto: Nodos ──────────────────────────────────────────────────
INSERT INTO nodos (id, tipo, nombre, municipio, departamento, latitud, longitud, capacidad, oferta, demanda, tasa_merma, tasa_calidad, costo_operacion) VALUES
('O1', 'origen', 'Estación Puerto López',   'Puerto López',  'Meta',         4.0854, -72.9508, 120, 120, 0, 0,    1.0,  0),
('O2', 'origen', 'Estación Puerto Gaitán',  'Puerto Gaitán', 'Meta',         4.3112, -72.0825, 100, 100, 0, 0,    1.0,  0),
('O3', 'origen', 'Estación San Martín',     'San Martín',    'Meta',         3.6931, -73.6997,  90,  90, 0, 0,    1.0,  0),
('O4', 'origen', 'Estación Girardot',       'Girardot',      'Cundinamarca', 4.3037, -74.8035,  80,  80, 0, 0,    1.0,  0),
('O5', 'origen', 'Estación Fusagasugá',     'Fusagasugá',    'Cundinamarca', 4.3373, -74.3637, 110, 110, 0, 0,    1.0,  0),
('O6', 'origen', 'Estación Facatativá',     'Facatativá',    'Cundinamarca', 4.8145, -74.3548,  95,  95, 0, 0,    1.0,  0),
('A1',  'acopio', 'Centro Bogotá',        'Bogotá',        'Cundinamarca', 4.7110, -74.0721, 200, 0, 0, 0.05, 0.95, 50.0),
('A2',  'acopio', 'Centro Villavicencio', 'Villavicencio', 'Meta',         4.1420, -73.6266, 150, 0, 0, 0.08, 0.92, 45.0),
('A3',  'acopio', 'Centro Soacha',        'Soacha',        'Cundinamarca', 4.5790, -74.2168, 140, 0, 0, 0.10, 0.90, 40.0),
('A4',  'acopio', 'Centro Zipaquirá',     'Zipaquirá',     'Cundinamarca', 5.0221, -74.0048, 120, 0, 0, 0.07, 0.93, 38.0),
('A5',  'acopio', 'Centro Acacías',       'Acacías',       'Meta',         3.9889, -73.7558, 110, 0, 0, 0.12, 0.88, 36.0),
('A6',  'acopio', 'Centro Granada',       'Granada',       'Meta',         3.5460, -73.7064, 100, 0, 0, 0.15, 0.85, 35.0),
('A7',  'acopio', 'Centro Chía',          'Chía',          'Cundinamarca', 4.8614, -74.0586, 120, 0, 0, 0.06, 0.94, 42.0),
('A8',  'acopio', 'Centro Mosquera',      'Mosquera',      'Cundinamarca', 4.7059, -74.2300, 110, 0, 0, 0.09, 0.91, 38.0),
('A9',  'acopio', 'Centro Cumaral',       'Cumaral',       'Meta',         4.2706, -73.4889,  90, 0, 0, 0.11, 0.89, 34.0),
('A10', 'acopio', 'Centro Madrid',        'Madrid',        'Cundinamarca', 4.7324, -74.2659, 100, 0, 0, 0.10, 0.90, 36.0),
('D1',  'destino', 'Súper Norte Bogotá',        'Bogotá',        'Cundinamarca', 4.7500, -74.0500, 30, 0, 18, 0, 1.0, 0),
('D2',  'destino', 'Súper Sur Bogotá',          'Bogotá',        'Cundinamarca', 4.6300, -74.1100, 25, 0, 15, 0, 1.0, 0),
('D3',  'destino', 'Súper Centro Bogotá',       'Bogotá',        'Cundinamarca', 4.6950, -74.0357, 35, 0, 20, 0, 1.0, 0),
('D4',  'destino', 'Súper Oriente Bogotá',      'Bogotá',        'Cundinamarca', 4.6800, -74.0000, 20, 0, 12, 0, 1.0, 0),
('D5',  'destino', 'Súper Occidente Bogotá',    'Bogotá',        'Cundinamarca', 4.6600, -74.1400, 25, 0, 16, 0, 1.0, 0),
('D6',  'destino', 'Súper Suba Bogotá',         'Bogotá',        'Cundinamarca', 4.7450, -74.0830, 22, 0, 14, 0, 1.0, 0),
('D7',  'destino', 'Súper Norte Villavicencio',  'Villavicencio', 'Meta',         4.1600, -73.6300, 20, 0, 13, 0, 1.0, 0),
('D8',  'destino', 'Súper Sur Villavicencio',    'Villavicencio', 'Meta',         4.1200, -73.6400, 18, 0, 11, 0, 1.0, 0),
('D9',  'destino', 'Súper Centro Villavicencio', 'Villavicencio', 'Meta',         4.1480, -73.6320, 25, 0, 15, 0, 1.0, 0),
('D10', 'destino', 'Súper Este Villavicencio',   'Villavicencio', 'Meta',         4.1500, -73.6100, 15, 0,  9, 0, 1.0, 0),
('D11', 'destino', 'Súper Centro Soacha',  'Soacha',    'Cundinamarca', 4.5840, -74.2230, 20, 0, 12, 0, 1.0, 0),
('D12', 'destino', 'Súper Norte Soacha',   'Soacha',    'Cundinamarca', 4.5900, -74.2100, 18, 0, 10, 0, 1.0, 0),
('D13', 'destino', 'Súper Centro Zipaquirá','Zipaquirá','Cundinamarca', 5.0270, -74.0010, 14, 0,  8, 0, 1.0, 0),
('D14', 'destino', 'Súper Sur Zipaquirá',   'Zipaquirá','Cundinamarca', 5.0100, -74.0100, 15, 0,  9, 0, 1.0, 0),
('D15', 'destino', 'Súper Centro Acacías',  'Acacías',  'Meta',         3.9940, -73.7610, 16, 0, 10, 0, 1.0, 0),
('D16', 'destino', 'Súper Norte Acacías',   'Acacías',  'Meta',         3.9950, -73.7500, 13, 0,  8, 0, 1.0, 0),
('D17', 'destino', 'Súper Centro Granada',  'Granada',  'Meta',         3.5510, -73.7110, 15, 0,  9, 0, 1.0, 0),
('D18', 'destino', 'Súper Sur Granada',     'Granada',  'Meta',         3.5400, -73.7100, 12, 0,  7, 0, 1.0, 0),
('D19', 'destino', 'Súper Centro Chía',     'Chía',     'Cundinamarca', 4.8660, -74.0540, 14, 0,  8, 0, 1.0, 0),
('D20', 'destino', 'Súper Norte Chía',      'Chía',     'Cundinamarca', 4.8700, -74.0500, 16, 0, 10, 0, 1.0, 0),
('D21', 'destino', 'Súper Centro Fusagasugá','Fusagasugá','Cundinamarca',4.3373,-74.3637, 12, 0,  7, 0, 1.0, 0),
('D22', 'destino', 'Súper Norte Fusagasugá', 'Fusagasugá','Cundinamarca',4.3450,-74.3600, 15, 0,  9, 0, 1.0, 0),
('D23', 'destino', 'Súper Centro Facatativá','Facatativá','Cundinamarca',4.8145,-74.3548, 18, 0, 11, 0, 1.0, 0),
('D24', 'destino', 'Súper Centro Girardot',  'Girardot', 'Cundinamarca', 4.3037,-74.8035, 12, 0,  7, 0, 1.0, 0),
('D25', 'destino', 'Súper Centro Cumaral',   'Cumaral',  'Meta',         4.2756,-73.4840, 13, 0,  8, 0, 1.0, 0)
ON CONFLICT (id) DO NOTHING;

-- ── Datos por defecto: Aristas ────────────────────────────────────────────────
INSERT INTO aristas (id_origen, id_destino, costo_transporte, capacidad, distancia) VALUES
('O1','A2', 9.82,80, 97.8), ('O1','A9', 8.57,50, 82.1),
('O2','A2',19.91,70,223.9), ('O2','A9',18.22,40,202.8),
('O3','A2', 7.26,60, 65.7), ('O3','A5', 5.48,50, 43.5), ('O3','A6', 3.70,50, 21.3),
('O4','A3', 9.48,60, 93.5), ('O4','A1',11.66,50,120.7),
('O5','A3', 5.27,70, 40.9), ('O5','A1', 7.47,60, 68.4),
('O6','A8', 3.91,70, 23.9), ('O6','A10',3.40,60, 17.5), ('O6','A1', 5.47,50, 43.4),
('A2','A1',10.34,120,104.3),('A5','A2', 4.31,60, 28.9),
('A6','A2', 8.95,50, 86.9), ('A9','A2', 4.18,50, 27.2),
('A1','A3', 4.26,80, 28.3), ('A1','A7', 3.74,80, 21.8), ('A1','A8', 3.82,70, 22.8),
('A7','A4', 3.96,50, 24.5), ('A10','A8',2.51,50,  6.4),
('A1','D1', 2.52,30,  6.5), ('A1','D2', 3.03,25, 12.9), ('A1','D3', 2.46,35,  5.7),
('A1','D4', 2.90,20, 11.3), ('A1','D5', 2.98,25, 12.2), ('A1','D6', 2.42,22,  5.2),
('A2','D7', 2.21,20,  2.6), ('A2','D8', 2.30,18,  3.7), ('A2','D9', 2.10,25,  1.2),
('A2','D10',2.22,15,  2.7),
('A3','D11',2.09,20,  1.1), ('A3','D12',2.15,18,  1.9),
('A4','D13',2.07,14,  0.9), ('A4','D14',2.15,15,  1.9),
('A5','D15',2.09,16,  1.1), ('A5','D16',2.10,13,  1.2),
('A6','D17',2.08,15,  1.0), ('A6','D18',2.08,12,  1.0),
('A7','D19',2.07,14,  0.9), ('A7','D20',2.14,16,  1.8),
('A3','D21',5.27,14, 40.9), ('A3','D22',5.17,15, 39.6),
('A10','D23',3.40,18,17.5),
('A3','D24',9.48,12, 93.5),
('A9','D25',2.08,13,  1.0)
ON CONFLICT (id_origen, id_destino) DO NOTHING;
