import { ReactNode, useEffect } from "react";

interface Props {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: number;
}

export default function Modal({ titulo, onCerrar, children, pie, ancho = 560 }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  return (
    <div className="modal-fondo" onMouseDown={onCerrar}>
      <div className="modal" style={{ width: ancho }} onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-cabecera">
          <h2>{titulo}</h2>
          <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar">×</button>
        </header>
        <div className="modal-cuerpo">{children}</div>
        {pie && <footer className="modal-pie">{pie}</footer>}
      </div>
    </div>
  );
}
