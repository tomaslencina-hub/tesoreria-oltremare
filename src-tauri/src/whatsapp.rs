//! Envío automático por WhatsApp Desktop: abre el chat con el mensaje escrito, lo envía,
//! pega la imagen del recibo (que el frontend ya dejó en el portapapeles) y la envía.
//!
//! Antes de cada tecla se verifica que la ventana activa sea WhatsApp; si no lo es
//! (no está instalado, tardó demasiado o el usuario cambió de ventana) se corta sin tocar nada.

use std::thread::sleep;
use std::time::{Duration, Instant};

use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

/// Tiempo máximo para que aparezca la ventana de WhatsApp.
const ESPERA_VENTANA: Duration = Duration::from_secs(15);
/// Margen para que cargue el chat después de que la ventana quedó al frente.
const ESPERA_CHAT: Duration = Duration::from_millis(2500);
/// Margen entre envío de texto, pegado de imagen y envío de la imagen.
const ESPERA_PASO: Duration = Duration::from_millis(1200);

#[cfg(windows)]
fn titulo_ventana_activa() -> String {
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};
    unsafe {
        let hwnd = GetForegroundWindow();
        let mut buf = [0u16; 256];
        let n = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        String::from_utf16_lossy(&buf[..n.max(0) as usize])
    }
}

#[cfg(not(windows))]
fn titulo_ventana_activa() -> String {
    String::new()
}

fn whatsapp_al_frente() -> bool {
    titulo_ventana_activa().contains("WhatsApp")
}

fn asegurar_whatsapp() -> Result<(), String> {
    if whatsapp_al_frente() {
        Ok(())
    } else {
        Err("Se perdió el foco de WhatsApp; el envío se detuvo. Revisá el chat y completalo a mano.".into())
    }
}

fn tecla(enigo: &mut Enigo, key: Key) -> Result<(), String> {
    enigo.key(key, Direction::Click).map_err(|e| e.to_string())
}

fn pegar(enigo: &mut Enigo) -> Result<(), String> {
    enigo.key(Key::Control, Direction::Press).map_err(|e| e.to_string())?;
    let r = enigo.key(Key::Unicode('v'), Direction::Click).map_err(|e| e.to_string());
    enigo.key(Key::Control, Direction::Release).map_err(|e| e.to_string())?;
    r
}

fn enviar(app: &AppHandle, url: &str, con_imagen: bool) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| format!("No se pudo abrir WhatsApp Desktop: {e}"))?;

    let inicio = Instant::now();
    while !whatsapp_al_frente() {
        if inicio.elapsed() > ESPERA_VENTANA {
            return Err("No se abrió WhatsApp Desktop. Verificá que esté instalado y con la sesión iniciada.".into());
        }
        sleep(Duration::from_millis(200));
    }
    sleep(ESPERA_CHAT);

    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;

    // 1) El mensaje ya está escrito en el chat: enviarlo.
    asegurar_whatsapp()?;
    tecla(&mut enigo, Key::Return)?;
    if !con_imagen {
        return Ok(());
    }
    sleep(ESPERA_PASO);

    // 2) Pegar la imagen (abre la vista previa) y 3) enviarla.
    asegurar_whatsapp()?;
    pegar(&mut enigo)?;
    sleep(ESPERA_PASO);
    asegurar_whatsapp()?;
    tecla(&mut enigo, Key::Return)?;
    Ok(())
}

/// `url` debe ser un enlace `whatsapp://send?...` armado por el frontend.
#[tauri::command]
pub async fn enviar_whatsapp_desktop(app: AppHandle, url: String, con_imagen: bool) -> Result<(), String> {
    if !url.starts_with("whatsapp://send?") {
        return Err("Enlace de WhatsApp inválido".into());
    }
    tauri::async_runtime::spawn_blocking(move || enviar(&app, &url, con_imagen))
        .await
        .map_err(|e| e.to_string())?
}
