import { useCallback, useEffect, useState } from "react";
import CobroModal from "../components/CobroModal";
import { useConfig } from "../components/ConfigContext";
import ReciboModal from "../components/ReciboModal";
import { moneda, periodo as formatoPeriodo, periodoActual } from "../lib/format";
import { agruparPorPersona, listarPendientes } from "../lib/pagos";
import { PendientePersona, ReciboDetalle } from "../lib/tipos";
import { enviarRecordatorioWhatsApp } from "../lib/whatsapp";

export default function Pendientes() {
  const config = useConfig();
  const [periodo, setPeriodo] = useState(periodoActual());
  const [filas, setFilas] = useState<PendientePersona[]>([]);
  const [texto, setTexto] = useState("");
  const [cobrando, setCobrando] = useState<PendientePersona | null>(null);
  const [recibo, setRecibo] = useState<ReciboDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setFilas(agruparPorPersona(await listarPendientes(periodo, config.cuota_social)));
  }, [periodo, config.cuota_social]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function recordar(p: PendientePersona) {
    try {
      setError(null);
      setAviso(null);
      const modo = await enviarRecordatorioWhatsApp(p, periodo, config);
      setAviso(modo === "enviado"
        ? `Recordatorio enviado a ${p.nombre} ${p.apellido}.`
        : `Recordatorio para ${p.nombre} ${p.apellido} listo en WhatsApp: revisalo y apretá Enviar.`);
    } catch (e) {
      setError(String(e));
    }
  }

  const t = texto.trim().toLowerCase();
  const visibles = t ? filas.filter((f) => `${f.apellido} ${f.nombre}`.toLowerCase().includes(t)) : filas;
  const total = filas.reduce((s, f) => s + f.total, 0);

  return (
    <section>
      <header className="pagina-cabecera">
        <div>
          <h1>Cobros pendientes</h1>
          <p className="muted">
            Cuota societaria y cursado de {formatoPeriodo(periodo)} que todavía no tienen recibo.
          </p>
        </div>
        <input type="month" value={periodo} onChange={(e) => e.target.value && setPeriodo(e.target.value)} />
      </header>

      <div className="tarjetas">
        <div className="tarjeta"><span>Personas que adeudan</span><strong>{filas.length}</strong></div>
        <div className="tarjeta"><span>Total a cobrar</span><strong>{moneda(total)}</strong></div>
      </div>

      <div className="filtros">
        <input placeholder="Buscar por nombre…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        {error && <span className="error">{error}</span>}
        {aviso && <span className="ok">{aviso}</span>}
      </div>

      <table className="tabla">
        <thead>
          <tr>
            <th>Persona</th>
            <th>Adeuda</th>
            <th className="num">Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((f) => (
            <tr key={f.persona_id}>
              <td>{f.apellido}, {f.nombre}</td>
              <td>
                {f.items.map((i) => (
                  <span key={`${i.tipo}-${i.curso_id ?? ""}`} className={`etiqueta etiqueta-${i.tipo}`}>
                    {i.tipo === "cuota_social" ? "Cuota societaria" : i.curso_nombre}
                  </span>
                ))}
              </td>
              <td className="num">{moneda(f.total)}</td>
              <td className="acciones">
                <button
                  onClick={() => recordar(f)}
                  disabled={!f.telefono}
                  title={f.telefono ? "Enviar recordatorio por WhatsApp" : "Sin teléfono cargado"}
                >
                  Recordar
                </button>
                <button className="btn-primario" onClick={() => setCobrando(f)}>Cobrar</button>
              </td>
            </tr>
          ))}
          {visibles.length === 0 && (
            <tr><td colSpan={4} className="vacio">No hay cobros pendientes para este período 🎉</td></tr>
          )}
        </tbody>
      </table>

      {cobrando && (
        <CobroModal
          inicial={{ persona_id: cobrando.persona_id, periodo }}
          onCerrar={() => setCobrando(null)}
          onRegistrado={(r) => {
            setCobrando(null);
            setRecibo(r);
            cargar();
          }}
        />
      )}
      {recibo && <ReciboModal recibo={recibo} onCerrar={() => setRecibo(null)} />}
    </section>
  );
}
