import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Configuracion, leerConfiguracion } from "../lib/config";

interface Valor {
  config: Configuracion | null;
  error: string | null;
  recargar: () => Promise<void>;
}

const Ctx = createContext<Valor>({ config: null, error: null, recargar: async () => {} });

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      setConfig(await leerConfiguracion());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return <Ctx.Provider value={{ config, error, recargar }}>{children}</Ctx.Provider>;
}

/** Configuración ya cargada (App no renderiza las páginas hasta que lo esté). */
export function useConfig(): Configuracion {
  const { config } = useContext(Ctx);
  if (!config) throw new Error("Configuración no cargada");
  return config;
}

export function useConfigCtx() {
  return useContext(Ctx);
}
