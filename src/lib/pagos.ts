import { execute, select } from "./db";
import { periodo as formatoPeriodo } from "./format";
import type { PagoDetalle, Pendiente, TipoPago } from "./tipos";

export interface NuevoPago {
  persona_id: number;
  tipo: TipoPago;
  curso_id: number | null;
  periodo: string | null;
  concepto: string;
  monto: number;
  medio_pago: string;
  fecha: string;
  observaciones: string | null;
}

/** Arma el texto del concepto a partir del tipo, el curso y el período. */
export function conceptoPara(tipo: TipoPago, cursoNombre: string | null, periodo: string | null): string {
  const p = periodo ? ` - ${formatoPeriodo(periodo)}` : "";
  if (tipo === "cuota_social") return `Cuota societaria${p}`;
  if (tipo === "cursado") return `Cursado ${cursoNombre ?? ""}${p}`.replace(/\s+/g, " ");
  return "";
}

/** Registra un pago asignándole el próximo número de recibo y devuelve el pago completo. */
export async function registrarPago(p: NuevoPago): Promise<PagoDetalle> {
  const res = await execute(
    `INSERT INTO pagos (numero_recibo, persona_id, tipo, curso_id, periodo, concepto,
                        monto, medio_pago, fecha, observaciones)
     VALUES ((SELECT COALESCE(MAX(numero_recibo), 0) + 1 FROM pagos),
             $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [p.persona_id, p.tipo, p.curso_id, p.periodo, p.concepto, p.monto, p.medio_pago, p.fecha, p.observaciones],
  );
  const pago = await obtenerPago(Number(res.lastInsertId));
  if (!pago) throw new Error("No se pudo leer el pago recién registrado");
  return pago;
}

const SELECT_DETALLE = `
  SELECT g.*, p.nombre, p.apellido, p.telefono, p.dni
  FROM pagos g JOIN personas p ON p.id = g.persona_id`;

export async function obtenerPago(id: number): Promise<PagoDetalle | null> {
  const filas = await select<PagoDetalle>(`${SELECT_DETALLE} WHERE g.id = $1`, [id]);
  return filas[0] ?? null;
}

export async function listarPagos(filtro: { desde?: string; hasta?: string; texto?: string } = {}) {
  return select<PagoDetalle>(
    `${SELECT_DETALLE}
     WHERE ($1 IS NULL OR g.fecha >= $1)
       AND ($2 IS NULL OR g.fecha <= $2)
       AND ($3 IS NULL OR (p.apellido || ' ' || p.nombre || ' ' || g.concepto) LIKE '%' || $3 || '%')
     ORDER BY g.numero_recibo DESC`,
    [filtro.desde || null, filtro.hasta || null, filtro.texto?.trim() || null],
  );
}

export async function anularPago(id: number) {
  await execute("UPDATE pagos SET anulado = 1 WHERE id = $1", [id]);
}

export async function marcarEnviado(id: number) {
  await execute(
    "UPDATE pagos SET enviado_whatsapp_en = datetime('now', 'localtime') WHERE id = $1",
    [id],
  );
}

/**
 * Cobros esperados para un período que todavía no tienen pago:
 * - cuota societaria de cada socio activo
 * - cursado de cada inscripción activa (desde el mes de alta)
 */
export async function listarPendientes(periodo: string, cuotaSocial: number): Promise<Pendiente[]> {
  return select<Pendiente>(
    `SELECT p.id AS persona_id, p.nombre, p.apellido, p.telefono,
            'cuota_social' AS tipo, NULL AS curso_id, NULL AS curso_nombre, $2 AS monto
       FROM personas p
      WHERE p.activo = 1 AND p.es_socio = 1
        AND NOT EXISTS (SELECT 1 FROM pagos g
                         WHERE g.persona_id = p.id AND g.tipo = 'cuota_social'
                           AND g.periodo = $1 AND g.anulado = 0)
     UNION ALL
     SELECT p.id, p.nombre, p.apellido, p.telefono,
            'cursado', c.id, c.nombre, c.cuota_mensual
       FROM inscripciones i
       JOIN personas p ON p.id = i.persona_id
       JOIN cursos c ON c.id = i.curso_id
      WHERE i.activo = 1 AND p.activo = 1 AND c.activo = 1
        AND substr(i.fecha_alta, 1, 7) <= $1
        AND NOT EXISTS (SELECT 1 FROM pagos g
                         WHERE g.persona_id = p.id AND g.tipo = 'cursado'
                           AND g.curso_id = c.id AND g.periodo = $1 AND g.anulado = 0)
     ORDER BY apellido, nombre`,
    [periodo, cuotaSocial],
  );
}

export interface Resumen {
  cobrado_mes: number;
  cantidad_mes: number;
  cobrado_hoy: number;
}

export async function resumen(periodo: string, hoy: string): Promise<Resumen> {
  const [r] = await select<Resumen>(
    `SELECT COALESCE(SUM(CASE WHEN substr(fecha, 1, 7) = $1 THEN monto END), 0) AS cobrado_mes,
            COUNT(CASE WHEN substr(fecha, 1, 7) = $1 THEN 1 END) AS cantidad_mes,
            COALESCE(SUM(CASE WHEN fecha = $2 THEN monto END), 0) AS cobrado_hoy
       FROM pagos WHERE anulado = 0`,
    [periodo, hoy],
  );
  return r;
}
