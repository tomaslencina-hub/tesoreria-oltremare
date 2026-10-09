-- Recargo opcional al cobrar. `monto` de cada ítem ya incluye el recargo;
-- `recargo` guarda qué parte de ese monto corresponde al recargo (0 si no se aplicó).
ALTER TABLE recibo_items ADD COLUMN recargo INTEGER NOT NULL DEFAULT 0;

INSERT INTO configuracion (clave, valor) VALUES ('recargo_porcentaje', '10');
