import { useEffect, useState } from "react";
import { useConfig } from "../components/ConfigContext";
import { fecha, hoyISO, moneda, numeroRecibo, periodo, periodoActual } from "../lib/format";
import { listarPagos, listarPendientes, resumen, Resumen } from "../lib/pagos";
import { PagoDetalle } from "../lib/tipos";

export default function Panel({ irA }: { irA: (pagina: "pendientes" | "cobros") => void }) {
  const config = useConfig();
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [pendientes, setPendientes] = useState({ cantidad: 0, total: 0 });
  const [ultimos, setUltimos] = useState<PagoDetalle[]>([]);
  const mes = periodoActual();

  useEffect(() => {
    resumen(mes, hoyISO()).then(setDatos);
    listarPendientes(mes, config.cuota_social).then((f) =>
      setPendientes({ cantidad: f.length, total: f.reduce((s, x) => s + x.monto, 0) }),
    );
    listarPagos().then((p) => setUltimos(p.slice(0, 8)));
  }, [mes, config.cuota_social]);

  return (
    <section>
      <header className="pagina-cabecera">
        <div>
          <h1>Benvenuti!</h1>
          <p className="muted">Resumen de {periodo(mes)}</p>
        </div>
      </header>

      <div className="tarjetas">
        <div className="tarjeta"><span>Cobrado hoy</span><strong>{moneda(datos?.cobrado_hoy ?? 0)}</strong></div>
        <div className="tarjeta">
          <span>Cobrado en el mes</span>
          <strong>{moneda(datos?.cobrado_mes ?? 0)}</strong>
          <small>{datos?.cantidad_mes ?? 0} recibos</small>
        </div>
        <button className="tarjeta tarjeta-accion" onClick={() => irA("pendientes")}>
          <span>Pendiente del mes</span>
          <strong>{moneda(pendientes.total)}</strong>
          <small>{pendientes.cantidad} cobros pendientes →</small>
        </button>
      </div>

      <h2>Últimos cobros</h2>
      <table className="tabla">
        <thead>
          <tr><th>N°</th><th>Fecha</th><th>Persona</th><th>Concepto</th><th className="num">Monto</th></tr>
        </thead>
        <tbody>
          {ultimos.map((p) => (
            <tr key={p.id} className={p.anulado ? "anulado" : ""}>
              <td>{numeroRecibo(p.numero_recibo)}</td>
              <td>{fecha(p.fecha)}</td>
              <td>{p.apellido}, {p.nombre}</td>
              <td>{p.concepto}</td>
              <td className="num">{moneda(p.monto)}</td>
            </tr>
          ))}
          {ultimos.length === 0 && (
            <tr><td colSpan={5} className="vacio">Todavía no hay cobros. <a onClick={() => irA("cobros")}>Registrar el primero</a></td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
