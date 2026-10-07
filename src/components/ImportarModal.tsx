import { ChangeEvent, useState } from "react";
import { normalizar, leerAlumnos, FilaAlumno } from "../lib/csv";
import { execute, select } from "../lib/db";
import { Curso, Persona } from "../lib/tipos";
import Modal from "./Modal";

interface Analisis {
  fila: FilaAlumno;
  existenteId: number | null;
  cursoIds: number[];
  problema: string | null;
}

export default function ImportarModal({ onCerrar, onImportado }: { onCerrar: () => void; onImportado: () => void }) {
  const [analisis, setAnalisis] = useState<Analisis[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function elegir(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setResultado(null);
    const { filas, errores } = leerAlumnos(await f.text());
    const cursos = await select<Curso>("SELECT * FROM cursos");
    const personas = await select<Persona>("SELECT * FROM personas");
    const porCurso = new Map(cursos.map((c) => [normalizar(c.nombre), c.id]));
    const porNombre = new Map(personas.map((p) => [normalizar(`${p.apellido}|${p.nombre}`), p.id]));
    setErrores(errores);
    setAnalisis(filas.map((fila) => {
      const faltan = fila.cursos.filter((c) => !porCurso.has(normalizar(c)));
      return {
        fila,
        existenteId: porNombre.get(normalizar(`${fila.apellido}|${fila.nombre}`)) ?? null,
        cursoIds: fila.cursos.map((c) => porCurso.get(normalizar(c))).filter((x): x is number => x !== undefined),
        problema: faltan.length ? `Curso inexistente: ${faltan.join(", ")}` : null,
      };
    }));
  }

  async function importar() {
    setImportando(true);
    let nuevas = 0, actualizadas = 0;
    try {
      for (const a of analisis.filter((x) => !x.problema)) {
        const f = a.fila;
        let id = a.existenteId;
        if (id) {
          // Solo completa datos faltantes; no pisa lo que ya se cargó en la app.
          await execute(
            `UPDATE personas SET dni = COALESCE(dni, $1), telefono = COALESCE(telefono, $2),
                    email = COALESCE(email, $3) WHERE id = $4`,
            [f.dni || null, f.telefono || null, f.email || null, id],
          );
          actualizadas++;
        } else {
          const r = await execute(
            `INSERT INTO personas (apellido, nombre, dni, telefono, email, es_socio, activo)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [f.apellido, f.nombre, f.dni || null, f.telefono || null, f.email || null, f.socio ? 1 : 0, f.activo ? 1 : 0],
          );
          id = Number(r.lastInsertId);
          nuevas++;
        }
        for (const cursoId of a.cursoIds) {
          await execute(
            `INSERT INTO inscripciones (persona_id, curso_id, activo) VALUES ($1, $2, $3)
             ON CONFLICT(persona_id, curso_id) DO NOTHING`,
            [id, cursoId, f.activo ? 1 : 0],
          );
        }
      }
      setResultado(`Listo: ${nuevas} personas nuevas, ${actualizadas} ya existentes actualizadas.`);
      setAnalisis([]);
      onImportado();
    } catch (e) {
      setResultado(`Error durante la importación: ${e}`);
    } finally {
      setImportando(false);
    }
  }

  const validas = analisis.filter((a) => !a.problema);
  const nuevas = validas.filter((a) => !a.existenteId).length;

  return (
    <Modal
      titulo="Importar alumnos desde CSV"
      onCerrar={onCerrar}
      ancho={820}
      pie={
        <>
          {resultado && <span className={resultado.startsWith("Error") ? "error" : "ok"}>{resultado}</span>}
          <button onClick={onCerrar}>Cerrar</button>
          <button className="btn-primario" onClick={importar} disabled={importando || validas.length === 0}>
            Importar {validas.length || ""}
          </button>
        </>
      }
    >
      <p className="muted">
        Columnas: <code>apellido; nombre; dni; telefono; email; curso; socio; activo</code>. Se puede guardar
        desde Excel como “CSV (delimitado por comas)”. Las personas que ya existen no se duplican.
      </p>
      <label className="archivo">
        <input type="file" accept=".csv,.txt" onChange={elegir} />
      </label>

      {errores.map((e) => <p key={e} className="error">{e}</p>)}

      {analisis.length > 0 && (
        <>
          <p>
            {analisis.length} filas: <strong>{nuevas} nuevas</strong>, {validas.length - nuevas} ya existentes
            {analisis.length > validas.length && <>, <span className="error">{analisis.length - validas.length} con problemas</span></>}.
          </p>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr><th>Apellido y nombre</th><th>Teléfono</th><th>Curso</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {analisis.map((a) => (
                  <tr key={a.fila.linea} className={a.fila.activo ? "" : "anulado"}>
                    <td>{a.fila.apellido}, {a.fila.nombre}</td>
                    <td>{a.fila.telefono}</td>
                    <td>{a.fila.cursos.join(" + ")}</td>
                    <td>
                      {a.problema ? <span className="error">{a.problema}</span>
                        : a.existenteId ? "Ya existe" : a.fila.activo ? "Nueva" : "Nueva (baja)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
