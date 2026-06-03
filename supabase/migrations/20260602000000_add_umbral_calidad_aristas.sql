-- Migración: asegurar la columna `umbral_calidad` en la tabla `aristas`.
-- La tabla desplegada se creó sin esta columna, por lo que las operaciones de
-- creación/edición de rutas no podían persistir el umbral de calidad.
-- Idempotente: se puede ejecutar de forma segura aunque la columna ya exista.

ALTER TABLE aristas
    ADD COLUMN IF NOT EXISTS umbral_calidad DOUBLE PRECISION DEFAULT 0;
