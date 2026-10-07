import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import Modal from "./Modal";

export interface OpcionesConfirmar {
  titulo: string;
  mensaje: ReactNode;
  /** Texto del botón de confirmación (por defecto "Aceptar"). */
  aceptar?: string;
  cancelar?: string;
  /** Botón rojo, para acciones que no se pueden deshacer. */
  peligro?: boolean;
}

type Confirmar = (o: OpcionesConfirmar) => Promise<boolean>;

const Ctx = createContext<Confirmar>(async () => false);

/** Reemplaza al `confirm()` del navegador por un diálogo con el estilo de la app. */
export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [opciones, setOpciones] = useState<OpcionesConfirmar | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});

  const confirmar = useCallback<Confirmar>((o) => {
    setOpciones(o);
    return new Promise<boolean>((res) => { resolver.current = res; });
  }, []);

  const cerrar = useCallback((valor: boolean) => {
    setOpciones(null);
    resolver.current(valor);
  }, []);

  return (
    <Ctx.Provider value={confirmar}>
      {children}
      {opciones && (
        <Modal
          titulo={opciones.titulo}
          onCerrar={() => cerrar(false)}
          ancho={460}
          pie={
            <>
              <button onClick={() => cerrar(false)}>{opciones.cancelar ?? "Cancelar"}</button>
              <button className={opciones.peligro ? "btn-peligro-lleno" : "btn-primario"} onClick={() => cerrar(true)} autoFocus>
                {opciones.aceptar ?? "Aceptar"}
              </button>
            </>
          }
        >
          <div className="confirmar-mensaje">{opciones.mensaje}</div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function useConfirmar(): Confirmar {
  return useContext(Ctx);
}
