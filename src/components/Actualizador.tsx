import { relaunch } from "@tauri-apps/plugin-process";
import { check, Update } from "@tauri-apps/plugin-updater";
import { useEffect, useState } from "react";
import { useConfirmar } from "./Confirmar";
import Modal from "./Modal";

/**
 * Al abrir la app busca una versión nueva (en GitHub Releases, según el entorno) y ofrece instalarla.
 * En modo desarrollo no hace nada. Si no hay internet, sigue sin avisar.
 */
export default function Actualizador() {
  const confirmar = useConfirmar();
  const [progreso, setProgreso] = useState<{ version: string; bajado: number; total: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let cancelado = false;
    check()
      .then(async (update) => {
        if (!update || cancelado) return;
        const ok = await confirmar({
          titulo: "Hay una versión nueva",
          aceptar: "Actualizar ahora",
          cancelar: "Más tarde",
          mensaje: (
            <>
              <p>Está disponible la versión <strong>{update.version}</strong> (tenés la {update.currentVersion}).</p>
              {update.body && <p className="muted notas-version">{update.body}</p>}
              <p>La app se va a cerrar unos segundos para instalarla y vuelve a abrirse sola. Los datos no se tocan.</p>
            </>
          ),
        });
        if (ok) await instalar(update);
      })
      .catch(() => { /* sin conexión o sin versiones publicadas: se ignora */ });
    return () => { cancelado = true; };
  }, [confirmar]);

  async function instalar(update: Update) {
    setProgreso({ version: update.version, bajado: 0, total: null });
    try {
      await update.downloadAndInstall((e) => {
        if (e.event === "Started") setProgreso((p) => p && { ...p, total: e.data.contentLength ?? null });
        if (e.event === "Progress") setProgreso((p) => p && { ...p, bajado: p.bajado + e.data.chunkLength });
      });
      await relaunch();
    } catch (e) {
      setProgreso(null);
      setError(String(e));
    }
  }

  if (error) {
    return (
      <Modal titulo="No se pudo actualizar" onCerrar={() => setError(null)} ancho={460}
        pie={<button className="btn-primario" onClick={() => setError(null)}>Entendido</button>}>
        <p>La app sigue funcionando con la versión actual. Se va a volver a ofrecer la próxima vez que la abras.</p>
        <p className="muted">{error}</p>
      </Modal>
    );
  }
  if (!progreso) return null;
  const pct = progreso.total ? Math.min(100, Math.round((progreso.bajado / progreso.total) * 100)) : null;
  return (
    <Modal titulo={`Actualizando a la versión ${progreso.version}`} onCerrar={() => {}} ancho={460}>
      <p>Descargando… no cierres la app.</p>
      <div className="barra-progreso"><div style={{ width: `${pct ?? 30}%` }} /></div>
      <p className="muted">{pct !== null ? `${pct}%` : "Iniciando descarga"}</p>
    </Modal>
  );
}
