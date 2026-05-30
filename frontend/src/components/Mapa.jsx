import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet'
import './Mapa.css'

// Colores por tipo de nodo (según requerimientos del proyecto)
const COLOR_NODO = {
  origen:  '#ef4444',  // rojo
  acopio:  '#f59e0b',  // amarillo/naranja
  destino: '#22c55e',  // verde
}

// Color de arista según utilización
function colorArista(utilizacion, flujo) {
  if (flujo <= 0) return '#94a3b8'          // gris — sin flujo
  if (utilizacion >= 0.85) return '#ef4444' // rojo — saturada
  if (utilizacion >= 0.60) return '#f59e0b' // naranja — alta demanda
  return '#22c55e'                           // verde — operativa
}

function grosorArista(utilizacion, flujo) {
  if (flujo <= 0) return 1
  return Math.max(1.5, Math.min(6, utilizacion * 7))
}

// ── Leyenda ───────────────────────────────────────────────────────────────────
function Leyenda() {
  return (
    <div className="mapa-leyenda">
      <p className="leyenda-titulo">Nodos</p>
      <div className="leyenda-fila"><span style={{ background: COLOR_NODO.origen }}  className="leyenda-punto" /> Estación origen</div>
      <div className="leyenda-fila"><span style={{ background: COLOR_NODO.acopio }}  className="leyenda-punto" /> Centro de acopio</div>
      <div className="leyenda-fila"><span style={{ background: COLOR_NODO.destino }} className="leyenda-punto" /> Supermercado</div>
      <p className="leyenda-titulo" style={{ marginTop: '0.75rem' }}>Rutas</p>
      <div className="leyenda-fila"><span className="leyenda-linea" style={{ background: '#22c55e' }} /> Operativa</div>
      <div className="leyenda-fila"><span className="leyenda-linea" style={{ background: '#f59e0b' }} /> Alta demanda (&gt;60%)</div>
      <div className="leyenda-fila"><span className="leyenda-linea" style={{ background: '#ef4444' }} /> Saturada (&gt;85%)</div>
      <div className="leyenda-fila"><span className="leyenda-linea" style={{ background: '#94a3b8' }} /> Sin flujo</div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Mapa({ nodos = [], aristas = [], rutaDestacada = [] }) {
  const centro = [4.5709, -74.2973] // centro geográfico de Colombia

  return (
    <div className="mapa-wrapper">
      <MapContainer
        center={centro}
        zoom={6}
        className="mapa-leaflet"
        zoomControl={true}
        scrollWheelZoom={true}
      >
        {/* Capa base minimalista — CartoDB Positron sin etiquetas */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        {/* Aristas */}
        {aristas.map((a, i) => {
          const nOrigen  = nodos.find(n => n.id === a.origen)
          const nDestino = nodos.find(n => n.id === a.destino)
          if (!nOrigen || !nDestino) return null

          const color  = colorArista(a.utilizacion || 0, a.flujo || 0)
          const grosor = grosorArista(a.utilizacion || 0, a.flujo || 0)

          return (
            <Polyline
              key={`a-${i}`}
              positions={[
                [nOrigen.lat,  nOrigen.lng],
                [nDestino.lat, nDestino.lng],
              ]}
              pathOptions={{
                color,
                weight: grosor,
                opacity: 0.75,
              }}
            >
              <Tooltip sticky>
                <div className="tooltip-arista">
                  <strong>{nOrigen.nombre} → {nDestino.nombre}</strong>
                  <span>Costo: ${a.costo}/ton</span>
                  <span>Capacidad: {a.capacidad} ton</span>
                  <span>Flujo: {(a.flujo || 0).toFixed(1)} ton</span>
                  <span>Utilización: {((a.utilizacion || 0) * 100).toFixed(1)}%</span>
                  <span>Distancia: {a.distancia} km</span>
                </div>
              </Tooltip>
            </Polyline>
          )
        })}

        {/* Ruta óptima destacada (Dijkstra) */}
        {rutaDestacada.length > 1 && (() => {
          const coords = rutaDestacada
            .map(id => nodos.find(n => n.id === id))
            .filter(Boolean)
            .map(n => [n.lat, n.lng])
          return (
            <Polyline
              positions={coords}
              pathOptions={{ color: '#6366f1', weight: 4, dashArray: '8 4', opacity: 0.9 }}
            />
          )
        })()}

        {/* Nodos */}
        {nodos.map(nodo => (
          <CircleMarker
            key={nodo.id}
            center={[nodo.lat, nodo.lng]}
            radius={nodo.tipo === 'origen' ? 10 : nodo.tipo === 'acopio' ? 8 : 6}
            pathOptions={{
              fillColor: COLOR_NODO[nodo.tipo] || '#64748b',
              fillOpacity: 0.9,
              color: '#1e293b',
              weight: 1.5,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="tooltip-nodo">
                <strong>{nodo.nombre}</strong>
                <span className="badge">{nodo.tipo}</span>
                {nodo.tipo === 'origen'  && <span>Oferta: {nodo.oferta} ton</span>}
                {nodo.tipo === 'destino' && <span>Demanda: {nodo.demanda} ton</span>}
                {nodo.tipo === 'acopio'  && <span>Cap: {nodo.capacidad} ton | Merma: {(nodo.tasa_merma * 100).toFixed(1)}%</span>}
                {nodo.tipo === 'acopio'  && <span>Calidad: {(nodo.tasa_calidad * 100).toFixed(0)}%</span>}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      <Leyenda />
    </div>
  )
}
