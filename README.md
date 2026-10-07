# Tesorería Oltremare

Aplicación de escritorio para la tesorería de la asociación: registro de cobros de **cursado** y **cuota societaria**, control de pendientes por mes y envío de recibos por **WhatsApp**.

Hecha con [Tauri 2](https://tauri.app) + React + TypeScript. Los datos se guardan en SQLite local mediante `tauri-plugin-sql`.

## Desarrollo

```bash
npm install
npm run tauri dev     # abre la app en modo desarrollo
npm run tauri build   # genera el instalador en src-tauri/target/release/bundle
```

## Funcionalidades

- **Alumnos y socios**: alta/edición de personas, marca de socio, inscripción a cursos e **importación desde CSV**.
- **Cursos**: cada curso tiene su cuota mensual.
- **Pendientes**: para el mes elegido lista, por persona, la cuota societaria y los cursados sin cobrar. *Cobrar* arma el recibo con esos ítems; *Recordar* envía un recordatorio por WhatsApp.
- **Cobros y recibos**: cada recibo agrupa varios ítems (cuota societaria + cursado, inscripción, otros), con numeración correlativa automática, anulación, impresión y envío por WhatsApp.
- **Configuración**: nombre de la asociación, monto de la cuota societaria, prefijo telefónico y plantilla del mensaje.

## Base de datos

- Archivo: `%APPDATA%\com.oltremare.tesoreria\tesoreria.db`.
- Esquema: [src-tauri/migrations](src-tauri/migrations). Las migraciones se registran en [src-tauri/src/lib.rs](src-tauri/src/lib.rs) y se aplican solas al abrir la app. Para cambiar el esquema, agregar un archivo nuevo (`002_...sql`) y sumarlo a la lista — nunca editar uno ya aplicado.
- Los montos se guardan en **centavos** (enteros).

## Importar alumnos

En *Alumnos y socios → Importar CSV*. Columnas: `apellido; nombre; dni; telefono; email; curso; socio; activo` (el curso debe coincidir con uno cargado; varios se separan con `+`). Las personas existentes no se duplican: solo se completan datos faltantes.

Las planillas originales y el CSV generado van en `datos/`, que **no se versiona** (datos personales).

## WhatsApp

El envío abre `wa.me` con el mensaje del recibo ya escrito; solo hay que tocar *Enviar* en WhatsApp. Los teléfonos se cargan como característica + número, sin 0 ni 15 (ej. `3415551234`); la app antepone el prefijo configurado (`549` para Argentina).
