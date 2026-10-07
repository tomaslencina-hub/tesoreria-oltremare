-- Datos que figuran en el encabezado de los recibos en papel.
INSERT INTO configuracion (clave, valor) VALUES
    ('direccion', 'Dorrego 2472 - Villa Constitución'),
    ('personeria', 'Personería Jurídica Resolución Nº 206'),
    ('cuit', '30-71517170-4'),
    ('firmante', 'Tesorero');

UPDATE configuracion SET valor = 'Oltremare - Asociación Cultural Ítalo Argentina'
 WHERE clave = 'nombre_asociacion' AND valor = 'Asociación Oltremare';
