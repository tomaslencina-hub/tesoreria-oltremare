import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { toBlob } from "html-to-image";

/** Convierte un elemento de la pantalla en PNG y lo copia al portapapeles (para pegarlo en WhatsApp). */
export async function copiarComoImagen(elemento: HTMLElement) {
  const blob = await toBlob(elemento, { pixelRatio: 2, backgroundColor: "#ffffff" });
  if (!blob) throw new Error("No se pudo generar la imagen del recibo");
  await writeImage(new Uint8Array(await blob.arrayBuffer()));
}
