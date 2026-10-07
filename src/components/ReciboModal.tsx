import { useState } from "react";
import { fecha, moneda, numeroRecibo, periodo } from "../lib/format";
import type { PagoDetalle } from "../lib/tipos";
import { TIPOS_PAGO } from "../lib/tipos";
import { enviarReciboWhatsApp } from "../lib/whatsapp";
import { useConfig } from "./ConfigContext";
import Modal from "./Modal";

interface Props {
  pago: PagoDetalle;
  onCerrar: () => void;
  onEnviado?: () => void;
}

export default function ReciboModal({ pago, onCerrar, onEnviado }: Props) {
  const config = useConfig();
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(!!pago.enviado_whatsapp_en);

  async function enviar() {
    try {
      setError(null);
      await enviarReciboWhatsApp(pago, config);
      setEnviado(true);
      onEnviado?.();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <Modal
      titulo={`Recibo N° ${numeroRecibo(pago.numero_recibo)}`}
      onCerrar={onCerrar}
      ancho={620}
      pie={
        <>
          {error && <span className="error">{error}</span>}
          <button onClick={() => window.print()}>Imprimir</button>
          <button className="btn-whatsapp" onClick={enviar} disabled={!!pago.anulado}>
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
            <strong>N° {numeroRecibo(pago.numero_recibo)}</strong>
            <span>{fecha(pago.fecha)}</span>
          </div>
        </div>
        {pago.anulado ? <div className="recibo-anulado">ANULADO</div> : null}
        <dl className="recibo-datos">
          <dt>Recibimos de</dt>
          <dd>{pago.apellido}, {pago.nombre}{pago.dni ? ` — DNI ${pago.dni}` : ""}</dd>
          <dt>Tipo</dt>
          <dd>{TIPOS_PAGO[pago.tipo]}</dd>
          <dt>Concepto</dt>
          <dd>{pago.concepto}</dd>
          {pago.periodo && (
            <>
              <dt>Período</dt>
              <dd>{periodo(pago.periodo)}</dd>
            </>
          )}
          <dt>Medio de pago</dt>
          <dd className="capitalizar">{pago.medio_pago}</dd>
          {pago.observaciones && (
            <>
              <dt>Observaciones</dt>
              <dd>{pago.observaciones}</dd>
            </>
          )}
        </dl>
        <div className="recibo-total">
          <span>Total</span>
          <strong>{moneda(pago.monto)}</strong>
        </div>
      </div>
    </Modal>
  );
}
