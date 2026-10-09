import { execute, select } from "./db";
import { describirPeriodos, periodo as formatoPeriodo } from "./format";
import type { Pendiente, PendientePersona, ReciboDetalle, ReciboItem, TipoItem } from "./tipos";

export interface NuevoRecibo {
  persona_id: number;
  fecha: string;
  medio_pago: string;
  observaciones: string | null;
  items: ReciboItem[];
}

/** Texto del concepto de un ítem a partir del tipo, el curso y el período. */
export function conceptoPara(tipo: TipoItem, cursoNombre: string | null, periodo: string | null): string {
  const p = periodo ? ` ${formatoPeriodo(periodo)}` : "";
  if (tipo === "cuota_social") return `Cuota societaria${p}`;
  if (tipo === "cursado") return `Curso ${cursoNombre ?? ""}${p}`.replace(/\s+/g, " ");
  if (tipo === "inscripcion") return `Inscripción ${cursoNombre ?? ""}`.trim();
  return "";
}

/** Ítems de un mismo concepto agrupados (ej. cuota societaria de octubre a diciembre). */
export interface GrupoItems {
  tipo: TipoItem;
  curso_id: number | null;
  /** Concepto sin el mes: "Cuota societaria", "Curso Segundo", "Inscripción Primero"… */
  concepto: string;
  periodos: string[];
  /** Total del grupo, con recargo incluido. */
  monto: number;
  /** Parte de `monto` que es recargo. */
  recargo: number;
}

/** Concepto de un ítem sin el mes ("Curso Segundo Octubre 2026" -> "Curso Segundo"). */
function conceptoBase(i: ReciboItem): string {
  if (i.tipo === "cuota_social") return "Cuota societaria";
  return i.periodo ? i.concepto.replace(formatoPeriodo(i.periodo), "").trim() : i.concepto;
}

export function agruparItems(items: ReciboItem[]): GrupoItems[] {
  const grupos = new Map<string, GrupoItems>();
  for (const i of items) {
    const concepto = conceptoBase(i);
    const clave = `${i.tipo}|${i.curso_id ?? ""}|${concepto}`;
    let g = grupos.get(clave);
    if (!g) {
      g = { tipo: i.tipo, curso_id: i.curso_id, concepto, periodos: [], monto: 0, recargo: 0 };
      grupos.set(clave, g);
    }
    if (i.periodo) g.periodos.push(i.periodo);
    g.monto += i.monto;
    g.recargo += i.recargo ?? 0;
  }
  return [...grupos.values()];
}

/** "Cuota societaria Octubre a Diciembre 2026" */
export function describirGrupo(g: GrupoItems): string {
  return g.periodos.length ? `${g.concepto} ${describirPeriodos(g.periodos)}` : g.concepto;
}

/** Resumen de un recibo para listados: "Cuota societaria Octubre 2026 + Curso Segundo Octubre 2026". */
export function describirRecibo(items: ReciboItem[]): string {
  return agruparItems(items).map(describirGrupo).join(" + ");
}

/**
 * Registra un recibo con sus ítems asignándole el próximo número.
 * Las sentencias van por separado (el pool de conexiones no garantiza transacciones
 * entre llamadas), así que si falla un ítem se borra el recibo para no dejarlo a medias.
 */
export async function registrarRecibo(r: NuevoRecibo): Promise<ReciboDetalle> {
  const total = r.items.reduce((s, i) => s + i.monto, 0);
  const res = await execute(
    `INSERT INTO recibos (numero, persona_id, fecha, medio_pago, total, observaciones)
     VALUES ((SELECT COALESCE(MAX(numero), 0) + 1 FROM recibos), $1, $2, $3, $4, $5)`,
    [r.persona_id, r.fecha, r.medio_pago, total, r.observaciones],
  );
  const id = Number(res.lastInsertId);
  try {
    for (const i of r.items) {
      await execute(
        `INSERT INTO recibo_items (recibo_id, tipo, curso_id, periodo, concepto, monto, recargo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, i.tipo, i.curso_id, i.periodo, i.concepto, i.monto, i.recargo ?? 0],
      );
    }
  } catch (e) {
    await execute("DELETE FROM recibos WHERE id = $1", [id]);
    throw e;
  }
  const recibo = await obtenerRecibo(id);
  if (!recibo) throw new Error("No se pudo leer el recibo recién registrado");
  return recibo;
}

type ReciboFila = Omit<ReciboDetalle, "items">;

const SELECT_DETALLE = `
  SELECT r.*, p.nombre, p.apellido, p.telefono, p.dni
  FROM recibos r JOIN personas p ON p.id = r.persona_id`;

async function conItems(recibos: ReciboFila[]): Promise<ReciboDetalle[]> {
  if (recibos.length === 0) return [];
  const ids = recibos.map((r) => r.id);
  const items = await select<ReciboItem & { recibo_id: number }>(
    `SELECT * FROM recibo_items WHERE recibo_id IN (${ids.map((_, i) => `$${i + 1}`).join(",")}) ORDER BY id`,
    ids,
  );
  return recibos.map((r) => ({ ...r, items: items.filter((i) => i.recibo_id === r.id) }));
}

export async function obtenerRecibo(id: number): Promise<ReciboDetalle | null> {
  const filas = await select<ReciboFila>(`${SELECT_DETALLE} WHERE r.id = $1`, [id]);
  return (await conItems(filas))[0] ?? null;
}

export async function listarRecibos(
  filtro: { desde?: string; hasta?: string; texto?: string; limite?: number } = {},
): Promise<ReciboDetalle[]> {
  const filas = await select<ReciboFila>(
    `${SELECT_DETALLE}
     WHERE ($1 IS NULL OR r.fecha >= $1)
       AND ($2 IS NULL OR r.fecha <= $2)
       AND ($3 IS NULL OR (p.apellido || ' ' || p.nombre) LIKE '%' || $3 || '%'
            OR EXISTS (SELECT 1 FROM recibo_items i WHERE i.recibo_id = r.id AND i.concepto LIKE '%' || $3 || '%'))
     ORDER BY r.numero DESC
     LIMIT $4`,
    [filtro.desde || null, filtro.hasta || null, filtro.texto?.trim() || null, filtro.limite ?? -1],
  );
  return conItems(filas);
}

export async function anularRecibo(id: number) {
  await execute("UPDATE recibos SET anulado = 1 WHERE id = $1", [id]);
}

export async function marcarEnviado(id: number) {
  await execute(
    "UPDATE recibos SET enviado_whatsapp_en = datetime('now', 'localtime') WHERE id = $1",
    [id],
  );
}

/** Condición "ya se cobró este ítem en este período" (recibos no anulados). */
const YA_COBRADO = `
  SELECT 1 FROM recibo_items i JOIN recibos r ON r.id = i.recibo_id
   WHERE r.anulado = 0 AND r.persona_id = p.id AND i.periodo = $1`;

/**
 * Cobros esperados para un período que todavía no tienen recibo:
 * - cuota societaria de cada socio activo (desde el mes en que se lo cargó)
 * - cursado de cada inscripción activa (desde el mes de alta)
 * Con `personaId` se limita a una sola persona.
 */
export async function listarPendientes(
  periodo: string,
  cuotaSocial: number,
  personaId: number | null = null,
): Promise<Pendiente[]> {
  return select<Pendiente>(
    `SELECT p.id AS persona_id, p.nombre, p.apellido, p.telefono,
            'cuota_social' AS tipo, NULL AS curso_id, NULL AS curso_nombre, $2 AS monto
       FROM personas p
      WHERE p.activo = 1 AND p.es_socio = 1
        AND substr(p.creado_en, 1, 7) <= $1
        AND ($3 IS NULL OR p.id = $3)
        AND NOT EXISTS (${YA_COBRADO} AND i.tipo = 'cuota_social')
     UNION ALL
     SELECT p.id, p.nombre, p.apellido, p.telefono,
            'cursado', c.id, c.nombre, c.cuota_mensual
       FROM inscripciones ins
       JOIN personas p ON p.id = ins.persona_id
       JOIN cursos c ON c.id = ins.curso_id
      WHERE ins.activo = 1 AND p.activo = 1 AND c.activo = 1
        AND substr(ins.fecha_alta, 1, 7) <= $1
        AND ($3 IS NULL OR p.id = $3)
        AND NOT EXISTS (${YA_COBRADO} AND i.tipo = 'cursado' AND i.curso_id = c.id)
     ORDER BY apellido, nombre, tipo`,
    [periodo, cuotaSocial, personaId],
  );
}

export function agruparPorPersona(pendientes: Pendiente[]): PendientePersona[] {
  const mapa = new Map<number, PendientePersona>();
  for (const p of pendientes) {
    let g = mapa.get(p.persona_id);
    if (!g) {
      g = { persona_id: p.persona_id, nombre: p.nombre, apellido: p.apellido, telefono: p.telefono, items: [], total: 0 };
      mapa.set(p.persona_id, g);
    }
    g.items.push(p);
    g.total += p.monto;
  }
  return [...mapa.values()];
}

export interface Resumen {
  cobrado_mes: number;
  cantidad_mes: number;
  cobrado_hoy: number;
}

export async function resumen(periodo: string, hoy: string): Promise<Resumen> {
  const [r] = await select<Resumen>(
    `SELECT COALESCE(SUM(CASE WHEN substr(fecha, 1, 7) = $1 THEN total END), 0) AS cobrado_mes,
            COUNT(CASE WHEN substr(fecha, 1, 7) = $1 THEN 1 END) AS cantidad_mes,
            COALESCE(SUM(CASE WHEN fecha = $2 THEN total END), 0) AS cobrado_hoy
       FROM recibos WHERE anulado = 0`,
    [periodo, hoy],
  );
  return r;
}

