import { useCallback, useEffect, useState } from "react";
import CobroModal from "../components/CobroModal";
import ReciboModal from "../components/ReciboModal";
import { fecha, moneda, numeroRecibo } from "../lib/format";
import { anularPago, listarPagos } from "../lib/pagos";
import { PagoDetalle, TIPOS_PAGO } from "../lib/tipos";

export default function Cobros() {
  const [pagos, setPagos] = useState<PagoDetalle[]>([]);
  const [texto, setTexto] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [recibo, setRecibo] = useState<PagoDetalle | null>(null);

  const cargar = useCallback(async () => {
    setPagos(await listarPagos({ texto, desde, hasta }));
  }, [texto, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function anular(p: PagoDetalle) {
    if (!confirm(`¿Anular el recibo N° ${numeroRecibo(p.numero_recibo)}? Esta acción no se puede deshacer.`)) return;
    await anularPago(p.id);
    cargar();
  }

  const total = pagos.filter((p) => !p.anulado).reduce((s, p) => s + p.monto, 0);

  return (
    <section>
      <header className="pagina-cabecera">
        <div>
          <h1>Cobros y recibos</h1>
          <p className="muted">{pagos.length} recibos — total {moneda(total)}</p>
        </div>
        <button className="btn-primario" onClick={() => setNuevo(true)}>+ Nuevo cobro</button>
      </header>

      <div className="filtros">
        <input placeholder="Buscar por nombre o concepto…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <label>Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label>Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
      </div>

      <table className="tabla">
        <thead>
          <tr>
            <th>N°</th>
            <th>Fecha</th>
            <th>Persona</th>
            <th>Tipo</th>
            <th>Concepto</th>
            <th className="num">Monto</th>
            <th>WhatsApp</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pagos.map((p) => (
            <tr key={p.id} className={p.anulado ? "anulado" : ""}>
              <td>{numeroRecibo(p.numero_recibo)}</td>
              <td>{fecha(p.fecha)}</td>
              <td>{p.apellido}, {p.nombre}</td>
              <td><span className={`etiqueta etiqueta-${p.tipo}`}>{TIPOS_PAGO[p.tipo]}</span></td>
              <td>{p.concepto}{p.anulado ? " (ANULADO)" : ""}</td>
              <td className="num">{moneda(p.monto)}</td>
              <td>{p.enviado_whatsapp_en ? "✓ Enviado" : "—"}</td>
              <td className="acciones">
                <button onClick={() => setRecibo(p)}>Recibo</button>
                {!p.anulado && <button className="btn-peligro" onClick={() => anular(p)}>Anular</button>}
              </td>
            </tr>
          ))}
          {pagos.length === 0 && (
            <tr><td colSpan={8} className="vacio">Todavía no hay cobros registrados.</td></tr>
          )}
        </tbody>
      </table>

      {nuevo && (
        <CobroModal
          onCerrar={() => setNuevo(false)}
          onRegistrado={(pago) => {
            setNuevo(false);
            setRecibo(pago);
            cargar();
          }}
        />
      )}
      {recibo && <ReciboModal pago={recibo} onCerrar={() => setRecibo(null)} onEnviado={cargar} />}
    </section>
  );
}
