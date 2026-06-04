-- Las aristas manuales pasan a funcionar como reglas/restricciones sobre
-- rutas generadas automaticamente.

ALTER TABLE aristas
    ADD COLUMN IF NOT EXISTS factor_costo DOUBLE PRECISION DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS penalizacion DOUBLE PRECISION DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS fuente_distancia TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS generada_automaticamente BOOLEAN DEFAULT FALSE;

UPDATE aristas
SET
    factor_costo = COALESCE(factor_costo, 1.0),
    penalizacion = COALESCE(penalizacion, 0.0),
    fuente_distancia = COALESCE(fuente_distancia, 'manual'),
    generada_automaticamente = COALESCE(generada_automaticamente, FALSE);
