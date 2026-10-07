import { FormEvent, useCallback, useEffect, useState } from "react";
import Modal from "../components/Modal";
import { execute, select } from "../lib/db";
import { aCentavos, centavosAInput, moneda } from "../lib/format";
import { Curso } from "../lib/tipos";

type CursoFila = Curso & { inscriptos: number };

export default function Cursos() {
  const [filas, setFilas] = useState<CursoFila[]>([]);
  const [editando, setEditando] = useState<Partial<Curso> | null>(null);

  const cargar = useCallback(async () => {
    setFilas(
      await select<CursoFila>(
        `SELECT c.*, (SELECT COUNT(*) FROM inscripciones i JOIN personas p ON p.id = i.persona_id
                       WHERE i.curso_id = c.id AND i.activo = 1 AND p.activo = 1) AS inscriptos
           FROM cursos c ORDER BY c.activo DESC, c.nombre`,
      ),
    );
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <section>
      <header className="pagina-cabecera">
        <div>
          <h1>Cursos</h1>
          <p className="muted">Cada curso define la cuota mensual de cursado.</p>
        </div>
        <button className="btn-primario" onClick={() => setEditando({ nombre: "", nivel: "", cuota_mensual: 0, activo: 1 })}>
          + Nuevo curso
        </button>
      </header>

      <table className="tabla">
        <thead>
          <tr><th>Curso</th><th>Nivel</th><th className="num">Cuota mensual</th><th className="num">Inscriptos</th><th></th></tr>
        </thead>
        <tbody>
          {filas.map((c) => (
            <tr key={c.id} className={c.activo ? "" : "anulado"}>
              <td>{c.nombre}</td>
              <td>{c.nivel}</td>
              <td className="num">{moneda(c.cuota_mensual)}</td>
              <td className="num">{c.inscriptos}</td>
              <td className="acciones"><button onClick={() => setEditando(c)}>Editar</button></td>
            </tr>
          ))}
          {filas.length === 0 && <tr><td colSpan={5} className="vacio">No hay cursos cargados.</td></tr>}
        </tbody>
      </table>

      {editando && (
        <CursoModal curso={editando} onCerrar={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar(); }} />
      )}
    </section>
  );
}

function CursoModal({ curso, onCerrar, onGuardado }: {
  curso: Partial<Curso>;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState(curso.nombre ?? "");
  const [nivel, setNivel] = useState(curso.nivel ?? "");
  const [cuota, setCuota] = useState(centavosAInput(curso.cuota_mensual ?? 0));
  const [activo, setActivo] = useState(curso.activo !== 0);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError("El nombre es obligatorio");
    const vals = [nombre.trim(), nivel.trim() || null, aCentavos(cuota), activo ? 1 : 0];
    try {
      if (curso.id) {
        await execute("UPDATE cursos SET nombre=$1, nivel=$2, cuota_mensual=$3, activo=$4 WHERE id=$5", [...vals, curso.id]);
      } else {
        await execute("INSERT INTO cursos (nombre, nivel, cuota_mensual, activo) VALUES ($1, $2, $3, $4)", vals);
      }
      onGuardado();
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <Modal
      titulo={curso.id ? "Editar curso" : "Nuevo curso"}
      onCerrar={onCerrar}
      ancho={460}
      pie={
        <>
          {error && <span className="error">{error}</span>}
          <button onClick={onCerrar}>Cancelar</button>
          <button className="btn-primario" type="submit" form="form-curso">Guardar</button>
        </>
      }
    >
      <form id="form-curso" className="form" onSubmit={guardar}>
        <label className="col-2">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></label>
        <label>Nivel<input value={nivel} onChange={(e) => setNivel(e.target.value)} placeholder="A1, B2…" /></label>
        <label>Cuota mensual ($)<input value={cuota} onChange={(e) => setCuota(e.target.value)} inputMode="decimal" /></label>
        <label className="check col-2">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activo
        </label>
      </form>
    </Modal>
  );
}
