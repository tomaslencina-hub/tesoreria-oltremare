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

- **Alumnos y socios**: alta/edición de personas, marca de socio e inscripción a cursos.
- **Cursos**: cada curso tiene su cuota mensual.
- **Pendientes**: para el mes elegido lista quién debe la cuota societaria (socios activos) y el cursado (inscripciones activas desde el mes de alta). Un clic en *Cobrar* precarga el cobro.
- **Cobros y recibos**: numeración correlativa automática, anulación, impresión y envío por WhatsApp.
- **Configuración**: nombre de la asociación, monto de la cuota societaria, prefijo telefónico y plantilla del mensaje.

## Base de datos

- Archivo: `%APPDATA%\com.oltremare.tesoreria\tesoreria.db`.
- Esquema: [src-tauri/migrations](src-tauri/migrations). Las migraciones se registran en [src-tauri/src/lib.rs](src-tauri/src/lib.rs) y se aplican solas al abrir la app. Para cambiar el esquema, agregar un archivo nuevo (`002_...sql`) y sumarlo a la lista — nunca editar uno ya aplicado.
- Los montos se guardan en **centavos** (enteros).

## WhatsApp

El envío abre `wa.me` con el mensaje del recibo ya escrito; solo hay que tocar *Enviar* en WhatsApp. Los teléfonos se cargan como característica + número, sin 0 ni 15 (ej. `3415551234`); la app antepone el prefijo configurado (`549` para Argentina).
