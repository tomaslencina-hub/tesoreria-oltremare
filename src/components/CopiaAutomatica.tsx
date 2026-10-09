import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { copiaAutomatica, ultimaCopia } from "../lib/copias";
import { hoyISO } from "../lib/format";
import { useConfig } from "./ConfigContext";

/** Tiempo máximo que se espera la copia al cerrar (ej. carpeta de Drive que no responde). */
const ESPERA_AL_CERRAR_MS = 8000;

/**
 * Copia de seguridad automática: al abrir la app si hoy todavía no hay ninguna (cubre apagones
 * o cierres forzados del día anterior) y al cerrarla (cubre el trabajo del día).
 * Un error en la copia nunca impide cerrar la app.
 */
export default function CopiaAutomatica() {
  const config = useConfig();
  const carpeta = useRef(config.carpeta_copias);
  carpeta.current = config.carpeta_copias;
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    if (ultimaCopia()?.fecha !== hoyISO()) copiaAutomatica(carpeta.current).catch(() => {});
  }, []);

  useEffect(() => {
    const ventana = getCurrentWindow();
    let yaCerrando = false;
    const quitar = ventana.onCloseRequested(async (evento) => {
      evento.preventDefault();
      if (yaCerrando) return;
      yaCerrando = true;
      setCerrando(true);
      await Promise.race([
        copiaAutomatica(carpeta.current).catch(() => {}),
        new Promise((r) => setTimeout(r, ESPERA_AL_CERRAR_MS)),
      ]);
      await ventana.destroy();
    });
    return () => { quitar.then((f) => f()); };
  }, []);

  if (!cerrando) return null;
  return (
    <div className="modal-fondo">
      <div className="modal cerrando">Guardando copia de seguridad…</div>
    </div>
  );
}
