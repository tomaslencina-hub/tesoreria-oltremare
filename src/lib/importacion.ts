import { FilaAlumno, normalizar } from "./csv";
import { execute } from "./db";
import type { Curso, Persona } from "./tipos";

export interface Inscripcion {
  persona_id: number;
  curso_id: number;
  activo: number;
}

/** Qué va a pasar con cada fila de la planilla al importarla. */
export interface PlanFila {
  fila: FilaAlumno;
  personaId: number | null;
  /** Cambios sobre una persona existente, en texto para la vista previa. */
  cambios: string[];
  /** Cursos de la planilla (se inscribe o se mantiene). */
  cursoIds: number[];
  /** Cursos en los que estaba y la planilla ya no lista (se da de baja la inscripción). */
  dejaCursoIds: number[];
  /** Cómo queda la persona: si queda de baja, sus inscripciones no se reactivan. */
  activoFinal: boolean;
  problema: string | null;
}

/**
 * Compara la planilla con lo que ya hay en la base. La planilla manda en lo que trae escrito
 * (teléfono, DNI, observaciones, socio, activo, cursos); las celdas vacías no borran nada.
 */
export function planificar(
  filas: FilaAlumno[], personas: Persona[], cursos: Curso[], inscripciones: Inscripcion[],
): PlanFila[] {
  const porCurso = new Map(cursos.map((c) => [normalizar(c.nombre), c]));
  const nombreCurso = new Map(cursos.map((c) => [c.id, c.nombre]));
  const porNombre = new Map(personas.map((p) => [normalizar(`${p.apellido}|${p.nombre}`), p]));

  return filas.map((fila) => {
    const faltan = fila.cursos.filter((c) => !porCurso.has(normalizar(c)));
    const cursoIds = fila.cursos.map((c) => porCurso.get(normalizar(c))?.id).filter((x): x is number => x !== undefined);
    const p = porNombre.get(normalizar(`${fila.apellido}|${fila.nombre}`));
    const plan: PlanFila = {
      fila, personaId: p?.id ?? null, cambios: [], cursoIds, dejaCursoIds: [], activoFinal: fila.activo,
      problema: faltan.length ? `Curso inexistente: ${faltan.join(", ")}` : null,
    };
    if (!p) return plan;

    const c = plan.cambios;
    const dato = (etiqueta: string, actual: string | null, nuevo: string) => {
      if (nuevo && nuevo !== (actual ?? "")) c.push(`${etiqueta}: ${actual || "—"} → ${nuevo}`);
    };
    dato("Teléfono", p.telefono, fila.telefono);
    dato("DNI", p.dni, fila.dni);
    dato("Observaciones", p.notas, fila.notas);
    if (fila.activoIndicado && !!p.activo !== fila.activo) c.push(fila.activo ? "Se reactiva" : "Pasa a baja");
    if (fila.socioIndicado && !!p.es_socio !== fila.socio) c.push(fila.socio ? "Pasa a ser socio" : "Deja de ser socio");

    plan.activoFinal = fila.activoIndicado ? fila.activo : !!p.activo;
    const propias = inscripciones.filter((i) => i.persona_id === p.id);
    if (!plan.activoFinal) {
      // De baja: solo se registran cursos que no figuraban (como historial), sin reactivar nada.
      plan.cursoIds = cursoIds.filter((id) => !propias.some((i) => i.curso_id === id));
      return plan;
    }
    const actuales = propias.filter((i) => i.activo).map((i) => i.curso_id);
    for (const id of cursoIds) if (!actuales.includes(id)) c.push(`Se inscribe en ${nombreCurso.get(id)}`);
    if (cursoIds.length) {
      plan.dejaCursoIds = actuales.filter((id) => !cursoIds.includes(id));
      for (const id of plan.dejaCursoIds) c.push(`Deja ${nombreCurso.get(id)}`);
    }
    return plan;
  });
}

/** Aplica el plan. Devuelve cuántas personas se crearon y cuántas se modificaron. */
export async function aplicarPlan(planes: PlanFila[]): Promise<{ nuevas: number; modificadas: number }> {
  let nuevas = 0, modificadas = 0;
  for (const plan of planes.filter((x) => !x.problema)) {
    const f = plan.fila;
    let id = plan.personaId;
    if (id === null) {
      const r = await execute(
        `INSERT INTO personas (apellido, nombre, dni, telefono, email, es_socio, activo, notas)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [f.apellido, f.nombre, f.dni || null, f.telefono || null, f.email || null, f.socio ? 1 : 0, f.activo ? 1 : 0, f.notas || null],
      );
      id = Number(r.lastInsertId);
      nuevas++;
    } else if (plan.cambios.length) {
      await execute(
        `UPDATE personas SET dni = COALESCE($1, dni), telefono = COALESCE($2, telefono), email = COALESCE($3, email),
                notas = COALESCE($4, notas), es_socio = COALESCE($5, es_socio), activo = COALESCE($6, activo)
          WHERE id = $7`,
        [f.dni || null, f.telefono || null, f.email || null, f.notas || null,
          f.socioIndicado ? (f.socio ? 1 : 0) : null, f.activoIndicado ? (f.activo ? 1 : 0) : null, id],
      );
      modificadas++;
    }
    for (const cursoId of plan.cursoIds) {
      await execute(
        plan.activoFinal
          ? `INSERT INTO inscripciones (persona_id, curso_id, activo) VALUES ($1, $2, 1)
             ON CONFLICT(persona_id, curso_id) DO UPDATE SET activo = 1`
          : `INSERT INTO inscripciones (persona_id, curso_id, activo) VALUES ($1, $2, 0)
             ON CONFLICT(persona_id, curso_id) DO NOTHING`,
        [id, cursoId],
      );
    }
    for (const cursoId of plan.dejaCursoIds) {
      await execute("UPDATE inscripciones SET activo = 0 WHERE persona_id = $1 AND curso_id = $2", [id, cursoId]);
    }
  }
  return { nuevas, modificadas };
}
