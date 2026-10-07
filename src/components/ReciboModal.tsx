import { useRef, useState } from "react";
import { numeroRecibo } from "../lib/format";
import { copiarComoImagen } from "../lib/imagen";
import type { ReciboDetalle } from "../lib/tipos";
import { enviarReciboWhatsApp } from "../lib/whatsapp";
import { useConfig } from "./ConfigContext";
import Modal from "./Modal";
import Talon from "./Talon";

interface Props {
  recibo: ReciboDetalle;
  onCerrar: () => void;
  onEnviado?: () => void;
}

export default function ReciboModal({ recibo, onCerrar, onEnviado }: Props) {
  const config = useConfig();
  const talones = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(!!recibo.enviado_whatsapp_en);
  const [ocupado, setOcupado] = useState(false);

  async function accion(fn: () => Promise<void>) {
    setError(null);
    setAviso(null);
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setOcupado(false);
    }
  }

  const copiar = () =>
    accion(async () => {
      await copiarComoImagen(talones.current!);
      setAviso("Imagen copiada. Pegala con Ctrl+V donde quieras.");
    });

  // Copia la imagen y la envía junto con el mensaje (automático con WhatsApp Desktop).
  const enviar = () =>
    accion(async () => {
      await copiarComoImagen(talones.current!);
      if (config.envio_automatico) setAviso("Enviando por WhatsApp… no uses el mouse ni el teclado unos segundos.");
      const modo = await enviarReciboWhatsApp(recibo, config);
      setEnviado(true);
      setAviso(modo === "automatico"
        ? "Recibo enviado por WhatsApp."
        : "Se abrió WhatsApp. Enviá el mensaje y después pegá la imagen con Ctrl+V.");
      onEnviado?.();
    });

  return (
    <Modal
      titulo={`Recibo N° ${numeroRecibo(recibo.numero)}`}
      onCerrar={onCerrar}
      ancho={720}
      pie={
        <>
          {error && <span className="error">{error}</span>}
          {aviso && <span className="ok">{aviso}</span>}
          <button onClick={() => window.print()}>Imprimir</button>
          <button onClick={copiar} disabled={ocupado}>Copiar imagen</button>
          <button className="btn-whatsapp" onClick={enviar} disabled={ocupado || !!recibo.anulado}>
            {enviado ? "Reenviar por WhatsApp" : "Enviar por WhatsApp"}
          </button>
        </>
      }
    >
      <div className="talones" id="recibo-imprimible" ref={talones}>
        {recibo.items.map((item, i) => (
          <Talon key={item.id ?? i} recibo={recibo} item={item} config={config} />
        ))}
      </div>
    </Modal>
  );
}
