export interface Persona {
  id: number;
  nombre: string;
  apellido: string;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  es_socio: number;
  activo: number;
  notas: string | null;
}

export interface Curso {
  id: number;
  nombre: string;
  nivel: string | null;
  cuota_mensual: number;
  activo: number;
}

export type TipoPago = "cursado" | "cuota_social" | "otro";

export const TIPOS_PAGO: Record<TipoPago, string> = {
  cursado: "Cursado",
  cuota_social: "Cuota societaria",
  otro: "Otro",
};

export const MEDIOS_PAGO = ["efectivo", "transferencia", "mercado pago", "débito", "otro"];

export interface Pago {
  id: number;
  numero_recibo: number;
  persona_id: number;
  tipo: TipoPago;
  curso_id: number | null;
  periodo: string | null;
  concepto: string;
  monto: number;
  medio_pago: string;
  fecha: string;
  observaciones: string | null;
  anulado: number;
  enviado_whatsapp_en: string | null;
}

/** Pago con los datos de la persona, para listados y recibos. */
export interface PagoDetalle extends Pago {
  nombre: string;
  apellido: string;
  telefono: string | null;
  dni: string | null;
}

/** Un cobro que se espera para un período y todavía no se registró. */
export interface Pendiente {
  persona_id: number;
  nombre: string;
  apellido: string;
  telefono: string | null;
  tipo: TipoPago;
  curso_id: number | null;
  curso_nombre: string | null;
  monto: number;
}
