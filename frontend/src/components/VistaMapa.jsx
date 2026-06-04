// Archivo: frontend/src/components/VistaMapa.jsx
import {
  FaCircle,
  FaRoute,
  FaBox,
  FaInfoCircle,
  FaMapMarkerAlt,
  FaWater,
  FaTimes,
} from "react-icons/fa";
import Mapa from "./Mapa.jsx";

export default function VistaMapa({
  grafo,
  metricas,
  rutaDestacada = [],
  aristasDestacadas = [],
  onLimpiarFoco = null,
  onNodoEdit = null,
  onAristaEdit = null,
}) {
  if (!grafo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-2">
        <p className="text-base">No hay datos en la base de datos.</p>
        <p className="text-sm">
          Ve a <strong>Datos de la Red</strong> y crea nodos y rutas.
        </p>
      </div>
    );
  }

  const nodos = grafo.nodos || [];
  const aristas = grafo.aristas || [];
  const origenes = nodos.filter((n) => n.tipo === "origen").length;
  const acopios = nodos.filter((n) => n.tipo === "acopio").length;
  const destinos = nodos.filter((n) => n.tipo === "destino").length;
  const rutasConFlujo = aristas.filter((a) => (a.flujo || 0) > 0).length;
  const sinOptimizar = rutasConFlujo === 0;

  const hayFoco = rutaDestacada.length > 0 || aristasDestacadas.length > 0;

  return (
    <div className="flex flex-col gap-2 h-full">
      {hayFoco && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-4 py-2 text-sm text-violet-700 flex-shrink-0">
          {rutaDestacada.length > 0 ? (
            <>
              <FaMapMarkerAlt className="flex-shrink-0" />
              <span className="truncate">
                Cadena óptima (Dijkstra): {rutaDestacada.join(" → ")}
              </span>
            </>
          ) : (
            <>
              <FaWater className="flex-shrink-0" />
              <span className="truncate">
                Flujo máximo: {aristasDestacadas.length} ruta(s) con flujo resaltadas
              </span>
            </>
          )}
          {onLimpiarFoco && (
            <button
              onClick={onLimpiarFoco}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded bg-white border border-violet-200 text-violet-700 hover:bg-violet-100 text-xs font-semibold flex-shrink-0"
            >
              <FaTimes /> Ver toda la red
            </button>
          )}
        </div>
      )}

      {/* Mapa — toma el espacio restante */}
      <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 shadow-sm min-h-[400px]">
        <Mapa
          nodos={nodos}
          aristas={aristas}
          rutaDestacada={rutaDestacada}
          aristasDestacadas={aristasDestacadas}
          onNodoEdit={onNodoEdit}
          onAristaEdit={onAristaEdit}
        />
      </div>
    </div>
  );
}
