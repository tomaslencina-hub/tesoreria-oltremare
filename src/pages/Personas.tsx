import { FormEvent, useCallback, useEffect, useState } from "react";
import ImportarModal from "../components/ImportarModal";
import Modal from "../components/Modal";
import { execute, select } from "../lib/db";
import { Curso, Persona } from "../lib/tipos";

type PersonaFila = Persona & { cursos: string | null };

const VACIA: Omit<Persona, "id"> = {
  nombre: "", apellido: "", dni: "", telefono: "", email: "", es_socio: 1, activo: 1, notas: "",
};

export default function Personas() {
  const [filas, setFilas] = useState<PersonaFila[]>([]);
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState<"activos" | "socios" | "todos">("activos");
  const [editando, setEditando] = useState<Partial<Persona> | null>(null);
  const [importando, setImportando] = useState(false);

  const cargar = useCallback(async () => {
    setFilas(
      await select<PersonaFila>(
        `SELECT p.*, (SELECT group_concat(c.nombre, ', ')
                        FROM inscripciones i JOIN cursos c ON c.id = i.curso_id
                       WHERE i.persona_id = p.id AND i.activo = 1) AS cursos
           FROM personas p
          WHERE ($1 = 'todos' OR p.activo = 1)
            AND ($1 <> 'socios' OR p.es_socio = 1)
            AND ($2 = '' OR (p.apellido || ' ' || p.nombre || ' ' || COALESCE(p.dni, '')) LIKE '%' || $2 || '%')
          ORDER BY p.apellido, p.nombre`,
        [filtro, texto.trim()],
      ),
    );
  }, [filtro, texto]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <section>
      <header className="pagina-cabecera">
        <div>
          <h1>Alumnos y socios</h1>
          <p className="muted">{filas.length} personas</p>
        </div>
        <div className="fila-botones">
          <button onClick={() => setImportando(true)}>Importar CSV</button>
          <button className="btn-primario" onClick={() => setEditando({ ...VACIA })}>+ Nueva persona</button>
        </div>
      </header>

      <div className="filtros">
        <input placeholder="Buscar por nombre o DNI…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
          <option value="activos">Activos</option>
          <option value="socios">Solo socios</option>
          <option value="todos">Todos (incluye bajas)</option>
        </select>
      </div>

      <table className="tabla">
        <thead>
          <tr><th>Apellido y nombre</th><th>DNI</th><th>Teléfono</th><th>Socio</th><th>Cursos</th><th></th></tr>
        </thead>
        <tbody>
          {filas.map((p) => (
            <tr key={p.id} className={p.activo ? "" : "anulado"}>
              <td>{p.apellido}, {p.nombre}</td>
              <td>{p.dni}</td>
              <td>{p.telefono}</td>
              <td>{p.es_socio ? "Sí" : "—"}</td>
              <td>{p.cursos ?? "—"}</td>
              <td className="acciones"><button onClick={() => setEditando(p)}>Editar</button></td>
            </tr>
          ))}
          {filas.length === 0 && <tr><td colSpan={6} className="vacio">No hay personas cargadas.</td></tr>}
        </tbody>
      </table>

      {importando && <ImportarModal onCerrar={() => setImportando(false)} onImportado={cargar} />}
      {editando && (
        <PersonaModal
          persona={editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); cargar(); }}
        />
      )}
    </section>
  );
}

function PersonaModal({ persona, onCerrar, onGuardado }: {
  persona: Partial<Persona>;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [p, setP] = useState(persona);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [inscripto, setInscripto] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    select<Curso>("SELECT * FROM cursos WHERE activo = 1 ORDER BY nombre").then(setCursos);
    if (persona.id) {
      select<{ curso_id: number }>(
        "SELECT curso_id FROM inscripciones WHERE persona_id = $1 AND activo = 1",
        [persona.id],
      ).then((f) => setInscripto(new Set(f.map((x) => x.curso_id))));
    }
  }, [persona.id]);

  const campo = (k: keyof Persona) => ({
    value: (p[k] as string | null) ?? "",
    onChange: (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value }),
  });

  function alternarCurso(id: number) {
    const s = new Set(inscripto);
    s.has(id) ? s.delete(id) : s.add(id);
    setInscripto(s);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!p.nombre?.trim() || !p.apellido?.trim()) return setError("Nombre y apellido son obligatorios");
    const vals = [
      p.nombre.trim(), p.apellido.trim(), p.dni?.trim() || null, p.telefono?.trim() || null,
      p.email?.trim() || null, p.es_socio ? 1 : 0, p.activo ? 1 : 0, p.notas?.trim() || null,
    ];
    try {
      let id = p.id;
      if (id) {
        await execute(
          `UPDATE personas SET nombre=$1, apellido=$2, dni=$3, telefono=$4, email=$5,
                  es_socio=$6, activo=$7, notas=$8 WHERE id=$9`,
          [...vals, id],
        );
      } else {
        const r = await execute(
          `INSERT INTO personas (nombre, apellido, dni, telefono, email, es_socio, activo, notas)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          vals,
        );
        id = Number(r.lastInsertId);
      }
      for (const c of cursos) {
        if (inscripto.has(c.id)) {
          await execute(
            `INSERT INTO inscripciones (persona_id, curso_id) VALUES ($1, $2)
             ON CONFLICT(persona_id, curso_id) DO UPDATE SET activo = 1`,
            [id, c.id],
          );
        } else {
          await execute("UPDATE inscripciones SET activo = 0 WHERE persona_id = $1 AND curso_id = $2", [id, c.id]);
        }
      }
      onGuardado();
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <Modal
      titulo={p.id ? "Editar persona" : "Nueva persona"}
      onCerrar={onCerrar}
      pie={
        <>
          {error && <span className="error">{error}</span>}
          <button onClick={onCerrar}>Cancelar</button>
          <button className="btn-primario" type="submit" form="form-persona">Guardar</button>
        </>
      }
    >
      <form id="form-persona" className="form" onSubmit={guardar}>
        <label>Nombre<input {...campo("nombre")} autoFocus /></label>
        <label>Apellido<input {...campo("apellido")} /></label>
        <label>DNI<input {...campo("dni")} /></label>
        <label>
          Teléfono (WhatsApp)
          <input {...campo("telefono")} placeholder="Ej: 3415551234 (sin 0 ni 15)" />
        </label>
        <label className="col-2">Email<input type="email" {...campo("email")} /></label>
        <label className="check">
          <input type="checkbox" checked={!!p.es_socio} onChange={(e) => setP({ ...p, es_socio: e.target.checked ? 1 : 0 })} />
          Es socio (paga cuota societaria)
        </label>
        <label className="check">
          <input type="checkbox" checked={!!p.activo} onChange={(e) => setP({ ...p, activo: e.target.checked ? 1 : 0 })} />
          Activo
        </label>
        <fieldset className="col-2">
          <legend>Cursos en los que está inscripto</legend>
          {cursos.length === 0 && <span className="muted">No hay cursos cargados todavía.</span>}
          {cursos.map((c) => (
            <label key={c.id} className="check">
              <input type="checkbox" checked={inscripto.has(c.id)} onChange={() => alternarCurso(c.id)} />
              {c.nombre}{c.nivel ? ` (${c.nivel})` : ""}
            </label>
          ))}
        </fieldset>
        <label className="col-2">Notas<textarea rows={2} {...campo("notas")} /></label>
      </form>
    </Modal>
  );
}
