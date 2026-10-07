import { FormEvent, useEffect, useMemo, useState } from "react";
import { select } from "../lib/db";
import { aCentavos, centavosAInput, hoyISO, moneda, periodo as formatoPeriodo, periodoActual } from "../lib/format";
import { conceptoPara, listarPendientes, registrarRecibo } from "../lib/pagos";
import { Curso, MEDIOS_PAGO, Persona, ReciboDetalle, TIPOS_ITEM, TipoItem } from "../lib/tipos";
import { useConfig } from "./ConfigContext";
import Modal from "./Modal";

interface Props {
  inicial?: { persona_id?: number; periodo?: string };
  onCerrar: () => void;
  onRegistrado: (recibo: ReciboDetalle) => void;
}

interface ItemForm {
  clave: string;
  incluido: boolean;
  tipo: TipoItem;
  curso_id: number | null;
  periodo: string | null;
  concepto: string;
  monto: string; // texto editable
}

let contador = 0;
const nuevaClave = () => `i${++contador}`;

export default function CobroModal({ inicial, onCerrar, onRegistrado }: Props) {
  const config = useConfig();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [personaId, setPersonaId] = useState<number | "">(inicial?.persona_id ?? "");
  const [periodo, setPeriodo] = useState(inicial?.periodo ?? periodoActual());
  const [items, setItems] = useState<ItemForm[]>([]);
  const [medio, setMedio] = useState("transferencia");
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    select<Persona>("SELECT * FROM personas WHERE activo = 1 ORDER BY apellido, nombre").then(setPersonas);
    select<Curso>("SELECT * FROM cursos WHERE activo = 1 ORDER BY id").then(setCursos);
  }, []);

  // Al elegir persona o mes se proponen los ítems que adeuda para ese período.
  useEffect(() => {
    if (personaId === "") return setItems([]);
    let vigente = true;
    listarPendientes(periodo, config.cuota_social, personaId).then((pend) => {
      if (!vigente) return;
      setItems(
        pend.map((p) => ({
          clave: nuevaClave(),
          incluido: true,
          tipo: p.tipo,
          curso_id: p.curso_id,
          periodo,
          concepto: conceptoPara(p.tipo, p.curso_nombre, periodo),
          monto: centavosAInput(p.monto),
        })),
      );
    });
    return () => { vigente = false; };
  }, [personaId, periodo, config.cuota_social]);

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return t ? personas.filter((p) => `${p.apellido} ${p.nombre}`.toLowerCase().includes(t)) : personas;
  }, [personas, busqueda]);

  const incluidos = items.filter((i) => i.incluido);
  const total = incluidos.reduce((s, i) => s + aCentavos(i.monto), 0);

  function cambiar(clave: string, cambios: Partial<ItemForm>) {
    setItems((xs) => xs.map((i) => (i.clave === clave ? { ...i, ...cambios } : i)));
  }

  function agregar(tipo: TipoItem) {
    const curso = tipo === "inscripcion" || tipo === "cursado" ? cursos[0] ?? null : null;
    const per = tipo === "cuota_social" || tipo === "cursado" ? periodo : null;
    const monto = tipo === "cuota_social" ? config.cuota_social : tipo === "cursado" ? curso?.cuota_mensual ?? 0 : 0;
    setItems((xs) => [...xs, {
      clave: nuevaClave(), incluido: true, tipo, curso_id: curso?.id ?? null, periodo: per,
      concepto: conceptoPara(tipo, curso?.nombre ?? null, per), monto: monto ? centavosAInput(monto) : "",
    }]);
  }

  function cambiarCurso(item: ItemForm, cursoId: number) {
    const c = cursos.find((x) => x.id === cursoId) ?? null;
    cambiar(item.clave, {
      curso_id: cursoId,
      concepto: conceptoPara(item.tipo, c?.nombre ?? null, item.periodo),
      ...(item.tipo === "cursado" && c ? { monto: centavosAInput(c.cuota_mensual) } : {}),
    });
  }

  function cambiarPeriodoItem(item: ItemForm, per: string) {
    const c = cursos.find((x) => x.id === item.curso_id) ?? null;
    cambiar(item.clave, { periodo: per, concepto: conceptoPara(item.tipo, c?.nombre ?? null, per) });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (personaId === "") return setError("Elegí una persona");
    if (incluidos.length === 0) return setError("No hay ítems para cobrar");
    for (const i of incluidos) {
      if (!i.concepto.trim()) return setError("Todos los ítems necesitan un concepto");
      if (aCentavos(i.monto) <= 0) return setError(`El monto de "${i.concepto}" debe ser mayor a cero`);
    }

    // Aviso si algún ítem con período ya figura en otro recibo.
    for (const i of incluidos.filter((x) => x.periodo && (x.tipo === "cuota_social" || x.tipo === "cursado"))) {
      const dup = await select<{ numero: number }>(
        `SELECT r.numero FROM recibo_items it JOIN recibos r ON r.id = it.recibo_id
          WHERE r.anulado = 0 AND r.persona_id = $1 AND it.tipo = $2 AND it.periodo = $3
            AND ($4 IS NULL OR it.curso_id = $4)`,
        [personaId, i.tipo, i.periodo, i.curso_id],
      );
      if (dup.length && !confirm(`"${i.concepto}" ya figura en el recibo N° ${dup[0].numero}. ¿Registrar igual?`)) return;
    }

    setGuardando(true);
    try {
      onRegistrado(await registrarRecibo({
        persona_id: personaId,
        fecha: fechaPago,
        medio_pago: medio,
        observaciones: observaciones.trim() || null,
        items: incluidos.map((i) => ({
          tipo: i.tipo,
          curso_id: i.curso_id,
          periodo: i.periodo,
          concepto: i.concepto.trim(),
          monto: aCentavos(i.monto),
        })),
      }));
    } catch (err) {
      setError(String(err));
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Registrar cobro"
      onCerrar={onCerrar}
      ancho={760}
      pie={
        <>
          {error && <span className="error">{error}</span>}
          <span className="total-pie">Total: <strong>{moneda(total)}</strong></span>
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
          <div className="buscador-persona">
            {!inicial?.persona_id && (
              <input placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} autoFocus />
            )}
            <select
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value ? Number(e.target.value) : "")}
              disabled={!!inicial?.persona_id}
            >
              <option value="">— Elegir ({filtradas.length}) —</option>
              {filtradas.map((p) => (
                <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
              ))}
            </select>
          </div>
        </label>
        <label>
          Mes que paga
          <input type="month" value={periodo} onChange={(e) => e.target.value && setPeriodo(e.target.value)} required />
        </label>
        <label>
          Fecha de pago
          <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} required />
        </label>

        <div className="col-2 items">
          <div className="items-cabecera">
            <strong>Ítems del recibo</strong>
            <span className="items-agregar">
              Agregar:
              {(Object.keys(TIPOS_ITEM) as TipoItem[]).map((t) => (
                <button type="button" key={t} onClick={() => agregar(t)}>{TIPOS_ITEM[t]}</button>
              ))}
            </span>
          </div>
          {personaId !== "" && items.length === 0 && (
            <p className="muted">No adeuda nada de {formatoPeriodo(periodo)}. Podés agregar ítems a mano (ej. adelantos).</p>
          )}
          {items.map((i) => (
            <div key={i.clave} className={`item ${i.incluido ? "" : "item-excluido"}`}>
              <input type="checkbox" checked={i.incluido} onChange={(e) => cambiar(i.clave, { incluido: e.target.checked })} />
              <span className={`etiqueta etiqueta-${i.tipo}`}>{TIPOS_ITEM[i.tipo]}</span>
              {(i.tipo === "cursado" || i.tipo === "inscripcion") && (
                <select value={i.curso_id ?? ""} onChange={(e) => cambiarCurso(i, Number(e.target.value))}>
                  {cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              )}
              {i.periodo !== null && (
                <input type="month" value={i.periodo} onChange={(e) => e.target.value && cambiarPeriodoItem(i, e.target.value)} />
              )}
              <input className="item-concepto" value={i.concepto} onChange={(e) => cambiar(i.clave, { concepto: e.target.value })} placeholder="Concepto" />
              <input className="item-monto" value={i.monto} onChange={(e) => cambiar(i.clave, { monto: e.target.value })} inputMode="decimal" placeholder="0,00" />
              <button type="button" className="btn-icono" title="Quitar" onClick={() => setItems((xs) => xs.filter((x) => x.clave !== i.clave))}>×</button>
            </div>
          ))}
        </div>

        <label>
          Medio de pago
          <select value={medio} onChange={(e) => setMedio(e.target.value)} className="capitalizar">
            {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label>
          Observaciones
          <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </label>
      </form>
    </Modal>
  );
}
