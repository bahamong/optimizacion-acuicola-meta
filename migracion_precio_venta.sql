-- ============================================================
-- MIGRACIÓN — precio_venta por destino
-- Acuícola Real del Meta
--
-- Ejecutar en el SQL Editor de Supabase ANTES de desplegar el
-- backend con el Cambio 4. Sin esta columna, el sistema cae al
-- precio global (config.PRECIO_VENTA_TON) — la app sigue funcionando,
-- pero no usa precios diferenciados por supermercado.
-- ============================================================

ALTER TABLE public.nodos
  ADD COLUMN IF NOT EXISTS precio_venta double precision DEFAULT 250.0;

-- Asegurar que los destinos existentes tengan un precio definido.
UPDATE public.nodos
   SET precio_venta = 250.0
 WHERE tipo = 'destino'
   AND precio_venta IS NULL;
