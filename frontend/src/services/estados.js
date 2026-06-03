// Archivo: frontend/src/services/estados.js
// Estados (situaciones) de la vía. `mult` ajusta el costo base para obtener el
// costo total. `bloqueada` inutiliza la ruta (mult = null → sin costo utilizable).
import { FaRoad, FaGasPump, FaHardHat, FaBan } from "react-icons/fa";

export const ESTADOS_VIA = [
  { id: "activa",          label: "Normal",                 mult: 1.0,  color: "#22c55e", dash: null,  Icono: FaRoad },
  { id: "gasolina_alta",   label: "Gasolina alta (+15%)",   mult: 1.15, color: "#f59e0b", dash: null,  Icono: FaGasPump },
  { id: "via_deteriorada", label: "Vía deteriorada (+25%)", mult: 1.25, color: "#ef4444", dash: null,  Icono: FaHardHat },
  { id: "bloqueada",       label: "Vía bloqueada",          mult: null, color: "#6b7280", dash: "6 4", Icono: FaBan },
];

export const ESTADO_POR_ID = Object.fromEntries(
  ESTADOS_VIA.map((e) => [e.id, e]),
);

export function multiplicadorEstado(estado) {
  const e = ESTADO_POR_ID[estado];
  return e ? e.mult : 1.0;
}

// Costo total = costo base ajustado por el estado de la vía.
// Retorna null si la vía está bloqueada (sin costo de transporte utilizable).
export function calcularCostoTotal(costoBase, estado) {
  const mult = multiplicadorEstado(estado);
  if (mult === null || mult === undefined) return null;
  return Math.round(Number(costoBase || 0) * mult * 100) / 100;
}

export function etiquetaEstado(estado) {
  return ESTADO_POR_ID[estado]?.label || "Normal";
}
