import { FaCircle, FaRoute, FaBox, FaInfoCircle, FaMapMarkerAlt } from 'react-icons/fa'
import Mapa from './Mapa.jsx'

export default function VistaMapa({
  grafo,
  metricas,
  rutaDestacada = [],
  onNodoEdit    = null,
  onAristaEdit  = null,
}) {
  if (!grafo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-2">
        <p className="text-base">No hay datos cargados aún.</p>
        <p className="text-sm">Ve a <strong>Datos de la Red</strong> y aplica los datos al sistema.</p>
      </div>
    )
  }

  const nodos   = grafo.nodos   || []
  const aristas = grafo.aristas || []
  const origenes      = nodos.filter(n => n.tipo === 'origen').length
  const acopios       = nodos.filter(n => n.tipo === 'acopio').length
  const destinos      = nodos.filter(n => n.tipo === 'destino').length
  const rutasConFlujo = aristas.filter(a => (a.flujo || 0) > 0).length
  const sinOptimizar  = rutasConFlujo === 0

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-600 flex-shrink-0 shadow-sm">
        <span className="flex items-center gap-1.5"><FaCircle className="text-red-500 text-[0.5rem]" /> {origenes} estaciones</span>
        <span className="flex items-center gap-1.5"><FaCircle className="text-amber-500 text-[0.5rem]" /> {acopios} acopios</span>
        <span className="flex items-center gap-1.5"><FaCircle className="text-green-500 text-[0.5rem]" /> {destinos} supermercados</span>
        <span className="flex items-center gap-1.5"><FaRoute /> {aristas.length} rutas ({rutasConFlujo} con flujo)</span>
        {metricas?.oferta_total  && <span className="flex items-center gap-1.5"><FaBox /> Oferta: {metricas.oferta_total} ton</span>}
        {metricas?.demanda_total && <span className="flex items-center gap-1.5"><FaBox /> Demanda: {metricas.demanda_total} ton</span>}
        <span className="text-slate-400 text-xs">Rutas via OSRM (cacheadas)</span>
      </div>

      {sinOptimizar && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 flex-shrink-0">
          <FaInfoCircle /> Las rutas aparecen en <strong>azul</strong> — ejecuta la <strong>Optimización</strong> en la pestaña Evaluar para ver flujos.
        </div>
      )}

      {rutaDestacada.length > 0 && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-4 py-2 text-sm text-violet-700 flex-shrink-0">
          <FaMapMarkerAlt /> Ruta óptima (Dijkstra): {rutaDestacada.join(' → ')}
        </div>
      )}

      {/* Mapa — toma el espacio restante */}
      <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 shadow-sm min-h-[400px]">
        <Mapa
          nodos={nodos}
          aristas={aristas}
          rutaDestacada={rutaDestacada}
          onNodoEdit={onNodoEdit}
          onAristaEdit={onAristaEdit}
        />
      </div>
    </div>
  )
}
