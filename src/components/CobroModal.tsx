import { FormEvent, useEffect, useMemo, useState } from "react";
import { select } from "../lib/db";
import { aCentavos, centavosAInput, hoyISO, periodoActual } from "../lib/format";
import { conceptoPara, NuevoPago, registrarPago } from "../lib/pagos";
import { Curso, MEDIOS_PAGO, PagoDetalle, Persona, TIPOS_PAGO, TipoPago } from "../lib/tipos";
import { useConfig } from "./ConfigContext";
import Modal from "./Modal";

interface Props {
  inicial?: { persona_id?: number; tipo?: TipoPago; curso_id?: number | null; periodo?: string; monto?: number };
  onCerrar: () => void;
  onRegistrado: (pago: PagoDetalle) => void;
}

export default function CobroModal({ inicial, onCerrar, onRegistrado }: Props) {
  const config = useConfig();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [inscriptos, setInscriptos] = useState<number[]>([]);

  const [personaId, setPersonaId] = useState<number | "">(inicial?.persona_id ?? "");
  const [tipo, setTipo] = useState<TipoPago>(inicial?.tipo ?? "cursado");
  const [cursoId, setCursoId] = useState<number | "">(inicial?.curso_id ?? "");
  const [periodo, setPeriodo] = useState(inicial?.periodo ?? periodoActual());
  const [monto, setMonto] = useState(inicial?.monto != null ? centavosAInput(inicial.monto) : "");
  const [concepto, setConcepto] = useState("");
  const [conceptoEditado, setConceptoEditado] = useState(false);
  const [medio, setMedio] = useState(MEDIOS_PAGO[0]);
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    select<Persona>("SELECT * FROM personas WHERE activo = 1 ORDER BY apellido, nombre").then(setPersonas);
    select<Curso>("SELECT * FROM cursos WHERE activo = 1 ORDER BY nombre").then(setCursos);
  }, []);

  useEffect(() => {
    if (personaId === "") return setInscriptos([]);
    select<{ curso_id: number }>(
      "SELECT curso_id FROM inscripciones WHERE persona_id = $1 AND activo = 1",
      [personaId],
    ).then((f) => setInscriptos(f.map((x) => x.curso_id)));
  }, [personaId]);

  // Primero los cursos en los que la persona está inscripta.
  const cursosOrdenados = useMemo(
    () => [...cursos].sort((a, b) => Number(inscriptos.includes(b.id)) - Number(inscriptos.includes(a.id))),
    [cursos, inscriptos],
  );
  const curso = cursos.find((c) => c.id === cursoId) ?? null;

  // Al elegir persona en cursado, si tiene un único curso se selecciona solo.
  useEffect(() => {
    if (tipo === "cursado" && cursoId === "" && inscriptos.length === 1) setCursoId(inscriptos[0]);
  }, [tipo, inscriptos, cursoId]);

  // Monto sugerido según tipo/curso (solo si el usuario no lo cambió desde un valor inicial).
  useEffect(() => {
    if (inicial?.monto != null) return;
    if (tipo === "cuota_social") setMonto(centavosAInput(config.cuota_social));
    else if (tipo === "cursado" && curso) setMonto(centavosAInput(curso.cuota_mensual));
  }, [tipo, curso, config.cuota_social, inicial?.monto]);

  useEffect(() => {
    if (!conceptoEditado) setConcepto(conceptoPara(tipo, curso?.nombre ?? null, tipo === "otro" ? null : periodo));
  }, [tipo, curso, periodo, conceptoEditado]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const centavos = aCentavos(monto);
    if (personaId === "") return setError("Elegí una persona");
    if (tipo === "cursado" && cursoId === "") return setError("Elegí el curso");
    if (centavos <= 0) return setError("El monto debe ser mayor a cero");
    if (!concepto.trim()) return setError("Completá el concepto");

    const nuevo: NuevoPago = {
      persona_id: personaId,
      tipo,
      curso_id: tipo === "cursado" ? Number(cursoId) : null,
      periodo: tipo === "otro" ? null : periodo,
      concepto: concepto.trim(),
      monto: centavos,
      medio_pago: medio,
      fecha: fechaPago,
      observaciones: observaciones.trim() || null,
    };

    if (nuevo.periodo) {
      const dup = await select<{ numero_recibo: number }>(
        `SELECT numero_recibo FROM pagos
          WHERE persona_id = $1 AND tipo = $2 AND periodo = $3 AND anulado = 0
            AND ($4 IS NULL OR curso_id = $4)`,
        [nuevo.persona_id, nuevo.tipo, nuevo.periodo, nuevo.curso_id],
      );
      if (dup.length && !confirm(`Ya existe el recibo N° ${dup[0].numero_recibo} para ese período. ¿Registrar igual?`)) {
        return;
      }
    }

    setGuardando(true);
    try {
      onRegistrado(await registrarPago(nuevo));
    } catch (err) {
      setError(String(err));
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Registrar cobro"
      onCerrar={onCerrar}
      pie={
        <>
          {error && <span className="error">{error}</span>}
          <button onClick={onCerrar}>Cancelar</button>
          <button className="btn-primario" type="submit" form="form-cobro" disabled={guardando}>
            Registrar y ver recibo
          </button>
        </>
      }
    >
      <form id="form-cobro" className="form" onSubmit={guardar}>
        <label className="col-2">
          Persona
          <select value={personaId} onChange={(e) => { setPersonaId(e.target.value ? Number(e.target.value) : ""); setCursoId(""); }} autoFocus>
            <option value="">— Elegir —</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.apellido}, {p.nombre}{p.es_socio ? " (socio)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPago)}>
            {Object.entries(TIPOS_PAGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {tipo !== "otro" && (
          <label>
            Período
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} required />
          </label>
        )}
        {tipo === "cursado" && (
          <label className="col-2">
            Curso
            <select value={cursoId} onChange={(e) => setCursoId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— Elegir —</option>
              {cursosOrdenados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}{c.nivel ? ` (${c.nivel})` : ""}{inscriptos.includes(c.id) ? " ✓ inscripto" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="col-2">
          Concepto
          <input value={concepto} onChange={(e) => { setConcepto(e.target.value); setConceptoEditado(true); }} />
        </label>
        <label>
          Monto ($)
          <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" placeholder="0,00" />
        </label>
        <label>
          Medio de pago
          <select value={medio} onChange={(e) => setMedio(e.target.value)} className="capitalizar">
            {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label>
          Fecha
          <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} required />
        </label>
        <label className="col-2">
          Observaciones
          <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </label>
      </form>
    </Modal>
  );
}
