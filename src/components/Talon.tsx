import logo from "../assets/logo-oltremare.png";
import type { Configuracion } from "../lib/config";
import { fecha, importe, numeroRecibo, periodo } from "../lib/format";
import type { ReciboDetalle, ReciboItem } from "../lib/tipos";

/** Título del talón, como en los recibos en papel ("Cuota Curso - 2026"). */
function titulo(item: ReciboItem, anio: string): string {
  if (item.tipo === "cuota_social") return `Cuota Societaria - ${anio}`;
  if (item.tipo === "cursado") return `Cuota Curso - ${anio}`;
  return item.concepto;
}

/** Mes del talón: el período del ítem; en cursado se agrega el nombre del curso. */
function mes(item: ReciboItem): string {
  const p = periodo(item.periodo);
  if (item.tipo !== "cursado") return p || "—";
  const curso = item.concepto.replace(/^Curso\s+/, "").replace(p, "").trim();
  return curso ? `${p} (${curso})` : p;
}

interface Props {
  recibo: ReciboDetalle;
  item: ReciboItem;
  config: Configuracion;
}

/** Un talón por concepto, con el mismo formato que los recibos impresos de la asociación. */
export default function Talon({ recibo, item, config }: Props) {
  const anio = (item.periodo ?? recibo.fecha).slice(0, 4);
  return (
    <div className="talon">
      <div className="talon-cabecera">
        <img src={logo} alt="Oltremare" className="talon-logo" />
        <div className="talon-institucional">
          <span>{config.direccion}</span>
          <span>{config.personeria}</span>
          <span>C.U.I.T: {config.cuit}</span>
        </div>
      </div>
      <dl className="talon-datos">
        <dt>Socio:</dt>
        <dd className="talon-socio">{recibo.apellido.toUpperCase()}, {recibo.nombre.toUpperCase()}</dd>
        <dt>Importe:</dt>
        <dd>{importe(item.monto)}</dd>
        <dt>Mes:</dt>
        <dd>{mes(item)}</dd>
      </dl>
      <div className="talon-pie">
        <div>
          <strong className="talon-titulo">{titulo(item, anio)}</strong>
          <small>Recibo N° {numeroRecibo(recibo.numero)} · {fecha(recibo.fecha)} · <span className="capitalizar">{recibo.medio_pago}</span></small>
        </div>
        <div className="talon-firma">
          <span className="talon-linea" />
          <span>{config.firmante}</span>
        </div>
      </div>
      {recibo.anulado ? <div className="recibo-anulado">ANULADO</div> : null}
    </div>
  );
}
