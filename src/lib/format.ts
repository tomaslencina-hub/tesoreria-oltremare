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
