import { useEffect, useState } from "react";
import { useConfig } from "../components/ConfigContext";
import { fecha, hoyISO, moneda, numeroRecibo, periodo, periodoActual } from "../lib/format";
import { agruparPorPersona, listarPendientes, listarRecibos, resumen, Resumen, describirRecibo } from "../lib/pagos";
import { ReciboDetalle } from "../lib/tipos";

export default function Panel({ irA }: { irA: (pagina: "pendientes" | "cobros") => void }) {
  const config = useConfig();
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [pendientes, setPendientes] = useState({ cantidad: 0, total: 0 });
  const [ultimos, setUltimos] = useState<ReciboDetalle[]>([]);
  const mes = periodoActual();

  useEffect(() => {
    resumen(mes, hoyISO()).then(setDatos);
    listarPendientes(mes, config.cuota_social).then((f) =>
      setPendientes({ cantidad: agruparPorPersona(f).length, total: f.reduce((s, x) => s + x.monto, 0) }),
    );
    listarRecibos({ limite: 8 }).then(setUltimos);
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
          <small>{pendientes.cantidad} personas adeudan →</small>
        </button>
      </div>

      <h2>Últimos cobros</h2>
      <table className="tabla">
        <thead>
          <tr><th>N°</th><th>Fecha</th><th>Persona</th><th>Detalle</th><th className="num">Total</th></tr>
        </thead>
        <tbody>
          {ultimos.map((p) => (
            <tr key={p.id} className={p.anulado ? "anulado" : ""}>
              <td>{numeroRecibo(p.numero)}</td>
              <td>{fecha(p.fecha)}</td>
              <td>{p.apellido}, {p.nombre}</td>
              <td>{describirRecibo(p.items)}</td>
              <td className="num">{moneda(p.total)}</td>
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
