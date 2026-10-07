import { useState } from "react";
import "./App.css";
import logo from "./assets/logo-oltremare.png";
import { ConfigProvider, useConfigCtx } from "./components/ConfigContext";
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

  if (error) return <div className="cargando error">No se pudo abrir la base de datos: {error}</div>;
  if (!config) return <div className="cargando">Cargando…</div>;

  return (
    <div className="layout">
      <nav className="menu">
        <div className="logo-menu">
          <img src={logo} alt={config.nombre_asociacion} />
          <small>Tesorería</small>
        </div>
        {MENU.map((m) => (
          <button key={m.id} className={pagina === m.id ? "activo" : ""} onClick={() => setPagina(m.id)}>
            {m.texto}
          </button>
        ))}
      </nav>
      <main className="contenido">
        {pagina === "panel" && <Panel irA={setPagina} />}
        {pagina === "pendientes" && <Pendientes />}
        {pagina === "cobros" && <Cobros />}
        {pagina === "personas" && <Personas />}
        {pagina === "cursos" && <Cursos />}
        {pagina === "configuracion" && <Configuracion />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ConfigProvider>
      <Contenido />
    </ConfigProvider>
  );
}
