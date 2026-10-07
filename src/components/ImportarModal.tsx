import { ChangeEvent, useState } from "react";
import { leerAlumnos, leerAlumnosDeFilas } from "../lib/csv";
import { select } from "../lib/db";
import { leerFilasExcel } from "../lib/excel";
import { aplicarPlan, Inscripcion, PlanFila, planificar } from "../lib/importacion";
import { Curso, Persona } from "../lib/tipos";
import Modal from "./Modal";

type Filtro = "cambios" | "todas";

export default function ImportarModal({ onCerrar, onImportado }: { onCerrar: () => void; onImportado: () => void }) {
  const [planes, setPlanes] = useState<PlanFila[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("cambios");
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function elegir(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setResultado(null);
    setPlanes([]);
    let leido: ReturnType<typeof leerAlumnos>;
    try {
      leido = /\.xlsx$/i.test(f.name) ? leerAlumnosDeFilas(await leerFilasExcel(f)) : leerAlumnos(await f.text());
    } catch (err) {
      setErrores([`No se pudo leer el archivo: ${err}`]);
      return;
    }
    const [cursos, personas, inscripciones] = await Promise.all([
      select<Curso>("SELECT * FROM cursos"),
      select<Persona>("SELECT * FROM personas"),
      select<Inscripcion>("SELECT persona_id, curso_id, activo FROM inscripciones"),
    ]);
    setErrores(leido.errores);
    setPlanes(planificar(leido.filas, personas, cursos, inscripciones));
  }

  async function importar() {
    setImportando(true);
    try {
      const { nuevas, modificadas } = await aplicarPlan(planes);
      setResultado(`Listo: ${nuevas} personas nuevas y ${modificadas} actualizadas.`);
      setPlanes([]);
      onImportado();
    } catch (e) {
      setResultado(`Error durante la importación: ${e}`);
    } finally {
      setImportando(false);
    }
  }

  const validos = planes.filter((p) => !p.problema);
  const nuevas = validos.filter((p) => p.personaId === null);
  const conCambios = validos.filter((p) => p.personaId !== null && p.cambios.length > 0);
  const sinCambios = validos.length - nuevas.length - conCambios.length;
  const conProblema = planes.length - validos.length;
  const aAplicar = nuevas.length + conCambios.length;
  const visibles = filtro === "todas" ? planes : planes.filter((p) => p.problema || p.personaId === null || p.cambios.length);

  return (
    <Modal
      titulo="Importar alumnos"
      onCerrar={onCerrar}
      ancho={880}
      pie={
        <>
          {resultado && <span className={resultado.startsWith("Error") ? "error" : "ok"}>{resultado}</span>}
          <button onClick={onCerrar}>Cerrar</button>
          <button className="btn-primario" onClick={importar} disabled={importando || aAplicar === 0}>
            {aAplicar ? `Aplicar ${aAplicar} cambios` : "Importar"}
          </button>
        </>
      }
    >
      <p className="muted">
        Elegí la planilla de alumnos (<code>.xlsx</code>) o un CSV con las mismas columnas. Las personas que ya existen no se
        duplican: se actualiza lo que la planilla trae escrito (teléfono, DNI, socio, activo, cursos). Las celdas vacías no borran nada.
      </p>
      <label className="archivo">
        <input type="file" accept=".xlsx,.csv,.txt" onChange={elegir} />
      </label>

      {errores.map((e) => <p key={e} className="error">{e}</p>)}

      {planes.length > 0 && (
        <>
          <div className="importar-resumen">
            <span><strong>{nuevas.length}</strong> nuevas</span>
            <span><strong>{conCambios.length}</strong> con cambios</span>
            <span className="muted"><strong>{sinCambios}</strong> sin cambios</span>
            {conProblema > 0 && <span className="error"><strong>{conProblema}</strong> con problemas</span>}
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
              <option value="cambios">Ver solo lo que cambia</option>
              <option value="todas">Ver todas las filas</option>
            </select>
          </div>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr><th>Apellido y nombre</th><th>Curso</th><th>Qué pasa</th></tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.fila.linea}>
                    <td>{p.fila.apellido}, {p.fila.nombre}</td>
                    <td>{p.fila.cursos.join(" + ")}</td>
                    <td>
                      {p.problema ? <span className="error">{p.problema}</span>
                        : p.personaId === null ? <span className="etiqueta etiqueta-cursado">{p.fila.activo ? "Nueva" : "Nueva (baja)"}</span>
                        : p.cambios.length ? <ul className="cambios">{p.cambios.map((c) => <li key={c}>{c}</li>)}</ul>
                        : <span className="muted">Sin cambios</span>}
                    </td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr><td colSpan={3} className="vacio">La planilla coincide con lo que ya está cargado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
