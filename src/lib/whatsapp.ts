import { openUrl } from "@tauri-apps/plugin-opener";
import type { Configuracion } from "./config";
import { fecha, moneda, numeroRecibo, periodo } from "./format";
import { marcarEnviado } from "./pagos";
import type { PagoDetalle } from "./tipos";

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

export function mensajeRecibo(pago: PagoDetalle, config: Configuracion): string {
  const valores: Record<string, string> = {
    nombre: pago.nombre,
    apellido: pago.apellido,
    numero: numeroRecibo(pago.numero_recibo),
    asociacion: config.nombre_asociacion,
    concepto: pago.concepto,
    periodo: periodo(pago.periodo) || "-",
    monto: moneda(pago.monto),
    fecha: fecha(pago.fecha),
    medio: pago.medio_pago,
  };
  return config.plantilla_whatsapp.replace(/\{(\w+)\}/g, (m, clave) => valores[clave] ?? m);
}

/** Abre WhatsApp con el mensaje del recibo listo para enviar y marca el pago como enviado. */
export async function enviarReciboWhatsApp(pago: PagoDetalle, config: Configuracion) {
  const tel = pago.telefono ? normalizarTelefono(pago.telefono, config.prefijo_whatsapp) : null;
  if (!tel) throw new Error(`${pago.nombre} ${pago.apellido} no tiene teléfono cargado`);
  const texto = encodeURIComponent(mensajeRecibo(pago, config));
  await openUrl(`https://wa.me/${tel}?text=${texto}`);
  await marcarEnviado(pago.id);
}
