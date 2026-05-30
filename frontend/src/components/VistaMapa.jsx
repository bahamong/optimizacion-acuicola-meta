import Mapa from './Mapa.jsx'
import './VistaMapa.css'

export default function VistaMapa({
  grafo,
  metricas,
  rutaDestacada = [],
  onNodoEdit    = null,
  onAristaEdit  = null,
}) {
  if (!grafo) {
    return (
      <div className="mapa-vacio">
        <p>No hay datos cargados aún.</p>
        <p>Ve a <strong>Datos de la Red</strong> y aplica los datos al sistema.</p>
      </div>
    )
  }

  const nodos   = grafo.nodos   || []
  const aristas = grafo.aristas || []

  const origenes      = nodos.filter(n => n.tipo === 'origen').length
  const acopios       = nodos.filter(n => n.tipo === 'acopio').length
  const destinos      = nodos.filter(n => n.tipo === 'destino').length
  const rutasConFlujo  = aristas.filter(a => (a.flujo || 0) > 0).length
  const sinOptimizar   = rutasConFlujo === 0

  return (
    <div className="vista-mapa">
      {/* Barra de estadísticas */}
      <div className="mapa-stats">
        <span>🔴 {origenes} estaciones</span>
        <span>🟡 {acopios} acopios</span>
        <span>🟢 {destinos} supermercados</span>
        <span>🔗 {aristas.length} rutas ({rutasConFlujo} con flujo)</span>
        {metricas?.oferta_total  && <span>📦 Oferta: {metricas.oferta_total} ton</span>}
        {metricas?.demanda_total && <span>📦 Demanda: {metricas.demanda_total} ton</span>}
        <span className="stats-hint">Las rutas se cargan desde OpenStreetMap (OSRM)</span>
      </div>

      {sinOptimizar && (
        <div className="mapa-aviso-flujo">
          🔵 Las rutas aparecen en <strong>azul claro</strong> porque aún no se ha ejecutado la optimización.
          Ve a <strong>Evaluar → Optimización</strong> para ver los flujos reales y los colores de utilización.
        </div>
      )}

      {rutaDestacada.length > 0 && (
        <div className="mapa-ruta-activa">
          📍 Ruta óptima resaltada (Dijkstra): {rutaDestacada.join(' → ')}
        </div>
      )}

      <Mapa
        nodos={nodos}
        aristas={aristas}
        rutaDestacada={rutaDestacada}
        onNodoEdit={onNodoEdit}
        onAristaEdit={onAristaEdit}
      />
    </div>
  )
}
