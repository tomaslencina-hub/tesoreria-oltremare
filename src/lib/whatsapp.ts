import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Configuracion } from "./config";
import { fecha, moneda, numeroRecibo, periodo } from "./format";
import { marcarEnviado } from "./pagos";
import type { PendientePersona, ReciboDetalle } from "./tipos";

/**
 * Normaliza un teléfono al formato internacional que espera WhatsApp (solo dígitos).
 * Se recomienda cargar los números como "característica + número" sin 0 ni 15,
 * por ejemplo 3415551234; se les antepone el prefijo configurado (549 para Argentina).
 */
export function normalizarTelefono(telefono: string, prefijo: string): string | null {
  let d = telefono.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) return d.slice(2);
  if (telefono.trim().startsWith("+") || d.startsWith(prefijo)) return d;
  if (d.startsWith("0")) d = d.slice(1);
  return prefijo + d;
}

function completar(plantilla: string, valores: Record<string, string>): string {
  return plantilla.replace(/\{(\w+)\}/g, (m, clave) => valores[clave] ?? m);
}

const lineas = (items: { concepto: string; monto: number }[]) =>
  items.map((i) => `• ${i.concepto}: ${moneda(i.monto)}`).join("\n");

export function mensajeRecibo(r: ReciboDetalle, config: Configuracion): string {
  return completar(config.plantilla_whatsapp, {
    nombre: r.nombre,
    apellido: r.apellido,
    numero: numeroRecibo(r.numero),
    asociacion: config.nombre_asociacion,
    detalle: lineas(r.items),
    total: moneda(r.total),
    fecha: fecha(r.fecha),
    medio: r.medio_pago,
  });
}

export function mensajeRecordatorio(p: PendientePersona, per: string, config: Configuracion): string {
  return completar(config.plantilla_recordatorio, {
    nombre: p.nombre,
    apellido: p.apellido,
    asociacion: config.nombre_asociacion,
    periodo: periodo(per),
    detalle: lineas(p.items.map((i) => ({
      concepto: i.tipo === "cuota_social" ? "Cuota societaria" : `Curso ${i.curso_nombre}`,
      monto: i.monto,
    }))),
    total: moneda(p.total),
  });
}

/** "automatico": WhatsApp Desktop envió solo. "manual": quedó el chat abierto para completar a mano. */
export type ModoEnvio = "automatico" | "manual";

async function enviar(
  telefono: string | null, nombre: string, texto: string, config: Configuracion, conImagen: boolean,
): Promise<ModoEnvio> {
  const tel = telefono ? normalizarTelefono(telefono, config.prefijo_whatsapp) : null;
  if (!tel) throw new Error(`${nombre} no tiene teléfono cargado`);
  const msj = encodeURIComponent(texto);
  if (config.envio_automatico) {
    try {
      await invoke("enviar_whatsapp_desktop", { url: `whatsapp://send?phone=${tel}&text=${msj}`, conImagen });
      return "automatico";
    } catch (e) {
      // Si WhatsApp Desktop no llegó a abrirse no se tocó nada: se sigue por WhatsApp Web.
      if (!/No se (pudo abrir|abrió) WhatsApp Desktop/.test(String(e))) throw new Error(String(e));
    }
  }
  await openUrl(`https://wa.me/${tel}?text=${msj}`);
  return "manual";
}

/**
 * Envía el recibo y lo marca como enviado. La imagen de los talones ya tiene que estar
 * en el portapapeles (ver copiarComoImagen).
 */
export async function enviarReciboWhatsApp(r: ReciboDetalle, config: Configuracion): Promise<ModoEnvio> {
  const modo = await enviar(r.telefono, `${r.nombre} ${r.apellido}`, mensajeRecibo(r, config), config, true);
  await marcarEnviado(r.id);
  return modo;
}

export async function enviarRecordatorioWhatsApp(p: PendientePersona, per: string, config: Configuracion): Promise<ModoEnvio> {
  return enviar(p.telefono, `${p.nombre} ${p.apellido}`, mensajeRecordatorio(p, per, config), config, false);
}
