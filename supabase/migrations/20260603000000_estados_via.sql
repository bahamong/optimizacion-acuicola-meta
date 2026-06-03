-- Migración: Estados (situaciones) de la vía
-- Permite todos los estados de ruta, no solo 'activa' / 'bloqueada'.
-- El costo total se deriva del estado (costo base * multiplicador), por lo que
-- no se almacena: solo se persiste el costo base (costo_transporte) y el estado.

ALTER TABLE aristas DROP CONSTRAINT IF EXISTS aristas_estado_check;

ALTER TABLE aristas
    ADD CONSTRAINT aristas_estado_check
    CHECK (estado IN ('activa', 'gasolina_alta', 'via_deteriorada', 'bloqueada'));
