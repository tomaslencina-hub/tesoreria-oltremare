import { FormEvent, useEffect, useMemo, useState } from "react";
import { select } from "../lib/db";
import {
  aCentavos, centavosAInput, describirPeriodos, hoyISO, moneda,
  periodo as formatoPeriodo, periodoActual, rangoMeses, sumarMeses,
} from "../lib/format";
import { conceptoPara, listarPendientes, registrarRecibo } from "../lib/pagos";
import { Curso, MEDIOS_PAGO, Persona, ReciboDetalle, ReciboItem, TIPOS_ITEM, TipoItem } from "../lib/tipos";
import { useConfig } from "./ConfigContext";
import Modal from "./Modal";

interface Props {
  inicial?: { persona_id?: number; periodo?: string };
  onCerrar: () => void;
  onRegistrado: (recibo: ReciboDetalle) => void;
}

/**
 * Una fila del formulario = un concepto. Si es mensual (cuota societaria o cursado) cubre
 * varios meses y al guardar se registra un ítem por mes, con `monto` como importe mensual.
 */
interface Fila {
  clave: string;
  incluido: boolean;
  tipo: TipoItem;
  curso_id: number | null;
  periodos: string[];
  /** Meses del rango que esta persona ya tenía pagos (no se vuelven a cobrar). */
  yaPagados: string[];
  concepto: string; // sin el mes
  monto: string; // texto editable; mensual si hay períodos
}

let contador = 0;
const nuevaClave = () => `f${++contador}`;
const esMensual = (t: TipoItem) => t === "cuota_social" || t === "cursado";
const cantidad = (f: Fila) => Math.max(1, f.periodos.length);

export default function CobroModal({ inicial, onCerrar, onRegistrado }: Props) {
  const config = useConfig();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [personaId, setPersonaId] = useState<number | "">(inicial?.persona_id ?? "");
  const [desde, setDesde] = useState(inicial?.periodo ?? periodoActual());
  const [hasta, setHasta] = useState(inicial?.periodo ?? periodoActual());
  const [filas, setFilas] = useState<Fila[]>([]);
  const [medio, setMedio] = useState("transferencia");
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const meses = useMemo(() => rangoMeses(desde, hasta), [desde, hasta]);
  const anio = desde.slice(0, 4);

  useEffect(() => {
    select<Persona>("SELECT * FROM personas WHERE activo = 1 ORDER BY apellido, nombre").then(setPersonas);
    select<Curso>("SELECT * FROM cursos WHERE activo = 1 ORDER BY id").then(setCursos);
  }, []);

  // Para la persona y el rango de meses se proponen los conceptos que adeuda, con sus meses.
  useEffect(() => {
    if (personaId === "" || meses.length === 0) return setFilas([]);
    let vigente = true;
    Promise.all(meses.map((m) => listarPendientes(m, config.cuota_social, personaId).then((ps) => ps.map((p) => ({ ...p, mes: m })))))
      .then((porMes) => {
        if (!vigente) return;
        const grupos = new Map<string, Fila>();
        for (const p of porMes.flat()) {
          const clave = `${p.tipo}|${p.curso_id ?? ""}`;
          let f = grupos.get(clave);
          if (!f) {
            f = {
              clave: nuevaClave(), incluido: true, tipo: p.tipo, curso_id: p.curso_id, periodos: [], yaPagados: [],
              concepto: conceptoPara(p.tipo, p.curso_nombre, null), monto: centavosAInput(p.monto),
            };
            grupos.set(clave, f);
          }
          f.periodos.push(p.mes);
        }
        for (const f of grupos.values()) f.yaPagados = meses.filter((m) => !f.periodos.includes(m));
        setFilas([...grupos.values()]);
      });
    return () => { vigente = false; };
  }, [personaId, meses, config.cuota_social]);

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return t ? personas.filter((p) => `${p.apellido} ${p.nombre}`.toLowerCase().includes(t)) : personas;
  }, [personas, busqueda]);

  const incluidas = filas.filter((f) => f.incluido);
  const total = incluidas.reduce((s, f) => s + aCentavos(f.monto) * cantidad(f), 0);

  function cambiar(clave: string, cambios: Partial<Fila>) {
    setFilas((xs) => xs.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  }

  function agregar(tipo: TipoItem) {
    const curso = tipo === "inscripcion" || tipo === "cursado" ? cursos[0] ?? null : null;
    const monto = tipo === "cuota_social" ? config.cuota_social : tipo === "cursado" ? curso?.cuota_mensual ?? 0 : 0;
    setFilas((xs) => [...xs, {
      clave: nuevaClave(), incluido: true, tipo, curso_id: curso?.id ?? null,
      periodos: esMensual(tipo) ? meses : [], yaPagados: [],
      concepto: conceptoPara(tipo, curso?.nombre ?? null, null), monto: monto ? centavosAInput(monto) : "",
    }]);
  }

  function cambiarCurso(f: Fila, cursoId: number) {
    const c = cursos.find((x) => x.id === cursoId) ?? null;
    cambiar(f.clave, {
      curso_id: cursoId,
      concepto: conceptoPara(f.tipo, c?.nombre ?? null, null),
      ...(f.tipo === "cursado" && c ? { monto: centavosAInput(c.cuota_mensual) } : {}),
    });
  }

  function rango(d: string, h: string) {
    setDesde(d);
    setHasta(h < d ? d : h);
  }

  /** Expande cada fila mensual en un ítem por mes. */
  function itemsARegistrar(): ReciboItem[] {
    return incluidas.flatMap((f): ReciboItem[] => {
      const monto = aCentavos(f.monto);
      const concepto = f.concepto.trim();
      if (f.periodos.length === 0) return [{ tipo: f.tipo, curso_id: f.curso_id, periodo: null, concepto, monto }];
      return [...f.periodos].sort().map((p) => ({
        tipo: f.tipo, curso_id: f.curso_id, periodo: p, concepto: `${concepto} ${formatoPeriodo(p)}`, monto,
      }));
    });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (personaId === "") return setError("Elegí una persona");
    if (incluidas.length === 0) return setError("No hay nada para cobrar");
    for (const f of incluidas) {
      if (!f.concepto.trim()) return setError("Todos los conceptos necesitan un nombre");
      if (aCentavos(f.monto) <= 0) return setError(`El monto de "${f.concepto}" debe ser mayor a cero`);
      if (esMensual(f.tipo) && f.periodos.length === 0) return setError(`"${f.concepto}" no tiene meses para cobrar`);
    }
    const items = itemsARegistrar();

    // Aviso si algún mes ya figura en otro recibo (ej. ítems agregados a mano).
    const duplicados: string[] = [];
    for (const i of items.filter((x) => x.periodo && esMensual(x.tipo))) {
      const dup = await select<{ numero: number }>(
        `SELECT r.numero FROM recibo_items it JOIN recibos r ON r.id = it.recibo_id
          WHERE r.anulado = 0 AND r.persona_id = $1 AND it.tipo = $2 AND it.periodo = $3
            AND ($4 IS NULL OR it.curso_id = $4)`,
        [personaId, i.tipo, i.periodo, i.curso_id],
      );
      if (dup.length) duplicados.push(`${i.concepto} (recibo N° ${dup[0].numero})`);
    }
    if (duplicados.length && !confirm(`Ya están pagos:\n${duplicados.join("\n")}\n\n¿Registrar igual?`)) return;

    setGuardando(true);
    try {
      onRegistrado(await registrarRecibo({
        persona_id: personaId,
        fecha: fechaPago,
        medio_pago: medio,
        observaciones: observaciones.trim() || null,
        items,
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
      ancho={820}
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

        <div className="col-2 rango-meses">
          <label>
            Paga desde
            <input type="month" value={desde} onChange={(e) => e.target.value && rango(e.target.value, hasta)} required />
          </label>
          <label>
            hasta
            <input type="month" value={hasta} min={desde} onChange={(e) => e.target.value && rango(desde, e.target.value)} required />
          </label>
          <div className="atajos">
            <button type="button" onClick={() => rango(desde, desde)}>Un mes</button>
            <button type="button" onClick={() => rango(desde, sumarMeses(desde, 1))}>2 meses</button>
            <button type="button" onClick={() => rango(desde, sumarMeses(desde, 2))}>3 meses</button>
            <button type="button" onClick={() => rango(desde, `${anio}-12`)}>Hasta diciembre</button>
            <button type="button" onClick={() => rango(`${anio}-01`, `${anio}-12`)}>Año {anio} completo</button>
          </div>
        </div>

        <div className="col-2 items">
          <div className="items-cabecera">
            <strong>{meses.length > 1 ? `Conceptos (${describirPeriodos(meses)})` : "Conceptos"}</strong>
            <span className="items-agregar">
              Agregar:
              {(Object.keys(TIPOS_ITEM) as TipoItem[]).map((t) => (
                <button type="button" key={t} onClick={() => agregar(t)}>{TIPOS_ITEM[t]}</button>
              ))}
            </span>
          </div>
          {personaId !== "" && filas.length === 0 && (
            <p className="muted">No adeuda nada de {describirPeriodos(meses)}. Podés agregar conceptos a mano.</p>
          )}
          {filas.map((f) => (
            <div key={f.clave} className={`item ${f.incluido ? "" : "item-excluido"}`}>
              <input type="checkbox" checked={f.incluido} onChange={(e) => cambiar(f.clave, { incluido: e.target.checked })} />
              <span className={`etiqueta etiqueta-${f.tipo}`}>{TIPOS_ITEM[f.tipo]}</span>
              {(f.tipo === "cursado" || f.tipo === "inscripcion") && (
                <select value={f.curso_id ?? ""} onChange={(e) => cambiarCurso(f, Number(e.target.value))}>
                  {cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              )}
              <div className="item-detalle">
                <input className="item-concepto" value={f.concepto} onChange={(e) => cambiar(f.clave, { concepto: e.target.value })} placeholder="Concepto" />
                {f.periodos.length > 0 && (
                  <small className="muted">
                    {describirPeriodos(f.periodos)}
                    {f.yaPagados.length > 0 && ` · ya pagó ${describirPeriodos(f.yaPagados)}`}
                  </small>
                )}
              </div>
              <span className="item-cantidad">{f.periodos.length > 1 ? `${f.periodos.length} ×` : ""}</span>
              <input className="item-monto" value={f.monto} onChange={(e) => cambiar(f.clave, { monto: e.target.value })} inputMode="decimal" placeholder="0,00"
                title={f.periodos.length > 1 ? "Importe por mes" : "Importe"} />
              <span className="item-subtotal">{moneda(aCentavos(f.monto) * cantidad(f))}</span>
              <button type="button" className="btn-icono" title="Quitar" onClick={() => setFilas((xs) => xs.filter((x) => x.clave !== f.clave))}>×</button>
            </div>
          ))}
        </div>

        <label>
          Fecha de pago
          <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} required />
        </label>
        <label>
          Medio de pago
          <select value={medio} onChange={(e) => setMedio(e.target.value)} className="capitalizar">
            {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="col-2">
          Observaciones
          <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </label>
      </form>
    </Modal>
  );
}
