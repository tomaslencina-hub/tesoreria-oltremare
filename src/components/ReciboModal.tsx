import { useRef, useState } from "react";
import { numeroRecibo } from "../lib/format";
import { copiarComoImagen } from "../lib/imagen";
import { agruparItems } from "../lib/pagos";
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

  // Copia la imagen y la deja lista en WhatsApp con el mensaje; se envía solo si así está configurado.
  const enviar = () =>
    accion(async () => {
      await copiarComoImagen(talones.current!);
      setAviso("Abriendo WhatsApp… no uses el mouse ni el teclado unos segundos.");
      const modo = await enviarReciboWhatsApp(recibo, config);
      setEnviado(true);
      setAviso({
        enviado: "Recibo enviado por WhatsApp.",
        preparado: "Listo en WhatsApp: revisá el recibo y apretá Enviar cuando quieras.",
        manual: "Se abrió WhatsApp Web con el mensaje. Pegá la imagen del recibo con Ctrl+V y enviá.",
      }[modo]);
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
            {config.envio_automatico
              ? (enviado ? "Reenviar por WhatsApp" : "Enviar por WhatsApp")
              : (enviado ? "Abrir de nuevo en WhatsApp" : "Abrir en WhatsApp")}
          </button>
        </>
      }
    >
      <div className="talones" id="recibo-imprimible" ref={talones}>
        {agruparItems(recibo.items).map((g) => (
          <Talon key={`${g.tipo}-${g.curso_id}-${g.concepto}`} recibo={recibo} grupo={g} config={config} />
        ))}
      </div>
    </Modal>
  );
}
