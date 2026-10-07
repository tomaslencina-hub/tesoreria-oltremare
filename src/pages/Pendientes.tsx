import { useCallback, useEffect, useState } from "react";
import CobroModal from "../components/CobroModal";
import { useConfig } from "../components/ConfigContext";
import ReciboModal from "../components/ReciboModal";
import { moneda, periodo as formatoPeriodo, periodoActual } from "../lib/format";
import { listarPendientes } from "../lib/pagos";
import { PagoDetalle, Pendiente, TIPOS_PAGO } from "../lib/tipos";

export default function Pendientes() {
  const config = useConfig();
  const [periodo, setPeriodo] = useState(periodoActual());
  const [filas, setFilas] = useState<Pendiente[]>([]);
  const [cobrando, setCobrando] = useState<Pendiente | null>(null);
  const [recibo, setRecibo] = useState<PagoDetalle | null>(null);

  const cargar = useCallback(async () => {
    setFilas(await listarPendientes(periodo, config.cuota_social));
  }, [periodo, config.cuota_social]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const total = filas.reduce((s, f) => s + f.monto, 0);

  return (
    <section>
      <header className="pagina-cabecera">
        <div>
          <h1>Cobros pendientes</h1>
          <p className="muted">
            Cuotas societarias y cursados de {formatoPeriodo(periodo)} que todavía no se cobraron.
          </p>
        </div>
        <input type="month" value={periodo} onChange={(e) => e.target.value && setPeriodo(e.target.value)} />
      </header>

      <div className="tarjetas">
        <div className="tarjeta"><span>Pendientes</span><strong>{filas.length}</strong></div>
        <div className="tarjeta"><span>Total a cobrar</span><strong>{moneda(total)}</strong></div>
      </div>

      <table className="tabla">
        <thead>
          <tr>
            <th>Persona</th>
            <th>Tipo</th>
            <th>Curso</th>
            <th className="num">Monto</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={`${f.persona_id}-${f.tipo}-${f.curso_id ?? ""}`}>
              <td>{f.apellido}, {f.nombre}</td>
              <td><span className={`etiqueta etiqueta-${f.tipo}`}>{TIPOS_PAGO[f.tipo]}</span></td>
              <td>{f.curso_nombre ?? "—"}</td>
              <td className="num">{moneda(f.monto)}</td>
              <td className="acciones">
                <button className="btn-primario" onClick={() => setCobrando(f)}>Cobrar</button>
              </td>
            </tr>
          ))}
          {filas.length === 0 && (
            <tr><td colSpan={5} className="vacio">No hay cobros pendientes para este período 🎉</td></tr>
          )}
        </tbody>
      </table>

      {cobrando && (
        <CobroModal
          inicial={{
            persona_id: cobrando.persona_id,
            tipo: cobrando.tipo,
            curso_id: cobrando.curso_id,
            periodo,
            monto: cobrando.monto,
          }}
          onCerrar={() => setCobrando(null)}
          onRegistrado={(pago) => {
            setCobrando(null);
            setRecibo(pago);
            cargar();
          }}
        />
      )}
      {recibo && <ReciboModal pago={recibo} onCerrar={() => setRecibo(null)} />}
    </section>
  );
}
