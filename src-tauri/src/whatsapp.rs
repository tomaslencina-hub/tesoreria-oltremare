//! Envío por WhatsApp Desktop.
//!
//! Con imagen (recibos): abre el chat, pega la imagen de los talones (que el frontend ya dejó
//! en el portapapeles) y pega el mensaje como texto de la imagen. Sin imagen (recordatorios):
//! abre el chat con el mensaje escrito. En ambos casos queda listo para que la persona revise
//! y apriete Enviar; solo con `enviar = true` la app aprieta Enviar sola.
//!
//! Antes de cada tecla se verifica que la ventana activa sea WhatsApp; si no lo es
//! (no está instalado, tardó demasiado o el usuario cambió de ventana) se corta sin tocar nada.

use std::thread::sleep;
use std::time::{Duration, Instant};

use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_opener::OpenerExt;

/// Tiempo máximo para que aparezca la ventana de WhatsApp.
const ESPERA_VENTANA: Duration = Duration::from_secs(15);
/// Margen para que cargue el chat después de que la ventana quedó al frente.
const ESPERA_CHAT: Duration = Duration::from_millis(2500);
/// Margen entre pasos (pegar imagen, pegar texto, enviar).
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
        Err("Se perdió el foco de WhatsApp; se detuvo. Revisá el chat y completalo a mano.".into())
    }
}

fn pegar(enigo: &mut Enigo) -> Result<(), String> {
    enigo.key(Key::Control, Direction::Press).map_err(|e| e.to_string())?;
    let r = enigo.key(Key::Unicode('v'), Direction::Click).map_err(|e| e.to_string());
    enigo.key(Key::Control, Direction::Release).map_err(|e| e.to_string())?;
    r
}

fn abrir_chat(app: &AppHandle, telefono: &str, texto: Option<&str>) -> Result<(), String> {
    let mut url = format!("whatsapp://send?phone={telefono}");
    if let Some(t) = texto {
        url.push_str("&text=");
        url.push_str(&urlencoding::encode(t));
    }
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
    Ok(())
}

fn preparar(app: &AppHandle, telefono: &str, texto: &str, con_imagen: bool, enviar: bool) -> Result<(), String> {
    if !con_imagen {
        // El mensaje queda escrito en el chat; no hace falta tocar el teclado salvo para enviar.
        abrir_chat(app, telefono, Some(texto))?;
        if enviar {
            sleep(ESPERA_CHAT);
            asegurar_whatsapp()?;
            let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
            enigo.key(Key::Return, Direction::Click).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    abrir_chat(app, telefono, None)?;
    sleep(ESPERA_CHAT);
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;

    // 1) Pegar la imagen: WhatsApp abre la vista previa con el campo de texto de la imagen.
    asegurar_whatsapp()?;
    pegar(&mut enigo)?;
    sleep(ESPERA_PASO);

    // 2) Pegar el mensaje como texto de la imagen (pegado, no tipeado: los saltos de línea no envían).
    app.clipboard().write_text(texto.to_string()).map_err(|e| e.to_string())?;
    asegurar_whatsapp()?;
    pegar(&mut enigo)?;

    // 3) Enviar solo si se pidió; si no, queda en la vista previa para revisar.
    if enviar {
        sleep(ESPERA_PASO);
        asegurar_whatsapp()?;
        enigo.key(Key::Return, Direction::Click).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// `telefono`: solo dígitos, en formato internacional (549...).
#[tauri::command]
pub async fn enviar_whatsapp_desktop(
    app: AppHandle,
    telefono: String,
    texto: String,
    con_imagen: bool,
    enviar: bool,
) -> Result<(), String> {
    if telefono.is_empty() || !telefono.chars().all(|c| c.is_ascii_digit()) {
        return Err("Teléfono inválido".into());
    }
    tauri::async_runtime::spawn_blocking(move || preparar(&app, &telefono, &texto, con_imagen, enviar))
        .await
        .map_err(|e| e.to_string())?
}
