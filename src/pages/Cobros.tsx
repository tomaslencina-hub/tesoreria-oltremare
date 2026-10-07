import { useCallback, useEffect, useState } from "react";
import CobroModal from "../components/CobroModal";
import { useConfirmar } from "../components/Confirmar";
import ReciboModal from "../components/ReciboModal";
import { fecha, moneda, numeroRecibo } from "../lib/format";
import { anularRecibo, listarRecibos, describirRecibo } from "../lib/pagos";
import { ReciboDetalle } from "../lib/tipos";

export default function Cobros() {
  const [recibos, setRecibos] = useState<ReciboDetalle[]>([]);
  const [texto, setTexto] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [recibo, setRecibo] = useState<ReciboDetalle | null>(null);
  const confirmar = useConfirmar();

  const cargar = useCallback(async () => {
    setRecibos(await listarRecibos({ texto, desde, hasta }));
  }, [texto, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function anular(r: ReciboDetalle) {
    const ok = await confirmar({
      titulo: `Anular recibo N° ${numeroRecibo(r.numero)}`,
      aceptar: "Anular recibo",
      peligro: true,
      mensaje: (
        <>
          <dl className="resumen">
            <dt>Persona</dt><dd>{r.apellido}, {r.nombre}</dd>
            <dt>Fecha</dt><dd>{fecha(r.fecha)}</dd>
            <dt>Detalle</dt><dd>{describirRecibo(r.items)}</dd>
            <dt>Total</dt><dd><strong>{moneda(r.total)}</strong></dd>
          </dl>
          <p className="aviso-peligro">
            El recibo queda registrado como anulado y esos meses vuelven a figurar como pendientes.
            No se puede deshacer.
          </p>
        </>
      ),
    });
    if (!ok) return;
    await anularRecibo(r.id);
    cargar();
  }

  const total = recibos.filter((r) => !r.anulado).reduce((s, r) => s + r.total, 0);

  return (
    <section>
      <header className="pagina-cabecera">
        <div>
          <h1>Cobros y recibos</h1>
          <p className="muted">{recibos.length} recibos — total {moneda(total)}</p>
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
            <th>Detalle</th>
            <th className="num">Total</th>
            <th>WhatsApp</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {recibos.map((r) => (
            <tr key={r.id} className={r.anulado ? "anulado" : ""}>
              <td>{numeroRecibo(r.numero)}</td>
              <td>{fecha(r.fecha)}</td>
              <td>{r.apellido}, {r.nombre}</td>
              <td>{describirRecibo(r.items)}{r.anulado ? " (ANULADO)" : ""}</td>
              <td className="num">{moneda(r.total)}</td>
              <td>{r.enviado_whatsapp_en ? "✓ Enviado" : "—"}</td>
              <td className="acciones">
                <button onClick={() => setRecibo(r)}>Ver</button>
                {!r.anulado && <button className="btn-peligro" onClick={() => anular(r)}>Anular</button>}
              </td>
            </tr>
          ))}
          {recibos.length === 0 && (
            <tr><td colSpan={7} className="vacio">Todavía no hay cobros registrados.</td></tr>
          )}
        </tbody>
      </table>

      {nuevo && (
        <CobroModal
          onCerrar={() => setNuevo(false)}
          onRegistrado={(r) => {
            setNuevo(false);
            setRecibo(r);
            cargar();
          }}
        />
      )}
      {recibo && <ReciboModal recibo={recibo} onCerrar={() => setRecibo(null)} onEnviado={cargar} />}
    </section>
  );
}
