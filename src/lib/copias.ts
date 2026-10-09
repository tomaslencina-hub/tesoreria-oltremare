import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { cerrarDb, execute } from "./db";
import { hoyISO } from "./format";

interface CopiaGuardada {
  ruta: string;
  /** Quedó en la carpeta por defecto dentro de la PC. */
  local: boolean;
}

/** Resultado de la última copia automática, para mostrarlo en Configuración. */
export interface UltimaCopia {
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  ruta: string;
  local: boolean;
  /** Si la carpeta configurada no estaba disponible y se guardó en la PC. */
  error?: string;
}

const CLAVE_ULTIMA = "tesoreria.ultimaCopia";
const FILTRO = [{ name: "Copia de seguridad", extensions: ["db"] }];

export function ultimaCopia(): UltimaCopia | null {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_ULTIMA) ?? "null");
  } catch {
    return null;
  }
}

/** Genera una copia consistente de la base (VACUUM INTO) y la lleva a destino. */
async function generar(destino: { carpeta?: string; archivo?: string }): Promise<CopiaGuardada> {
  const temporal = await invoke<string>("copia_preparar");
  await execute(`VACUUM INTO '${temporal.replace(/'/g, "''")}'`);
  return invoke<CopiaGuardada>("copia_guardar", {
    temporal,
    fecha: hoyISO(),
    carpeta: destino.carpeta || null,
    archivo: destino.archivo ?? null,
  });
}

/**
 * Copia del día en la carpeta configurada (reemplaza la del mismo día; se conservan 30).
 * Si la carpeta no está disponible (Drive sin iniciar, pendrive desconectado) se guarda en la PC
 * y se deja registrado el motivo.
 */
export async function copiaAutomatica(carpeta: string): Promise<UltimaCopia> {
  let guardada: CopiaGuardada;
  let error: string | undefined;
  try {
    guardada = await generar({ carpeta });
  } catch (e) {
    if (!carpeta) throw e;
    error = String(e);
    guardada = await generar({});
  }
  const ahora = new Date();
  const ultima: UltimaCopia = {
    fecha: hoyISO(),
    hora: `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`,
    ruta: guardada.ruta,
    local: guardada.local,
    error,
  };
  localStorage.setItem(CLAVE_ULTIMA, JSON.stringify(ultima));
  return ultima;
}

/** "Guardar copia ahora": el usuario elige dónde. Devuelve la ruta, o null si canceló. */
export async function guardarCopiaManual(): Promise<string | null> {
  const archivo = await save({
    title: "Guardar copia de seguridad",
    defaultPath: `tesoreria-oltremare_${hoyISO()}.db`,
    filters: FILTRO,
  });
  if (!archivo) return null;
  return (await generar({ archivo })).ruta;
}

export async function elegirCarpeta(actual: string): Promise<string | null> {
  const carpeta = await open({ title: "Carpeta para las copias de seguridad", directory: true, defaultPath: actual || undefined });
  return typeof carpeta === "string" ? carpeta : null;
}

export async function elegirCopiaARestaurar(carpeta: string): Promise<string | null> {
  const archivo = await open({ title: "Elegir copia de seguridad", filters: FILTRO, defaultPath: carpeta || undefined });
  return typeof archivo === "string" ? archivo : null;
}

/** Reemplaza todos los datos por los de la copia y reinicia la app. */
export async function restaurarCopia(archivo: string) {
  await cerrarDb();
  const sello = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  await invoke("copia_restaurar", { archivo, fecha: sello });
  await relaunch();
}
