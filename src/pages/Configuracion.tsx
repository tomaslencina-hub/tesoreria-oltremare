import { FormEvent, useState } from "react";
import { useConfig, useConfigCtx } from "../components/ConfigContext";
import { Configuracion as Config, guardarConfiguracion } from "../lib/config";
import { aCentavos, centavosAInput } from "../lib/format";

export default function Configuracion() {
  const config = useConfig();
  const { recargar } = useConfigCtx();
  const [c, setC] = useState<Config>(config);
  const [cuota, setCuota] = useState(centavosAInput(config.cuota_social));
  const [mensaje, setMensaje] = useState<string | null>(null);

  const campo = (k: keyof Omit<Config, "cuota_social" | "envio_automatico">) => ({
    value: c[k],
    onChange: (e: { target: { value: string } }) => setC({ ...c, [k]: e.target.value }),
  });

  async function guardar(e: FormEvent) {
    e.preventDefault();
    await guardarConfiguracion({
      ...c,
      nombre_asociacion: c.nombre_asociacion.trim(),
      cuota_social: aCentavos(cuota),
      prefijo_whatsapp: c.prefijo_whatsapp.replace(/\D/g, ""),
    });
    await recargar();
    setMensaje("Configuración guardada");
    setTimeout(() => setMensaje(null), 2500);
  }

  return (
    <section>
      <header className="pagina-cabecera">
        <h1>Configuración</h1>
      </header>
      <form className="form panel-form" onSubmit={guardar}>
        <h3 className="col-2">Asociación</h3>
        <label className="col-2">Nombre<input {...campo("nombre_asociacion")} /></label>
        <label className="col-2">Dirección<input {...campo("direccion")} /></label>
        <label>Personería jurídica<input {...campo("personeria")} /></label>
        <label>C.U.I.T.<input {...campo("cuit")} /></label>
        <label>
          Firma del recibo
          <input {...campo("firmante")} placeholder="Tesorero" />
        </label>
        <label>Cuota societaria mensual ($)<input value={cuota} onChange={(e) => setCuota(e.target.value)} inputMode="decimal" /></label>

        <h3 className="col-2">WhatsApp</h3>
        <label>
          Prefijo internacional
          <input {...campo("prefijo_whatsapp")} placeholder="549" />
        </label>
        <label className="check">
          <input type="checkbox" checked={c.envio_automatico} onChange={(e) => setC({ ...c, envio_automatico: e.target.checked })} />
          Enviar sin revisar (la app aprieta Enviar sola)
        </label>
        <label className="col-2">
          Mensaje que acompaña al recibo
          <textarea rows={11} {...campo("plantilla_whatsapp")} />
          <small className="muted">
            Variables: {"{nombre} {apellido} {numero} {asociacion} {detalle} {total} {fecha} {medio}"}.
            Entre *asteriscos* se ve en negrita en WhatsApp.
          </small>
        </label>
        <label className="col-2">
          Mensaje de recordatorio de pago
          <textarea rows={7} {...campo("plantilla_recordatorio")} />
          <small className="muted">Variables: {"{nombre} {apellido} {asociacion} {periodo} {detalle} {total}"}</small>
        </label>
        <div className="col-2 fila-botones">
          {mensaje && <span className="ok">{mensaje}</span>}
          <button className="btn-primario" type="submit">Guardar</button>
        </div>
      </form>
    </section>
  );
}
