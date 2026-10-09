//! Copias de seguridad de la base de datos.
//!
//! El frontend genera una copia consistente con `VACUUM INTO` en un archivo temporal
//! (`copia_preparar`) y después este módulo la lleva a destino (`copia_guardar`): una carpeta con
//! una copia por día (por defecto `<datos de la app>\copias`, idealmente una carpeta de Google
//! Drive) o un archivo puntual elegido por el usuario. `copia_restaurar` reemplaza la base actual.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};

const ARCHIVO_DB: &str = "tesoreria.db";
const PREFIJO: &str = "tesoreria-oltremare_";
/// Copias diarias que se conservan en la carpeta.
const MANTENER: usize = 30;
const CABECERA_SQLITE: &[u8] = b"SQLite format 3\0";

fn dir_datos(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_config_dir().map_err(|e| e.to_string())
}

fn dir_copias(app: &AppHandle, carpeta: Option<String>) -> Result<PathBuf, String> {
    match carpeta.filter(|c| !c.trim().is_empty()) {
        Some(c) => Ok(PathBuf::from(c)),
        None => Ok(dir_datos(app)?.join("copias")),
    }
}

fn es_sqlite(ruta: &Path) -> bool {
    fs::read(ruta).map(|b| b.starts_with(CABECERA_SQLITE)).unwrap_or(false)
}

fn err(contexto: &str, e: std::io::Error) -> String {
    format!("{contexto}: {e}")
}

/// Devuelve la ruta de un archivo temporal (inexistente) donde el frontend escribe la copia.
#[tauri::command]
pub fn copia_preparar(app: AppHandle) -> Result<String, String> {
    let tmp = dir_datos(&app)?.join("copia-en-curso.tmp");
    if tmp.exists() {
        fs::remove_file(&tmp).map_err(|e| err("No se pudo limpiar la copia anterior", e))?;
    }
    Ok(tmp.to_string_lossy().into_owned())
}

#[derive(Serialize)]
pub struct CopiaGuardada {
    ruta: String,
    /// true si quedó en la carpeta por defecto dentro de la PC (sin carpeta externa configurada).
    local: bool,
}

/// Mueve la copia temporal a destino.
/// - `archivo`: ruta exacta elegida por el usuario ("Guardar copia ahora").
/// - si no, `carpeta` (o la carpeta por defecto) con nombre `tesoreria-oltremare_<fecha>.db`,
///   reemplazando la del mismo día y conservando las últimas `MANTENER`.
#[tauri::command]
pub fn copia_guardar(
    app: AppHandle,
    temporal: String,
    fecha: String,
    carpeta: Option<String>,
    archivo: Option<String>,
) -> Result<CopiaGuardada, String> {
    let tmp = PathBuf::from(&temporal);
    if !es_sqlite(&tmp) {
        return Err("La copia generada no es válida".into());
    }
    if !fecha.chars().all(|c| c.is_ascii_digit() || c == '-') || fecha.is_empty() {
        return Err("Fecha inválida".into());
    }

    let local = archivo.is_none() && carpeta.as_deref().map_or(true, |c| c.trim().is_empty());
    let destino = match archivo {
        Some(a) => PathBuf::from(a),
        None => {
            let dir = dir_copias(&app, carpeta)?;
            fs::create_dir_all(&dir).map_err(|e| err("No se pudo acceder a la carpeta de copias", e))?;
            dir.join(format!("{PREFIJO}{fecha}.db"))
        }
    };

    // copy + remove (y no rename) porque el destino suele estar en otra unidad (Drive, pendrive).
    let resultado = fs::copy(&tmp, &destino).map_err(|e| err("No se pudo guardar la copia", e));
    let _ = fs::remove_file(&tmp);
    resultado?;

    if let Some(dir) = destino.parent().filter(|_| destino.file_name().is_some_and(|n| n.to_string_lossy().starts_with(PREFIJO))) {
        rotar(dir);
    }
    Ok(CopiaGuardada { ruta: destino.to_string_lossy().into_owned(), local })
}

/// Borra las copias diarias más viejas, dejando las últimas `MANTENER` (el nombre ordena por fecha).
fn rotar(dir: &Path) {
    let Ok(entradas) = fs::read_dir(dir) else { return };
    let mut copias: Vec<PathBuf> = entradas
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.file_name().is_some_and(|n| {
                let n = n.to_string_lossy();
                n.starts_with(PREFIJO) && n.ends_with(".db")
            })
        })
        .collect();
    copias.sort();
    let sobran = copias.len().saturating_sub(MANTENER);
    for vieja in copias.into_iter().take(sobran) {
        let _ = fs::remove_file(vieja);
    }
}

/// Reemplaza la base actual por `archivo`. El frontend debe cerrar antes la conexión y reiniciar
/// la app después. La base actual se guarda como `antes-de-restaurar_<fecha>.db` en las copias locales.
#[tauri::command]
pub fn copia_restaurar(app: AppHandle, archivo: String, fecha: String) -> Result<(), String> {
    let origen = PathBuf::from(&archivo);
    if !es_sqlite(&origen) {
        return Err("El archivo elegido no es una copia de seguridad válida".into());
    }
    let datos = dir_datos(&app)?;
    let db = datos.join(ARCHIVO_DB);

    if db.exists() {
        let resguardo = datos.join("copias");
        fs::create_dir_all(&resguardo).map_err(|e| err("No se pudo resguardar la base actual", e))?;
        let nombre: String = fecha.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').collect();
        fs::copy(&db, resguardo.join(format!("antes-de-restaurar_{nombre}.db")))
            .map_err(|e| err("No se pudo resguardar la base actual", e))?;
    }

    fs::copy(&origen, &db).map_err(|e| err("No se pudo restaurar la copia", e))?;
    // Restos del modo WAL de la base anterior: no corresponden a la restaurada.
    for sufijo in ["-wal", "-shm"] {
        let _ = fs::remove_file(datos.join(format!("{ARCHIVO_DB}{sufijo}")));
    }
    Ok(())
}
