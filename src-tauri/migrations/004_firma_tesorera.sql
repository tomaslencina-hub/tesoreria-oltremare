-- En los recibos va el nombre de quien está a cargo de la tesorería en lugar de la firma.
UPDATE configuracion SET valor = 'Mabel Malandra' WHERE clave = 'firmante' AND valor = 'Tesorero';
INSERT INTO configuracion (clave, valor) VALUES ('cargo_firmante', 'Tesorera');
