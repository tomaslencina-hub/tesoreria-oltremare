-- Montos guardados en centavos (INTEGER) para evitar errores de redondeo.
-- Fechas en formato ISO 'YYYY-MM-DD'; periodos en formato 'YYYY-MM'.

CREATE TABLE configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
);

INSERT INTO configuracion (clave, valor) VALUES
    ('nombre_asociacion', 'Asociación Oltremare'),
    ('cuota_social', '0'),
    ('prefijo_whatsapp', '549'),
    ('plantilla_whatsapp',
     'Hola {nombre}! Te enviamos el recibo N° {numero} de {asociacion}.' || char(10) ||
     'Concepto: {concepto}' || char(10) ||
     'Período: {periodo}' || char(10) ||
     'Monto: {monto}' || char(10) ||
     'Fecha: {fecha}' || char(10) ||
     'Grazie mille!');

CREATE TABLE personas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL,
    apellido    TEXT NOT NULL,
    dni         TEXT,
    telefono    TEXT,
    email       TEXT,
    es_socio    INTEGER NOT NULL DEFAULT 0,
    activo      INTEGER NOT NULL DEFAULT 1,
    notas       TEXT,
    creado_en   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE cursos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre         TEXT NOT NULL,
    nivel          TEXT,
    cuota_mensual  INTEGER NOT NULL DEFAULT 0,
    activo         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE inscripciones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id  INTEGER NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    curso_id    INTEGER NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    fecha_alta  TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    activo      INTEGER NOT NULL DEFAULT 1,
    UNIQUE (persona_id, curso_id)
);

CREATE TABLE pagos (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_recibo        INTEGER NOT NULL UNIQUE,
    persona_id           INTEGER NOT NULL REFERENCES personas(id),
    tipo                 TEXT NOT NULL CHECK (tipo IN ('cursado', 'cuota_social', 'otro')),
    curso_id             INTEGER REFERENCES cursos(id),
    periodo              TEXT,
    concepto             TEXT NOT NULL,
    monto                INTEGER NOT NULL,
    medio_pago           TEXT NOT NULL DEFAULT 'efectivo',
    fecha                TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    observaciones        TEXT,
    anulado              INTEGER NOT NULL DEFAULT 0,
    enviado_whatsapp_en  TEXT
);

CREATE INDEX idx_pagos_persona ON pagos (persona_id);
CREATE INDEX idx_pagos_periodo ON pagos (tipo, periodo);
