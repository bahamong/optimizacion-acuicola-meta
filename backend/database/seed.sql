-- ================================================================
-- seed.sql — Acuícola Real del Meta
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ================================================================

-- 1. TABLAS
CREATE TABLE IF NOT EXISTS nodos (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  municipio TEXT,
  departamento TEXT,
  latitud DOUBLE PRECISION,
  longitud DOUBLE PRECISION,
  capacidad DOUBLE PRECISION DEFAULT 0.0,
  oferta DOUBLE PRECISION DEFAULT 0.0,
  demanda DOUBLE PRECISION DEFAULT 0.0,
  tasa_merma DOUBLE PRECISION DEFAULT 0.0,
  tasa_calidad DOUBLE PRECISION DEFAULT 1.0,
  costo_operacion DOUBLE PRECISION DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS aristas (
  id SERIAL PRIMARY KEY,
  id_origen TEXT NOT NULL,
  id_destino TEXT NOT NULL,
  costo_transporte DOUBLE PRECISION NOT NULL,
  capacidad DOUBLE PRECISION NOT NULL,
  distancia DOUBLE PRECISION NOT NULL,
  estado TEXT DEFAULT 'activa'
);

CREATE TABLE IF NOT EXISTS soluciones (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  tipo_escenario TEXT DEFAULT 'base',
  ganancia_total DOUBLE PRECISION,
  costo_total DOUBLE PRECISION,
  num_rutas_activas INTEGER,
  porcentaje_demanda_cumplida DOUBLE PRECISION,
  flujos_json TEXT,
  stocks_json TEXT,
  metricas_json TEXT,
  grafo_json TEXT
);

CREATE TABLE IF NOT EXISTS escenarios_historial (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  tipo TEXT NOT NULL,
  parametros_json TEXT,
  ganancia_base DOUBLE PRECISION,
  ganancia_escenario DOUBLE PRECISION,
  impacto_absoluto DOUBLE PRECISION,
  impacto_porcentual DOUBLE PRECISION,
  resultado_json TEXT
);

CREATE TABLE IF NOT EXISTS cache_visualizacion (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  grafo_json TEXT NOT NULL
);

-- 2. SEED NODOS (41 nodos)
TRUNCATE TABLE nodos RESTART IDENTITY CASCADE;
INSERT INTO nodos VALUES ('O1','origen','Estación Puerto López','Puerto López','Meta',4.0854,-72.9508,120.0,120.0,0.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('O2','origen','Estación Puerto Gaitán','Puerto Gaitán','Meta',4.3112,-72.0825,100.0,100.0,0.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('O3','origen','Estación San Martín','San Martín','Meta',3.6931,-73.6997,90.0,90.0,0.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('O4','origen','Estación Girardot','Girardot','Cundinamarca',4.3037,-74.8035,80.0,80.0,0.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('O5','origen','Estación Fusagasugá','Fusagasugá','Cundinamarca',4.3373,-74.3637,110.0,110.0,0.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('O6','origen','Estación Facatativá','Facatativá','Cundinamarca',4.8145,-74.3548,95.0,95.0,0.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('A1','acopio','Centro Bogotá','Bogotá','Cundinamarca',4.711,-74.0721,200.0,0.0,0.0,0.05,0.95,50.0);
INSERT INTO nodos VALUES ('A2','acopio','Centro Villavicencio','Villavicencio','Meta',4.142,-73.6266,150.0,0.0,0.0,0.08,0.92,45.0);
INSERT INTO nodos VALUES ('A3','acopio','Centro Soacha','Soacha','Cundinamarca',4.579,-74.2168,140.0,0.0,0.0,0.1,0.9,40.0);
INSERT INTO nodos VALUES ('A4','acopio','Centro Zipaquirá','Zipaquirá','Cundinamarca',5.0221,-74.0048,120.0,0.0,0.0,0.07,0.93,38.0);
INSERT INTO nodos VALUES ('A5','acopio','Centro Acacías','Acacías','Meta',3.9889,-73.7558,110.0,0.0,0.0,0.12,0.88,36.0);
INSERT INTO nodos VALUES ('A6','acopio','Centro Granada','Granada','Meta',3.546,-73.7064,100.0,0.0,0.0,0.15,0.85,35.0);
INSERT INTO nodos VALUES ('A7','acopio','Centro Chía','Chía','Cundinamarca',4.8614,-74.0586,120.0,0.0,0.0,0.06,0.94,42.0);
INSERT INTO nodos VALUES ('A8','acopio','Centro Mosquera','Mosquera','Cundinamarca',4.7059,-74.23,110.0,0.0,0.0,0.09,0.91,38.0);
INSERT INTO nodos VALUES ('A9','acopio','Centro Cumaral','Cumaral','Meta',4.2706,-73.4889,90.0,0.0,0.0,0.11,0.89,34.0);
INSERT INTO nodos VALUES ('A10','acopio','Centro Madrid','Madrid','Cundinamarca',4.7324,-74.2659,100.0,0.0,0.0,0.1,0.9,36.0);
INSERT INTO nodos VALUES ('D1','destino','Súper Norte Bogotá','Bogotá','Cundinamarca',4.75,-74.05,30.0,0.0,18.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D2','destino','Súper Sur Bogotá','Bogotá','Cundinamarca',4.63,-74.11,25.0,0.0,15.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D3','destino','Súper Centro Bogotá','Bogotá','Cundinamarca',4.695,-74.0357,35.0,0.0,20.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D4','destino','Súper Oriente Bogotá','Bogotá','Cundinamarca',4.68,-74.0,20.0,0.0,12.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D5','destino','Súper Occidente Bogotá','Bogotá','Cundinamarca',4.66,-74.14,25.0,0.0,16.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D6','destino','Súper Suba Bogotá','Bogotá','Cundinamarca',4.745,-74.083,22.0,0.0,14.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D7','destino','Súper Norte Villavicencio','Villavicencio','Meta',4.16,-73.63,20.0,0.0,13.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D8','destino','Súper Sur Villavicencio','Villavicencio','Meta',4.12,-73.64,18.0,0.0,11.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D9','destino','Súper Centro Villavicencio','Villavicencio','Meta',4.148,-73.632,25.0,0.0,15.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D10','destino','Súper Este Villavicencio','Villavicencio','Meta',4.15,-73.61,15.0,0.0,9.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D11','destino','Súper Centro Soacha','Soacha','Cundinamarca',4.584,-74.223,20.0,0.0,12.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D12','destino','Súper Norte Soacha','Soacha','Cundinamarca',4.59,-74.21,18.0,0.0,10.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D13','destino','Súper Centro Zipaquirá','Zipaquirá','Cundinamarca',5.027,-74.001,14.0,0.0,8.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D14','destino','Súper Sur Zipaquirá','Zipaquirá','Cundinamarca',5.01,-74.01,15.0,0.0,9.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D15','destino','Súper Centro Acacías','Acacías','Meta',3.994,-73.761,16.0,0.0,10.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D16','destino','Súper Norte Acacías','Acacías','Meta',3.995,-73.75,13.0,0.0,8.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D17','destino','Súper Centro Granada','Granada','Meta',3.551,-73.711,15.0,0.0,9.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D18','destino','Súper Sur Granada','Granada','Meta',3.54,-73.71,12.0,0.0,7.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D19','destino','Súper Centro Chía','Chía','Cundinamarca',4.866,-74.054,14.0,0.0,8.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D20','destino','Súper Norte Chía','Chía','Cundinamarca',4.87,-74.05,16.0,0.0,10.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D21','destino','Súper Centro Fusagasugá','Fusagasugá','Cundinamarca',4.3373,-74.3637,12.0,0.0,7.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D22','destino','Súper Norte Fusagasugá','Fusagasugá','Cundinamarca',4.345,-74.36,15.0,0.0,9.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D23','destino','Súper Centro Facatativá','Facatativá','Cundinamarca',4.8145,-74.3548,18.0,0.0,11.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D24','destino','Súper Centro Girardot','Girardot','Cundinamarca',4.3037,-74.8035,12.0,0.0,7.0,0,1.0,0.0);
INSERT INTO nodos VALUES ('D25','destino','Súper Centro Cumaral','Cumaral','Meta',4.2756,-73.484,13.0,0.0,8.0,0,1.0,0.0);

-- 3. SEED ARISTAS (48 conexiones)
TRUNCATE TABLE aristas RESTART IDENTITY CASCADE;
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O1','A2',9.82,80.0,97.8,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O1','A9',8.57,50.0,82.1,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O2','A2',19.91,70.0,223.9,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O2','A9',18.22,40.0,202.8,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O3','A2',7.26,60.0,65.7,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O3','A5',5.48,50.0,43.5,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O3','A6',3.7,50.0,21.3,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O4','A3',9.48,60.0,93.5,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O4','A1',11.66,50.0,120.7,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O5','A3',5.27,70.0,40.9,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O5','A1',7.47,60.0,68.4,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O6','A8',3.91,70.0,23.9,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O6','A10',3.4,60.0,17.5,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('O6','A1',5.47,50.0,43.4,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A2','A1',10.34,120.0,104.3,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A5','A2',4.31,60.0,28.9,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A6','A2',8.95,50.0,86.9,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A9','A2',4.18,50.0,27.2,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A1','A3',4.26,80.0,28.3,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A1','A7',3.74,80.0,21.8,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A1','A8',3.82,70.0,22.8,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A7','A4',3.96,50.0,24.5,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A10','A8',2.51,50.0,6.4,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A1','D1',2.52,30.0,6.5,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A1','D2',3.03,25.0,12.9,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A1','D3',2.46,35.0,5.7,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A1','D4',2.9,20.0,11.3,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A1','D5',2.98,25.0,12.2,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A1','D6',2.42,22.0,5.2,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A2','D7',2.21,20.0,2.6,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A2','D8',2.3,18.0,3.7,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A2','D9',2.1,25.0,1.2,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A2','D10',2.22,15.0,2.7,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A3','D11',2.09,20.0,1.1,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A3','D12',2.15,18.0,1.9,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A4','D13',2.07,14.0,0.9,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A4','D14',2.15,15.0,1.9,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A5','D15',2.09,16.0,1.1,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A5','D16',2.1,13.0,1.2,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A6','D17',2.08,15.0,1.0,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A6','D18',2.08,12.0,1.0,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A7','D19',2.07,14.0,0.9,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A7','D20',2.14,16.0,1.8,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A3','D21',5.27,14.0,40.9,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A3','D22',5.17,15.0,39.6,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A10','D23',3.4,18.0,17.5,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A3','D24',9.48,12.0,93.5,'activa');
INSERT INTO aristas (id_origen,id_destino,costo_transporte,capacidad,distancia,estado) VALUES ('A9','D25',2.08,13.0,1.0,'activa');
