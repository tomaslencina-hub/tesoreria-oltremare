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

export type TipoItem = "cuota_social" | "cursado" | "inscripcion" | "otro";

export const TIPOS_ITEM: Record<TipoItem, string> = {
  cuota_social: "Cuota societaria",
  cursado: "Cursado",
  inscripcion: "Inscripción",
  otro: "Otro",
};

export const MEDIOS_PAGO = ["efectivo", "transferencia", "mercado pago", "débito", "otro"];

export interface ReciboItem {
  id?: number;
  tipo: TipoItem;
  curso_id: number | null;
  periodo: string | null;
  concepto: string;
  /** Importe cobrado, con el recargo incluido si lo hubo. */
  monto: number;
  /** Parte de `monto` que es recargo (0 o ausente si no se aplicó). */
  recargo?: number;
}

export interface Recibo {
  id: number;
  numero: number;
  persona_id: number;
  fecha: string;
  medio_pago: string;
  total: number;
  observaciones: string | null;
  anulado: number;
  enviado_whatsapp_en: string | null;
}

/** Recibo con los datos de la persona y sus ítems, para listados y para enviar. */
export interface ReciboDetalle extends Recibo {
  nombre: string;
  apellido: string;
  telefono: string | null;
  dni: string | null;
  items: ReciboItem[];
}

/** Un cobro que se espera para un período y todavía no se registró. */
export interface Pendiente {
  persona_id: number;
  nombre: string;
  apellido: string;
  telefono: string | null;
  tipo: "cuota_social" | "cursado";
  curso_id: number | null;
  curso_nombre: string | null;
  monto: number;
}

/** Pendientes agrupados por persona (una fila = un recibo a cobrar). */
export interface PendientePersona {
  persona_id: number;
  nombre: string;
  apellido: string;
  telefono: string | null;
  items: Pendiente[];
  total: number;
}
