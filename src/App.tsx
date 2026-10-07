import { getIdentifier } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import "./App.css";
import logo from "./assets/logo-oltremare-claro.png";
import { ConfigProvider, useConfigCtx } from "./components/ConfigContext";
import { ConfirmarProvider } from "./components/Confirmar";
import Cobros from "./pages/Cobros";
import Configuracion from "./pages/Configuracion";
import Cursos from "./pages/Cursos";
import Panel from "./pages/Panel";
import Pendientes from "./pages/Pendientes";
import Personas from "./pages/Personas";

type Pagina = "panel" | "pendientes" | "cobros" | "personas" | "cursos" | "configuracion";

const MENU: { id: Pagina; texto: string }[] = [
  { id: "panel", texto: "Inicio" },
  { id: "pendientes", texto: "Pendientes" },
  { id: "cobros", texto: "Cobros y recibos" },
  { id: "personas", texto: "Alumnos y socios" },
  { id: "cursos", texto: "Cursos" },
  { id: "configuracion", texto: "Configuración" },
];

function Contenido() {
  const { config, error } = useConfigCtx();
  const [pagina, setPagina] = useState<Pagina>("panel");
  const [entorno, setEntorno] = useState<"dev" | "test" | null>(null);

  // El identificador cambia por entorno (ver src-tauri/tauri.*.conf.json), y con él la base de datos.
  useEffect(() => {
    getIdentifier().then((id) => setEntorno(id.endsWith(".dev") ? "dev" : id.endsWith(".test") ? "test" : null));
  }, []);

  if (error) return <div className="cargando error">No se pudo abrir la base de datos: {error}</div>;
  if (!config) return <div className="cargando">Cargando…</div>;

  return (
    <div className="layout">
      <nav className="menu">
        <div className="logo-menu">
          <img src={logo} alt={config.nombre_asociacion} />
          <small>Tesorería</small>
        </div>
        {entorno && (
          <div className={`entorno entorno-${entorno}`}>
            {entorno === "dev" ? "Desarrollo" : "Prueba"} — datos de prueba
          </div>
        )}
        {MENU.map((m) => (
          <button key={m.id} className={pagina === m.id ? "activo" : ""} onClick={() => setPagina(m.id)}>
            {m.texto}
          </button>
        ))}
        <button className="salir" onClick={() => getCurrentWindow().close()}>
          <span aria-hidden>⏻</span> Salir
        </button>
      </nav>
      <div className="principal">
        <div className="barra-superior">
          <button className="btn-minimizar" title="Minimizar" aria-label="Minimizar" onClick={() => getCurrentWindow().minimize()}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><rect x="1" y="6.4" width="12" height="1.6" rx="0.8" fill="currentColor" /></svg>
          </button>
        </div>
        <main className="contenido">
          {pagina === "panel" && <Panel irA={setPagina} />}
          {pagina === "pendientes" && <Pendientes />}
          {pagina === "cobros" && <Cobros />}
          {pagina === "personas" && <Personas />}
          {pagina === "cursos" && <Cursos />}
          {pagina === "configuracion" && <Configuracion />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ConfigProvider>
      <ConfirmarProvider>
        <Contenido />
      </ConfirmarProvider>
    </ConfigProvider>
  );
}
