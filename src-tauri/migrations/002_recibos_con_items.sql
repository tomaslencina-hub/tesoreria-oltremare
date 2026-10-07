-- Un recibo agrupa varios ítems (ej. cuota societaria + cursado del mes),
-- tal como se cobra en la práctica. Reemplaza a la tabla `pagos` (vacía hasta acá).

DROP TABLE pagos;

CREATE TABLE recibos (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    numero               INTEGER NOT NULL UNIQUE,
    persona_id           INTEGER NOT NULL REFERENCES personas(id),
    fecha                TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    medio_pago           TEXT NOT NULL DEFAULT 'efectivo',
    total                INTEGER NOT NULL,
    observaciones        TEXT,
    anulado              INTEGER NOT NULL DEFAULT 0,
    enviado_whatsapp_en  TEXT,
    creado_en            TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE recibo_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    recibo_id  INTEGER NOT NULL REFERENCES recibos(id) ON DELETE CASCADE,
    tipo       TEXT NOT NULL CHECK (tipo IN ('cuota_social', 'cursado', 'inscripcion', 'otro')),
    curso_id   INTEGER REFERENCES cursos(id),
    periodo    TEXT,
    concepto   TEXT NOT NULL,
    monto      INTEGER NOT NULL
);

CREATE INDEX idx_recibos_persona ON recibos (persona_id);
CREATE INDEX idx_items_recibo ON recibo_items (recibo_id);
CREATE INDEX idx_items_periodo ON recibo_items (tipo, periodo);

-- Cursos y cuotas 2026 (montos en centavos).
INSERT INTO cursos (nombre, nivel, cuota_mensual) VALUES
    ('Primero', '1°', 3300000),
    ('Segundo', '2°', 3300000),
    ('Tercero', '3°', 3300000),
    ('Cuarto', '4°', 3300000),
    ('Quinto', '5°', 3300000),
    ('Conversación', NULL, 3300000),
    ('Intensivo', NULL, 4300000);

UPDATE configuracion SET valor = '200000' WHERE clave = 'cuota_social';

-- Mismo formato que se usaba desde la planilla.
UPDATE configuracion SET valor =
    '*RECIBO DE PAGO N° {numero}*' || char(10) ||
    '{asociacion}' || char(10) || char(10) ||
    'Hola {nombre}, queremos confirmar que recibimos tu pago.' || char(10) || char(10) ||
    '*Detalle:*' || char(10) ||
    '{detalle}' || char(10) ||
    '*Total abonado: {total}*' || char(10) ||
    'Fecha de pago: {fecha}' || char(10) || char(10) ||
    '¡Muchas gracias por tu pago!'
WHERE clave = 'plantilla_whatsapp';

INSERT INTO configuracion (clave, valor) VALUES ('plantilla_recordatorio',
    'Hola {nombre}! Te recordamos que está pendiente el pago de {periodo}:' || char(10) ||
    '{detalle}' || char(10) ||
    '*Total: {total}*' || char(10) || char(10) ||
    'Si ya lo abonaste, desestimá este mensaje. Grazie!');
