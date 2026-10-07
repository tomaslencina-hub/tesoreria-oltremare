import { execute, select } from "./db";

export interface Configuracion {
  nombre_asociacion: string;
  cuota_social: number; // centavos
  prefijo_whatsapp: string;
  plantilla_whatsapp: string;
}

export async function leerConfiguracion(): Promise<Configuracion> {
  const filas = await select<{ clave: string; valor: string }>(
    "SELECT clave, valor FROM configuracion",
  );
  const m = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
  return {
    nombre_asociacion: m.nombre_asociacion ?? "",
    cuota_social: Number(m.cuota_social ?? 0),
    prefijo_whatsapp: m.prefijo_whatsapp ?? "549",
    plantilla_whatsapp: m.plantilla_whatsapp ?? "",
  };
}

export async function guardarConfiguracion(c: Configuracion) {
  const pares: [string, string][] = [
    ["nombre_asociacion", c.nombre_asociacion],
    ["cuota_social", String(c.cuota_social)],
    ["prefijo_whatsapp", c.prefijo_whatsapp],
    ["plantilla_whatsapp", c.plantilla_whatsapp],
  ];
  for (const [clave, valor] of pares) {
    await execute(
      "INSERT INTO configuracion (clave, valor) VALUES ($1, $2) " +
        "ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
      [clave, valor],
    );
  }
}
