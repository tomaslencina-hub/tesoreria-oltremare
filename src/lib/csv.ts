/** Normaliza texto para comparar: sin acentos, minúsculas, espacios simples. */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Parsea CSV con separador `;`, `,` o tabulación (se detecta del encabezado) y comillas dobles. */
export function parsearCSV(texto: string): string[][] {
  texto = texto.replace(/^﻿/, "");
  const primera = texto.split(/\r?\n/, 1)[0];
  const sep = [";", "\t", ","].reduce((a, b) => (primera.split(b).length > primera.split(a).length ? b : a));

  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x.trim())) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim())) filas.push(fila);
  return filas.map((f) => f.map((x) => x.trim()));
}

export interface FilaAlumno {
  linea: number;
  apellido: string;
  nombre: string;
  dni: string;
  telefono: string;
  email: string;
  cursos: string[];
  notas: string;
  socio: boolean;
  activo: boolean;
}

const SI = (v: string | undefined, porDefecto: boolean) =>
  v === undefined || v === "" ? porDefecto : /^(s|si|sí|x|1|true|yes)$/i.test(v.trim());

/** Lee alumnos desde el texto de un CSV. */
export function leerAlumnos(texto: string) {
  return leerAlumnosDeFilas(parsearCSV(texto));
}

/**
 * Convierte filas (de CSV o de la planilla Excel) en alumnos. Columnas reconocidas, en cualquier orden
 * y sin importar lo que diga entre paréntesis ("Teléfono (WhatsApp)"): apellido, nombre
 * (o "apellido y nombre" con formato "APELLIDO, NOMBRE"), dni, telefono, email, curso,
 * otro curso, socio, activo, observaciones. En "curso" se pueden poner varios separados por "+".
 */
export function leerAlumnosDeFilas(filasCrudas: string[][]): { filas: FilaAlumno[]; errores: string[] } {
  // Las filas vacías se saltean (la planilla trae filas con formato listas para completar).
  const conLinea = filasCrudas.map((f, i) => ({ f, linea: i + 1 })).filter(({ f }) => f.some((x) => x.trim()));
  const [encabezadoConLinea, ...datosConLinea] = conLinea;
  if (!encabezadoConLinea) return { filas: [], errores: ["El archivo está vacío"] };
  const encabezado = encabezadoConLinea.f;
  const datos = datosConLinea.map((x) => x.f);
  const lineas = datosConLinea.map((x) => x.linea);
  const cols = encabezado.map((c) => normalizar(c.replace(/\(.*?\)/g, "")));
  const col = (...nombres: string[]) => cols.findIndex((c) => nombres.includes(c));
  const iAp = col("apellido", "apellidos");
  const iNo = col("nombre", "nombres");
  const iCompleto = col("apellido y nombre", "apellido, nombre", "nombre completo");
  const iDni = col("dni", "documento");
  const iTel = col("telefono", "celular", "tel", "whatsapp");
  const iMail = col("email", "mail", "correo");
  const iCurso = col("curso", "cursos");
  const iCurso2 = col("otro curso", "curso 2", "segundo curso");
  const iNotas = col("observaciones", "notas");
  const iSocio = col("socio", "es socio");
  const iActivo = col("activo", "activa");

  if ((iAp < 0 || iNo < 0) && iCompleto < 0) {
    return { filas: [], errores: ['Faltan las columnas "apellido" y "nombre" (o "apellido y nombre")'] };
  }

  const filas: FilaAlumno[] = [];
  const errores: string[] = [];
  datos.forEach((d, idx) => {
    const linea = lineas[idx];
    const get = (i: number) => (i >= 0 ? (d[i] ?? "").trim() : "");
    let apellido = get(iAp);
    let nombre = get(iNo);
    if (iCompleto >= 0 && (!apellido || !nombre)) {
      const [a, ...n] = get(iCompleto).split(",");
      apellido = a.trim();
      nombre = n.join(",").trim();
    }
    if (!apellido || !nombre) {
      errores.push(`Línea ${linea}: falta apellido o nombre`);
      return;
    }
    filas.push({
      linea,
      apellido,
      nombre,
      dni: get(iDni).replace(/\D/g, ""),
      telefono: get(iTel).replace(/[^\d+]/g, ""),
      email: get(iMail),
      cursos: [...get(iCurso).split("+"), get(iCurso2)].map((c) => c.trim()).filter(Boolean),
      notas: get(iNotas),
      socio: SI(iSocio >= 0 ? get(iSocio) : undefined, true),
      activo: SI(iActivo >= 0 ? get(iActivo) : undefined, true),
    });
  });
  return { filas, errores };
}
