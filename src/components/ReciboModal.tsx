import { useState } from "react";
import { fecha, moneda, numeroRecibo } from "../lib/format";
import type { ReciboDetalle } from "../lib/tipos";
import { enviarReciboWhatsApp } from "../lib/whatsapp";
import { useConfig } from "./ConfigContext";
import Modal from "./Modal";

interface Props {
  recibo: ReciboDetalle;
  onCerrar: () => void;
  onEnviado?: () => void;
}

export default function ReciboModal({ recibo, onCerrar, onEnviado }: Props) {
  const config = useConfig();
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(!!recibo.enviado_whatsapp_en);

  async function enviar() {
    try {
      setError(null);
      await enviarReciboWhatsApp(recibo, config);
      setEnviado(true);
      onEnviado?.();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <Modal
      titulo={`Recibo N° ${numeroRecibo(recibo.numero)}`}
      onCerrar={onCerrar}
      ancho={620}
      pie={
        <>
          {error && <span className="error">{error}</span>}
          <button onClick={() => window.print()}>Imprimir</button>
          <button className="btn-whatsapp" onClick={enviar} disabled={!!recibo.anulado}>
            {enviado ? "Reenviar por WhatsApp" : "Enviar por WhatsApp"}
          </button>
        </>
      }
    >
      <div className="recibo" id="recibo-imprimible">
        <div className="recibo-cabecera">
          <div>
            <h3>{config.nombre_asociacion}</h3>
            <span className="muted">Tesorería</span>
          </div>
          <div className="recibo-numero">
            <span>RECIBO</span>
            <strong>N° {numeroRecibo(recibo.numero)}</strong>
            <span>{fecha(recibo.fecha)}</span>
          </div>
        </div>
        {recibo.anulado ? <div className="recibo-anulado">ANULADO</div> : null}
        <dl className="recibo-datos">
          <dt>Recibimos de</dt>
          <dd>{recibo.apellido}, {recibo.nombre}{recibo.dni ? ` — DNI ${recibo.dni}` : ""}</dd>
          <dt>Medio de pago</dt>
          <dd className="capitalizar">{recibo.medio_pago}</dd>
          {recibo.observaciones && (
            <>
              <dt>Observaciones</dt>
              <dd>{recibo.observaciones}</dd>
            </>
          )}
        </dl>
        <table className="recibo-items">
          <tbody>
            {recibo.items.map((i, n) => (
              <tr key={i.id ?? n}>
                <td>{i.concepto}</td>
                <td className="num">{moneda(i.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="recibo-total">
          <span>Total</span>
          <strong>{moneda(recibo.total)}</strong>
        </div>
      </div>
    </Modal>
  );
}
