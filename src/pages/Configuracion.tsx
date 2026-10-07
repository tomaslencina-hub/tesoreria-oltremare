import { FormEvent, useState } from "react";
import { useConfig, useConfigCtx } from "../components/ConfigContext";
import { guardarConfiguracion } from "../lib/config";
import { aCentavos, centavosAInput } from "../lib/format";

export default function Configuracion() {
  const config = useConfig();
  const { recargar } = useConfigCtx();
  const [nombre, setNombre] = useState(config.nombre_asociacion);
  const [cuota, setCuota] = useState(centavosAInput(config.cuota_social));
  const [prefijo, setPrefijo] = useState(config.prefijo_whatsapp);
  const [plantilla, setPlantilla] = useState(config.plantilla_whatsapp);
  const [recordatorio, setRecordatorio] = useState(config.plantilla_recordatorio);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    await guardarConfiguracion({
      nombre_asociacion: nombre.trim(),
      cuota_social: aCentavos(cuota),
      prefijo_whatsapp: prefijo.replace(/\D/g, ""),
      plantilla_whatsapp: plantilla,
      plantilla_recordatorio: recordatorio,
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
        <label className="col-2">Nombre de la asociación<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
        <label>Cuota societaria mensual ($)<input value={cuota} onChange={(e) => setCuota(e.target.value)} inputMode="decimal" /></label>
        <label>
          Prefijo internacional WhatsApp
          <input value={prefijo} onChange={(e) => setPrefijo(e.target.value)} placeholder="549" />
        </label>
        <label className="col-2">
          Mensaje del recibo por WhatsApp
          <textarea rows={11} value={plantilla} onChange={(e) => setPlantilla(e.target.value)} />
          <small className="muted">
            Variables: {"{nombre} {apellido} {numero} {asociacion} {detalle} {total} {fecha} {medio}"}.
            Entre *asteriscos* se ve en negrita en WhatsApp.
          </small>
        </label>
        <label className="col-2">
          Mensaje de recordatorio de pago
          <textarea rows={7} value={recordatorio} onChange={(e) => setRecordatorio(e.target.value)} />
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
