import { execute, select } from "./db";

export interface Configuracion {
  nombre_asociacion: string;
  cuota_social: number; // centavos
  prefijo_whatsapp: string;
  plantilla_whatsapp: string;
  plantilla_recordatorio: string;
  direccion: string;
  personeria: string;
  cuit: string;
  /** Nombre que va en el recibo arriba de la línea (en lugar de la firma). */
  firmante: string;
  /** Cargo que va debajo de la línea ("Tesorera"). */
  cargo_firmante: string;
  /** Que la app apriete Enviar en WhatsApp. Si no, deja el mensaje listo para que la persona lo envíe. */
  envio_automatico: boolean;
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
    plantilla_recordatorio: m.plantilla_recordatorio ?? "",
    direccion: m.direccion ?? "",
    personeria: m.personeria ?? "",
    cuit: m.cuit ?? "",
    firmante: m.firmante ?? "",
    cargo_firmante: m.cargo_firmante ?? "Tesorera",
    envio_automatico: m.whatsapp_enviar_solo === "1",
  };
}

export async function guardarConfiguracion(c: Configuracion) {
  const pares: [string, string][] = [
    ["nombre_asociacion", c.nombre_asociacion],
    ["cuota_social", String(c.cuota_social)],
    ["prefijo_whatsapp", c.prefijo_whatsapp],
    ["plantilla_whatsapp", c.plantilla_whatsapp],
    ["plantilla_recordatorio", c.plantilla_recordatorio],
    ["direccion", c.direccion],
    ["personeria", c.personeria],
    ["cuit", c.cuit],
    ["firmante", c.firmante],
    ["cargo_firmante", c.cargo_firmante],
    ["whatsapp_enviar_solo", c.envio_automatico ? "1" : "0"],
  ];
  for (const [clave, valor] of pares) {
    await execute(
      "INSERT INTO configuracion (clave, valor) VALUES ($1, $2) " +
        "ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
      [clave, valor],
    );
  }
}
