import readXlsxFile from "read-excel-file/browser";
import { normalizar } from "./csv";

type Celda = string | number | boolean | Date | null | undefined;

function aTexto(c: Celda): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  if (typeof c === "boolean") return c ? "si" : "no";
  return String(c);
}

/** Lee una hoja de un .xlsx como filas de texto (por defecto "Alumnos"; si no existe, la primera). */
export async function leerFilasExcel(archivo: File, hoja = "Alumnos"): Promise<string[][]> {
  const hojas = await readXlsxFile(archivo);
  const elegida = hojas.find((h) => normalizar(h.sheet) === normalizar(hoja)) ?? hojas[0];
  if (!elegida) return [];
  return elegida.data.map((fila) => fila.map((c) => aTexto(c as Celda)));
}
