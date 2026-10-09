# Tesorería Oltremare

Aplicación de escritorio para la tesorería de la asociación: registro de cobros de **cursado** y **cuota societaria**, control de pendientes por mes y envío de recibos por **WhatsApp**.

Hecha con [Tauri 2](https://tauri.app) + React + TypeScript. Los datos se guardan en SQLite local mediante `tauri-plugin-sql`.

## Desarrollo

```bash
npm install
npm run app:dev       # app en modo desarrollo (base de datos de DESARROLLO)
npm run app:test      # igual, pero con la base de PRUEBA
npm run build:test    # instalador de prueba
npm run build:prod    # instalador definitivo (src-tauri/target/release/bundle)
```

## Ramas y entornos

| Rama | Para qué | Base de datos | GitHub Actions |
|---|---|---|---|
| `develop` | Desarrollo diario; acá se suman los cambios | `com.oltremare.tesoreria.dev` | Verifica que compile |
| `test` | Probar una versión antes de usarla de verdad | `com.oltremare.tesoreria.test` | Genera el instalador de prueba (en *Actions → artefactos*) |
| `production` | Lo que usa la tesorería | `com.oltremare.tesoreria` | Publica el instalador como *Release* (borrador) |

Cada entorno es una app distinta con su propia base de datos (en `%APPDATA%\<identificador>`), así que probar nunca toca los datos reales. Las versiones de desarrollo y prueba muestran un distintivo de color en el menú.

Flujo: trabajar en `develop` → merge a `test` y probar → merge a `production`.

## Actualizaciones automáticas

La app instalada busca versiones nuevas al abrirse y ofrece instalarlas (plugin updater de Tauri):

- **Prueba** se actualiza desde la release `canal-test` (la publica GitHub Actions al subir a `test`).
- **Producción** se actualiza desde la última Release `v<versión>` (al subir a `production`).
- **Cada publicación necesita un número de versión mayor** en `package.json` (`tauri.conf.json` lo toma de ahí). Si no, las apps instaladas no ven la actualización.
- Las actualizaciones van firmadas. La clave privada está en `%USERPROFILE%.tauri	esoreria-oltremare.key` (fuera del repo, sin contraseña) y en el secreto `TAURI_SIGNING_PRIVATE_KEY` de GitHub. **Si se pierde, las apps instaladas no aceptan más actualizaciones** y hay que reinstalarlas a mano: guardar una copia en un lugar seguro.

Para armar un instalador local (también firmado):

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/tesoreria-oltremare.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run build:test    # o build:prod
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

## Copias de seguridad

La base vive solo en la PC donde está instalada la app, así que la app guarda copias sola:

- **Automática**: una por día (`tesoreria-oltremare_<fecha>.db`), al abrir la app si ese día no hay ninguna y al cerrarla. Se conservan las últimas 30.
- **Dónde**: en la carpeta elegida en *Configuración → Copia de seguridad* (idealmente una carpeta de Google Drive para escritorio, para que quede fuera de la PC). Sin carpeta configurada, o si no está disponible, quedan en `%APPDATA%<identificador>copias`.
- **Guardar copia ahora**: a un archivo puntual (pendrive, etc.).
- **Restaurar copia**: reemplaza todos los datos por los de la copia y reinicia la app; antes guarda la base actual como `antes-de-restaurar_<fecha>.db` en las copias locales. Sirve también para mudar los datos a otra PC.

Las copias contienen datos personales: la carpeta tiene que ser de una cuenta de la asociación.

## Importar alumnos

Se carga la planilla [plantillas/plantilla_alumnos.xlsx](plantillas/plantilla_alumnos.xlsx) (hoja «Alumnos», con listas desplegables e instrucciones) y se importa desde *Alumnos y socios → Importar planilla*. También acepta CSV con las mismas columnas: `Apellido; Nombre; DNI; Teléfono; Curso; Otro curso; Socio; Activo; Observaciones`. Las personas existentes no se duplican: se actualiza lo que la planilla trae escrito (teléfono, DNI, socio, activo, cursos) y las celdas vacías no borran nada. La vista previa muestra qué cambia en cada persona antes de aplicar.

Las planillas originales y el CSV generado van en `datos/`, que **no se versiona** (datos personales).

## WhatsApp

Cada recibo genera un talón por concepto (cuota societaria, cuota curso…) con el mismo formato que los recibos en papel: logo, dirección, personería jurídica y CUIT (editables en *Configuración*). *Abrir en WhatsApp* usa **WhatsApp Desktop** (Microsoft Store, con la sesión iniciada): abre el chat, pega la imagen de los talones y el mensaje como texto de la imagen, y lo deja en la vista previa para que la persona lo revise y apriete *Enviar* cuando quiera. *Recordar* (en Pendientes) abre el chat con el recordatorio escrito, sin enviarlo. Mientras se prepara no hay que usar el mouse ni el teclado; si la ventana de WhatsApp pierde el foco, se detiene. Si WhatsApp Desktop no está instalado, abre WhatsApp Web con el mensaje y la imagen copiada para pegar con Ctrl+V. En *Configuración* se puede activar que la app apriete *Enviar* sola. Los teléfonos se cargan como característica + número, sin 0 ni 15 (ej. `3415551234`); la app antepone el prefijo configurado (`549` para Argentina).
