/**
 * Mapa.jsx — Visualización geoespacial de la red logística
 *
 * Características:
 *  - Rutas reales via OSRM (OpenStreetMap routing), no líneas rectas
 *  - CartoDB Positron con nombres de ciudades
 *  - Click en nodo  → panel edición (oferta / demanda / calidad / merma)
 *  - Click en ruta  → panel edición (situación: normal / gasolina alta /
 *                     vía deteriorada / vía bloqueada)
 *  - Indicador de progreso mientras carga rutas desde OSRM
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MapContainer, TileLayer, CircleMarker,
  Polyline, Tooltip, useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import './Mapa.css'

// ── Constantes ────────────────────────────────────────────────────────────────
const COLOR_NODO = { origen: '#ef4444', acopio: '#f59e0b', destino: '#22c55e' }
const RADIO_NODO = { origen: 11, acopio: 9, destino: 7 }

const SITUACIONES = [
  { id: 'normal',          label: 'Normal',                  mult: 1.00, color: '#22c55e', dash: null        },
  { id: 'gasolina_alta',   label: '⛽ Gasolina alta (+15%)', mult: 1.15, color: '#f59e0b', dash: null        },
  { id: 'via_deteriorada', label: '🚧 Vía deteriorada (+25%)',mult: 1.25, color: '#ef4444', dash: null       },
  { id: 'via_bloqueada',   label: '🚫 Vía bloqueada',        mult: null, color: '#6b7280', dash: '6 4'      },
]

// ── OSRM routing ──────────────────────────────────────────────────────────────
const OSRM = 'https://router.project-osrm.org/route/v1/driving'

async function fetchRoadPath(lat1, lng1, lat2, lng2) {
  try {
    const url = `${OSRM}/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const data = await res.json()
    if (data.code === 'Ok' && data.routes?.length > 0) {
      // OSRM usa [lng, lat] → Leaflet necesita [lat, lng]
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng])
    }
  } catch {}
  return null
}

async function cargarTodasLasRutas(aristas, nodos, onProgreso) {
  const paths = {}
  const BATCH = 4          // peticiones concurrentes
  const PAUSA = 250        // ms entre lotes para respetar rate-limit de OSRM

  const tareas = aristas
    .map(a => ({
      key:  `${a.origen || a.id_origen}→${a.destino || a.id_destino}`,
      nO:   nodos.find(n => n.id === (a.origen || a.id_origen)),
      nD:   nodos.find(n => n.id === (a.destino || a.id_destino)),
    }))
    .filter(t => t.nO && t.nD)

  for (let i = 0; i < tareas.length; i += BATCH) {
    const lote = tareas.slice(i, i + BATCH)
    const resultados = await Promise.all(
      lote.map(async ({ key, nO, nD }) => {
        const path = await fetchRoadPath(nO.lat, nO.lng, nD.lat, nD.lng)
        return { key, path: path ?? [[nO.lat, nO.lng], [nD.lat, nD.lng]] }
      })
    )
    resultados.forEach(({ key, path }) => { paths[key] = path })
    onProgreso(Math.min(100, Math.round((i + BATCH) / tareas.length * 100)))
    if (i + BATCH < tareas.length) {
      await new Promise(r => setTimeout(r, PAUSA))
    }
  }

  return paths
}

// ── Utilidades de estilo de aristas ──────────────────────────────────────────
/**
 * Lógica de colores:
 *
 *  ANTES de optimizar (flujo = 0 en todas las rutas):
 *    - Activa disponible → azul claro   (#60a5fa)  línea delgada
 *    - Bloqueada         → gris dashed  (#6b7280)
 *
 *  DESPUÉS de optimizar (el backend asigna flujo > 0 a rutas activas):
 *    - Sin flujo (no seleccionada por AG) → gris neutro (#94a3b8)
 *    - Flujo normal  (util < 60%)         → verde       (#22c55e)
 *    - Alta demanda  (util 60–85%)        → naranja     (#f59e0b)
 *    - Saturada      (util > 85%)         → rojo        (#ef4444)
 *
 *  Situaciones manuales (usuario edita en mapa):
 *    - gasolina_alta   → naranja
 *    - via_deteriorada → rojo
 *    - via_bloqueada   → gris dashed
 */
function estiloArista(arista) {
  // 1. Bloqueada siempre va en gris discontinuo
  if (arista.estado === 'bloqueada') {
    return { color: '#6b7280', weight: 1.5, opacity: 0.6, dashArray: '7 5' }
  }

  const sit  = arista._situacion || 'normal'
  const util = arista.utilizacion || 0
  const flujo = arista.flujo || 0

  // 2. Situación manual definida por el usuario (gasolina, deterioro)
  if (sit !== 'normal') {
    const s = SITUACIONES.find(x => x.id === sit) || SITUACIONES[0]
    return {
      color:     s.color,
      weight:    flujo > 0 ? Math.max(2, Math.min(5, util * 6 + 1.5)) : 1.8,
      opacity:   0.85,
      dashArray: s.dash,
    }
  }

  // 3. Sin flujo → la ruta existe pero no tiene caudal asignado
  if (flujo <= 0) {
    // Azul claro = disponible, esperando optimización
    return { color: '#60a5fa', weight: 1.4, opacity: 0.55, dashArray: null }
  }

  // 4. Con flujo (post-optimización): color según utilización
  let color
  if      (util >= 0.85) color = '#ef4444'  // saturada → rojo
  else if (util >= 0.60) color = '#f59e0b'  // alta demanda → naranja
  else                   color = '#22c55e'  // normal → verde

  return {
    color,
    weight:    Math.max(2.5, Math.min(6, util * 7 + 2)),
    opacity:   0.88,
    dashArray: null,
  }
}

// ── Cerrar panel al hacer click en el mapa ────────────────────────────────────
function CerrarAlClickMapa({ onCerrar }) {
  useMapEvents({ click: onCerrar })
  return null
}

// ── Panel de edición: Nodo ────────────────────────────────────────────────────
function PanelNodo({ nodo, onGuardar, onCerrar }) {
  const [d, setD] = useState({ ...nodo })
  const n = k => e => setD(p => ({ ...p, [k]: Number(e.target.value) }))
  const s = k => e => setD(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="mapa-panel">
      <div className="panel-cabecera">
        <span className={`panel-tipo tipo-${nodo.tipo}`}>{nodo.tipo}</span>
        <h3 className="panel-titulo">{nodo.id}</h3>
        <button className="panel-cerrar" onClick={onCerrar}>✕</button>
      </div>

      <div className="panel-cuerpo">
        <div className="pf">
          <label>Nombre</label>
          <input value={d.nombre} onChange={s('nombre')} />
        </div>

        {nodo.tipo === 'origen' && <>
          <div className="pf">
            <label>Oferta disponible (ton)</label>
            <input type="number" min="0" value={d.oferta} onChange={n('oferta')} />
          </div>
          <div className="pf">
            <label>Capacidad producción (ton)</label>
            <input type="number" min="0" value={d.capacidad} onChange={n('capacidad')} />
          </div>
        </>}

        {nodo.tipo === 'destino' && <>
          <div className="pf">
            <label>Demanda requerida (ton)</label>
            <input type="number" min="0" value={d.demanda} onChange={n('demanda')} />
          </div>
          <div className="pf">
            <label>Precio venta ($/ton)</label>
            <input type="number" min="0" value={d.precio_venta ?? 250} onChange={n('precio_venta')} />
          </div>
        </>}

        {nodo.tipo === 'acopio' && <>
          <div className="pf">
            <label>Capacidad almacenamiento (ton)</label>
            <input type="number" min="0" value={d.capacidad} onChange={n('capacidad')} />
          </div>

          <div className="pf">
            <label>Tasa de merma diaria: <strong>{((d.tasa_merma ?? 0) * 100).toFixed(1)}%</strong></label>
            <input type="range" min="0" max="0.5" step="0.005"
              value={d.tasa_merma ?? 0} onChange={n('tasa_merma')} />
            <span className="pf-hint">Fracción del inventario que se pierde por día</span>
          </div>

          <div className="pf pf-calidad">
            <label>Criterios de calidad</label>
            <div className="calidad-toggle">
              <span>Tasa de calidad: <strong>{Math.round((d.tasa_calidad ?? 1) * 100)}%</strong></span>
              <input type="range" min="0" max="1" step="0.05"
                value={d.tasa_calidad ?? 1} onChange={n('tasa_calidad')} />
            </div>
            <div className={`calidad-badge ${(d.tasa_calidad ?? 1) >= 0.7 ? 'ok' : (d.tasa_calidad ?? 1) >= 0.4 ? 'warn' : 'mal'}`}>
              {(d.tasa_calidad ?? 1) >= 0.7 ? '✓ Cumple criterios de calidad'
               : (d.tasa_calidad ?? 1) >= 0.4 ? '⚠ Calidad deficiente'
               : '✗ No cumple criterios — flujo penalizado'}
            </div>
          </div>

          <div className="pf">
            <label>Costo operación ($/día)</label>
            <input type="number" min="0" value={d.costo_operacion ?? 0} onChange={n('costo_operacion')} />
          </div>
        </>}
      </div>

      <div className="panel-pie">
        <button className="panel-btn-sec" onClick={onCerrar}>Cancelar</button>
        <button className="panel-btn-prim" onClick={() => onGuardar(d)}>Guardar cambios</button>
      </div>
    </div>
  )
}

// ── Panel de edición: Arista ──────────────────────────────────────────────────
function PanelArista({ arista, nodos, onGuardar, onCerrar }) {
  const costoBase = useRef(arista._costoBase ?? arista.costo ?? arista.costo_transporte ?? 0)
  const [sit,     setSit]     = useState(arista._situacion || 'normal')
  const [costo,   setCosto]   = useState(Number((arista.costo || arista.costo_transporte || 0).toFixed(2)))
  const [cap,     setCap]     = useState(Number(arista.capacidad || 0))

  const seleccionar = (s) => {
    setSit(s.id)
    if (s.id === 'via_bloqueada') {
      // no cambia el costo, cambia el estado
    } else if (s.mult !== null) {
      setCosto(Number((costoBase.current * s.mult).toFixed(2)))
    }
  }

  const orig = nodos.find(n => n.id === (arista.origen || arista.id_origen))
  const dest = nodos.find(n => n.id === (arista.destino || arista.id_destino))

  return (
    <div className="mapa-panel">
      <div className="panel-cabecera">
        <span className="panel-tipo tipo-ruta">ruta</span>
        <h3 className="panel-titulo" style={{ fontSize: '0.82rem' }}>
          {orig?.nombre || arista.origen} → {dest?.nombre || arista.destino}
        </h3>
        <button className="panel-cerrar" onClick={onCerrar}>✕</button>
      </div>

      <div className="panel-cuerpo">
        <p className="pf-label-sec">Situación actual de la vía</p>
        <div className="situaciones-grid">
          {SITUACIONES.map(s => (
            <button
              key={s.id}
              className={`sit-btn ${sit === s.id ? 'activo' : ''}`}
              style={{ '--sit-color': s.color }}
              onClick={() => seleccionar(s)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {sit !== 'via_bloqueada' && (
          <>
            <div className="pf" style={{ marginTop: '0.8rem' }}>
              <label>Costo de transporte ($/ton)</label>
              <div className="pf-row">
                <input type="number" min="0" step="0.5" value={costo}
                  onChange={e => setCosto(Number(e.target.value))} />
                <span className="pf-hint-inline">Base: ${costoBase.current.toFixed(2)}</span>
              </div>
            </div>
            <div className="pf">
              <label>Capacidad máxima (ton)</label>
              <input type="number" min="1" value={cap}
                onChange={e => setCap(Number(e.target.value))} />
            </div>
          </>
        )}

        {sit === 'via_bloqueada' && (
          <div className="bloqueo-aviso">
            🚫 Esta ruta quedará bloqueada — el sistema buscará rutas alternativas.
          </div>
        )}
      </div>

      <div className="panel-pie">
        <button className="panel-btn-sec" onClick={onCerrar}>Cancelar</button>
        <button className="panel-btn-prim" onClick={() => onGuardar({
          _situacion: sit,
          _costoBase: costoBase.current,
          costo:      costo,
          capacidad:  cap,
          estado:     sit === 'via_bloqueada' ? 'bloqueada' : 'activa',
        })}>
          Aplicar
        </button>
      </div>
    </div>
  )
}

// ── Leyenda ───────────────────────────────────────────────────────────────────
function Leyenda() {
  const rutas = [
    { color: '#60a5fa', dash: false, label: 'Disponible (sin flujo aún)' },
    { color: '#22c55e', dash: false, label: 'Con flujo — normal' },
    { color: '#f59e0b', dash: false, label: 'Con flujo — alta demanda (>60%)' },
    { color: '#ef4444', dash: false, label: 'Con flujo — saturada (>85%)' },
    { color: '#6b7280', dash: true,  label: 'Bloqueada / fuera de servicio' },
    { color: '#7c3aed', dash: true,  label: 'Ruta óptima — Dijkstra' },
  ]
  return (
    <div className="mapa-leyenda">
      <p className="ley-titulo">Nodos</p>
      {[['origen','Estación origen'],['acopio','Centro de acopio'],['destino','Supermercado']].map(([t,lbl]) => (
        <div key={t} className="ley-fila">
          <span className="ley-punto" style={{ background: COLOR_NODO[t] }} />
          {lbl}
        </div>
      ))}

      <p className="ley-titulo" style={{ marginTop: '0.6rem' }}>Rutas</p>
      {rutas.map((it, i) => (
        <div key={i} className="ley-fila">
          {it.dash
            ? <span className="ley-linea-dash" style={{ borderColor: it.color }} />
            : <span className="ley-linea" style={{ background: it.color }} />
          }
          {it.label}
        </div>
      ))}

      <p className="ley-hint">Click en nodo o ruta para editar</p>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Mapa({
  nodos      = [],
  aristas    = [],
  rutaDestacada = [],
  onNodoEdit    = null,
  onAristaEdit  = null,
}) {
  const centro = [4.5709, -74.2973]

  // Rutas reales de OSRM (cacheadas)
  const [roadPaths,  setRoadPaths]  = useState({})
  const [progreso,   setProgreso]   = useState(0)   // 0-100, 100 = listo
  const aristasKeyRef = useRef('')

  // Panel de edición
  const [panel, setPanel] = useState(null)   // {tipo:'nodo'|'arista', datos}

  // ── Cargar rutas OSRM ────────────────────────────────────────────────────
  const aristasKey = aristas.map(a => `${a.origen||a.id_origen}-${a.destino||a.id_destino}`).join('|')

  const cargarRutas = useCallback(async () => {
    if (nodos.length === 0 || aristas.length === 0) return
    if (aristasKey === aristasKeyRef.current) return   // sin cambios
    aristasKeyRef.current = aristasKey
    setProgreso(1)
    const paths = await cargarTodasLasRutas(aristas, nodos, setProgreso)
    setRoadPaths(paths)
    setProgreso(100)
  }, [aristasKey, nodos.length])

  useEffect(() => { cargarRutas() }, [cargarRutas])

  // ── Ruta Dijkstra con caminos reales ─────────────────────────────────────
  const caminoDijkstra = (() => {
    if (rutaDestacada.length < 2) return []
    const full = []
    for (let i = 0; i < rutaDestacada.length - 1; i++) {
      const key  = `${rutaDestacada[i]}→${rutaDestacada[i + 1]}`
      const segs = roadPaths[key]
      if (segs?.length) {
        full.push(...(full.length === 0 ? segs : segs.slice(1)))
      } else {
        const nO = nodos.find(n => n.id === rutaDestacada[i])
        const nD = nodos.find(n => n.id === rutaDestacada[i + 1])
        if (nO && nD) {
          if (full.length === 0) full.push([nO.lat, nO.lng])
          full.push([nD.lat, nD.lng])
        }
      }
    }
    return full
  })()

  // ── Handlers de edición ───────────────────────────────────────────────────
  const guardarNodo = (datos) => {
    if (onNodoEdit) onNodoEdit(datos.id, datos)
    setPanel(null)
  }

  const guardarArista = (cambios) => {
    const a = panel.datos
    const origenId  = a.origen   || a.id_origen
    const destinoId = a.destino  || a.id_destino
    if (onAristaEdit) onAristaEdit(origenId, destinoId, cambios)
    setPanel(null)
  }

  const cerrarPanel = () => setPanel(null)

  return (
    <div className="mapa-wrapper">
      {/* Barra de progreso OSRM */}
      {progreso > 0 && progreso < 100 && (
        <div className="mapa-progreso">
          <div className="progreso-barra" style={{ width: `${progreso}%` }} />
          <span>Cargando rutas reales... {progreso}%</span>
        </div>
      )}

      <MapContainer
        center={centro}
        zoom={6}
        className="mapa-leaflet"
        scrollWheelZoom
        zoomControl
      >
        {/* CartoDB Positron con nombres de ciudades */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        {/* Cerrar panel al hacer click en el mapa vacío */}
        <CerrarAlClickMapa onCerrar={cerrarPanel} />

        {/* ── Rutas de la red ──────────────────────────────────────────── */}
        {aristas.map((a, i) => {
          const origenId  = a.origen  || a.id_origen
          const destinoId = a.destino || a.id_destino
          const key = `${origenId}→${destinoId}`
          const path = roadPaths[key]
          if (!path || path.length < 2) return null

          const estilo = estiloArista(a)
          const nO = nodos.find(n => n.id === origenId)
          const nD = nodos.find(n => n.id === destinoId)

          return (
            <Polyline
              key={`r-${i}`}
              positions={path}
              pathOptions={{ ...estilo, lineCap: 'round', lineJoin: 'round' }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e)
                  setPanel({ tipo: 'arista', datos: a })
                },
              }}
            >
              <Tooltip sticky direction="center" className="tt-arista">
                <strong>{nO?.nombre || origenId} → {nD?.nombre || destinoId}</strong>
                <span>💰 Costo: ${(a.costo || a.costo_transporte || 0).toFixed(2)}/ton</span>
                <span>📦 Capacidad: {a.capacidad} ton</span>
                {(a.flujo || 0) > 0 && <span>🔄 Flujo: {Number(a.flujo).toFixed(1)} ton ({((a.utilizacion||0)*100).toFixed(0)}%)</span>}
                <span>📏 Distancia: {a.distancia} km</span>
                {a.estado === 'bloqueada' && <span className="tt-bloqueada">🚫 Vía bloqueada</span>}
                <span className="tt-hint">Click para editar</span>
              </Tooltip>
            </Polyline>
          )
        })}

        {/* ── Ruta Dijkstra destacada ──────────────────────────────────── */}
        {caminoDijkstra.length > 1 && (
          <Polyline
            positions={caminoDijkstra}
            pathOptions={{ color: '#7c3aed', weight: 5, dashArray: '10 5', opacity: 0.95, lineCap: 'round' }}
          />
        )}

        {/* ── Nodos ────────────────────────────────────────────────────── */}
        {nodos.map(nodo => {
          const lat = nodo.lat ?? nodo.latitud
          const lng = nodo.lng ?? nodo.longitud
          if (lat === undefined || lng === undefined) return null

          const calidad = nodo.tasa_calidad ?? 1
          const bordeColor = nodo.tipo === 'acopio' && calidad < 0.5
            ? '#ef4444'   // rojo si calidad baja
            : '#1e293b'

          return (
            <CircleMarker
              key={nodo.id}
              center={[lat, lng]}
              radius={RADIO_NODO[nodo.tipo] || 7}
              pathOptions={{
                fillColor:   COLOR_NODO[nodo.tipo] || '#64748b',
                fillOpacity: 0.9,
                color:       bordeColor,
                weight:      nodo.tipo === 'acopio' && calidad < 0.5 ? 3 : 1.5,
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e)
                  setPanel({ tipo: 'nodo', datos: nodo })
                },
              }}
            >
              {/* Tooltip hover */}
              <Tooltip direction="top" offset={[0, -10]} className="tt-nodo">
                <strong>{nodo.nombre}</strong>
                {nodo.tipo === 'origen'  && <span>📦 Oferta: {nodo.oferta} ton</span>}
                {nodo.tipo === 'destino' && <span>🛒 Demanda: {nodo.demanda} ton</span>}
                {nodo.tipo === 'acopio'  && <>
                  <span>🏢 Cap: {nodo.capacidad} ton</span>
                  <span>♻ Merma: {((nodo.tasa_merma||0)*100).toFixed(1)}%/día</span>
                  <span style={{ color: calidad < 0.5 ? '#ef4444' : '#22c55e' }}>
                    {calidad >= 0.7 ? '✓' : '⚠'} Calidad: {Math.round(calidad*100)}%
                  </span>
                </>}
                <span className="tt-hint">Click para editar</span>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {/* ── Panel de edición (fuera del MapContainer) ─────────────────── */}
      {panel?.tipo === 'nodo' && (
        <PanelNodo
          nodo={panel.datos}
          onGuardar={guardarNodo}
          onCerrar={cerrarPanel}
        />
      )}
      {panel?.tipo === 'arista' && (
        <PanelArista
          arista={panel.datos}
          nodos={nodos}
          onGuardar={guardarArista}
          onCerrar={cerrarPanel}
        />
      )}

      <Leyenda />
    </div>
  )
}
