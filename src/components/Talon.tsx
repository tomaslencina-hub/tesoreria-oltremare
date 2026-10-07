import logo from "../assets/logo-oltremare.png";
import type { Configuracion } from "../lib/config";
import { describirPeriodos, fecha, importe, numeroRecibo } from "../lib/format";
import type { GrupoItems } from "../lib/pagos";
import type { ReciboDetalle } from "../lib/tipos";

/** Año (o años) que cubre el talón: "2026" o "2026-2027". */
function anios(g: GrupoItems, fechaRecibo: string): string {
  const as = [...new Set((g.periodos.length ? g.periodos : [fechaRecibo]).map((p) => p.slice(0, 4)))].sort();
  return as.length === 1 ? as[0] : `${as[0]}-${as[as.length - 1]}`;
}

/** Título del talón, como en los recibos en papel ("Cuota Curso - 2026"). */
function titulo(g: GrupoItems, anio: string): string {
  if (g.tipo === "cuota_social") return `Cuota Societaria - ${anio}`;
  if (g.tipo === "cursado") return `Cuota Curso - ${anio}`;
  return g.concepto;
}

/** Mes (o meses) del talón; en cursado se agrega el nombre del curso. */
function meses(g: GrupoItems): string {
  const p = describirPeriodos(g.periodos);
  if (g.tipo !== "cursado") return p || "—";
  const curso = g.concepto.replace(/^Curso\s+/, "").trim();
  return curso ? `${p} (${curso})` : p;
}

interface Props {
  recibo: ReciboDetalle;
  grupo: GrupoItems;
  config: Configuracion;
}

/** Un talón por concepto, con el mismo formato que los recibos impresos de la asociación. */
export default function Talon({ recibo, grupo, config }: Props) {
  const anio = anios(grupo, recibo.fecha);
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
        <dd>{importe(grupo.monto)}</dd>
        <dt>{grupo.periodos.length > 1 ? "Meses:" : "Mes:"}</dt>
        <dd>{meses(grupo)}</dd>
      </dl>
      <div className="talon-pie">
        <div>
          <strong className="talon-titulo">{titulo(grupo, anio)}</strong>
          <small>Recibo N° {numeroRecibo(recibo.numero)} · {fecha(recibo.fecha)} · <span className="capitalizar">{recibo.medio_pago}</span></small>
        </div>
        <div className="talon-firma">
          <span className="talon-firmante">{config.firmante}</span>
          <span className="talon-linea" />
          <span>{config.cargo_firmante}</span>
        </div>
      </div>
      {recibo.anulado ? <div className="recibo-anulado">ANULADO</div> : null}
    </div>
  );
}
