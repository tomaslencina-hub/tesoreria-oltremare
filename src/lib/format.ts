const formatoMoneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

/** Convierte centavos a texto "$ 1.234,50". */
export function moneda(centavos: number): string {
  return formatoMoneda.format(centavos / 100);
}

const formatoImporte = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/** Importe como en los recibos en papel: "$ 33.000" (decimales solo si los hay). */
export function importe(centavos: number): string {
  return `$ ${formatoImporte.format(centavos / 100)}`;
}

/** Convierte un texto ingresado por el usuario ("1.234,50" o "1234.5") a centavos. */
export function aCentavos(texto: string): number {
  const limpio = texto.trim().replace(/\s|\$/g, "");
  if (!limpio) return 0;
  // Si tiene coma, se asume formato argentino: punto = miles, coma = decimales.
  const normalizado = limpio.includes(",")
    ? limpio.replace(/\./g, "").replace(",", ".")
    : limpio;
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? Math.round(valor * 100) : 0;
}

/** Centavos a texto editable en un input ("1234,50"). */
export function centavosAInput(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

export function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function periodoActual(): string {
  return hoyISO().slice(0, 7);
}

/** "2026-03-15" -> "15/03/2026" */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** "2026-03" -> "Marzo 2026" */
export function periodo(p: string | null | undefined): string {
  if (!p) return "";
  const [a, m] = p.split("-");
  return `${MESES[Number(m) - 1]} ${a}`;
}

export function numeroRecibo(n: number): string {
  return String(n).padStart(6, "0");
}

/** "2026-11" + 2 -> "2027-01" */
export function sumarMeses(p: string, n: number): string {
  const [a, m] = p.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Todos los meses entre `desde` y `hasta` inclusive (vacío si hasta < desde). */
export function rangoMeses(desde: string, hasta: string): string[] {
  const meses: string[] = [];
  for (let p = desde; p <= hasta && meses.length < 120; p = sumarMeses(p, 1)) meses.push(p);
  return meses;
}

function describirTramo(desde: string, hasta: string): string {
  if (desde === hasta) return periodo(desde);
  const [a1, m1] = desde.split("-");
  const [a2, m2] = hasta.split("-");
  if (a1 === a2 && m1 === "01" && m2 === "12") return `Año ${a1} completo`;
  const mes = (p: string) => periodo(p).split(" ")[0];
  const nexo = sumarMeses(desde, 1) === hasta ? "y" : "a";
  return a1 === a2 ? `${mes(desde)} ${nexo} ${mes(hasta)} ${a1}` : `${periodo(desde)} ${nexo} ${periodo(hasta)}`;
}

/**
 * Describe un conjunto de meses agrupando los consecutivos:
 * ["2026-10","2026-11","2026-12"] -> "Octubre a Diciembre 2026";
 * ["2026-10","2026-12"] -> "Octubre 2026 y Diciembre 2026".
 */
export function describirPeriodos(periodos: string[]): string {
  const ps = [...new Set(periodos)].sort();
  if (ps.length === 0) return "";
  const tramos: string[] = [];
  let inicio = ps[0];
  for (let i = 1; i <= ps.length; i++) {
    if (i === ps.length || ps[i] !== sumarMeses(ps[i - 1], 1)) {
      tramos.push(describirTramo(inicio, ps[i - 1]));
      inicio = ps[i];
    }
  }
  return tramos.length === 1 ? tramos[0] : `${tramos.slice(0, -1).join(", ")} y ${tramos[tramos.length - 1]}`;
}
