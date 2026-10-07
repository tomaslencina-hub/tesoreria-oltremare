mod whatsapp;

use tauri_plugin_sql::{Migration, MigrationKind};

/// URL de la base usada también desde el frontend (src/lib/db.ts).
/// El archivo se crea en la carpeta de configuración de la app
/// (%APPDATA%\com.oltremare.tesoreria\tesoreria.db en Windows).
const DB_URL: &str = "sqlite:tesoreria.db";

fn migraciones() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "esquema_inicial",
            sql: include_str!("../migrations/001_esquema_inicial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "recibos_con_items",
            sql: include_str!("../migrations/002_recibos_con_items.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "datos_institucionales",
            sql: include_str!("../migrations/003_datos_institucionales.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "firma_tesorera",
            sql: include_str!("../migrations/004_firma_tesorera.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migraciones())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![whatsapp::enviar_whatsapp_desktop])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación");
}
