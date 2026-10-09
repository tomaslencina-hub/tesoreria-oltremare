import { useState } from "react";
import { guardarClave } from "../lib/config";
import {
  copiaAutomatica, elegirCarpeta, elegirCopiaARestaurar, guardarCopiaManual, restaurarCopia, ultimaCopia,
} from "../lib/copias";
import { fecha } from "../lib/format";
import { useConfig, useConfigCtx } from "./ConfigContext";
import { useConfirmar } from "./Confirmar";

/** Sección "Copia de seguridad" de Configuración. */
export default function CopiasPanel() {
  const config = useConfig();
  const { recargar } = useConfigCtx();
  const confirmar = useConfirmar();
  const [ultima, setUltima] = useState(ultimaCopia());
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function accion(fn: () => Promise<void>) {
    setAviso(null);
    setError(null);
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setOcupado(false);
    }
  }

  const cambiarCarpeta = (carpeta: string) =>
    accion(async () => {
      await guardarClave("carpeta_copias", carpeta);
      await recargar();
      // Se hace una copia en el momento para confirmar que la carpeta funciona.
      const u = await copiaAutomatica(carpeta);
      setUltima(u);
      if (u.error) setError(`No se pudo guardar en esa carpeta (${u.error}). La copia quedó en esta PC.`);
      else setAviso(carpeta ? "Carpeta configurada y copia guardada ahí." : "Las copias quedan solo en esta PC.");
    });

  const elegir = async () => {
    const carpeta = await elegirCarpeta(config.carpeta_copias);
    if (carpeta) await cambiarCarpeta(carpeta);
  };

  const guardarAhora = () =>
    accion(async () => {
      const ruta = await guardarCopiaManual();
      if (ruta) setAviso(`Copia guardada en ${ruta}`);
    });

  const restaurar = () =>
    accion(async () => {
      const archivo = await elegirCopiaARestaurar(config.carpeta_copias);
      if (!archivo) return;
      const ok = await confirmar({
        titulo: "Restaurar copia de seguridad",
        aceptar: "Restaurar y reiniciar",
        peligro: true,
        mensaje: (
          <>
            <p>Se van a reemplazar <strong>todos</strong> los datos de la app (alumnos, cobros, recibos y configuración) por los de esta copia:</p>
            <p className="ruta">{archivo}</p>
            <p className="aviso-peligro">
              Lo cargado después de esa copia se pierde. Los datos actuales se guardan antes como
              «antes-de-restaurar» por si hace falta volver atrás. La app se reinicia.
            </p>
          </>
        ),
      });
      if (ok) await restaurarCopia(archivo);
    });

  return (
    <div className="panel-form copias">
      <h3>Copia de seguridad</h3>
      <p className="muted">
        La app guarda sola una copia por día (al abrir y al cerrar) y conserva las últimas 30. Conviene que la carpeta
        esté fuera de esta PC, por ejemplo en Google Drive: si la computadora se rompe, los datos no se pierden.
      </p>

      <div className="copias-fila">
        <div>
          <strong>Carpeta de copias</strong>
          <span className={config.carpeta_copias ? "ruta" : "aviso-peligro"}>
            {config.carpeta_copias || "Sin configurar: las copias se guardan solo en esta PC."}
          </span>
        </div>
        <button type="button" onClick={elegir} disabled={ocupado}>Elegir carpeta…</button>
        {config.carpeta_copias && <button type="button" onClick={() => cambiarCarpeta("")} disabled={ocupado}>Quitar</button>}
      </div>

      <div className="copias-fila">
        <div>
          <strong>Última copia automática</strong>
          {ultima ? (
            <span className={ultima.error ? "aviso-peligro" : "ruta"}>
              {fecha(ultima.fecha)} {ultima.hora} — {ultima.ruta}
              {ultima.error && " (la carpeta configurada no estaba disponible; quedó en esta PC)"}
            </span>
          ) : <span className="muted">Todavía no se hizo ninguna.</span>}
        </div>
        <button type="button" onClick={guardarAhora} disabled={ocupado}>Guardar copia ahora…</button>
        <button type="button" className="btn-peligro" onClick={restaurar} disabled={ocupado}>Restaurar copia…</button>
      </div>

      {aviso && <p className="ok">{aviso}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
