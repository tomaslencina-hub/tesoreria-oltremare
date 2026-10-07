import { ReactNode, useEffect, useRef } from "react";

interface Props {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: number;
}

/** Modales abiertos, del más viejo al más nuevo: Escape cierra solo el de arriba. */
const pila: symbol[] = [];

export default function Modal({ titulo, onCerrar, children, pie, ancho = 560 }: Props) {
  const id = useRef(Symbol("modal")).current;
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    pila.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pila[pila.length - 1] === id) cerrar.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      pila.splice(pila.indexOf(id), 1);
    };
  }, [id]);

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
