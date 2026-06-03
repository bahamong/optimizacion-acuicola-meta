// Archivo: frontend/src/components/Mapa.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MapContainer, TileLayer, CircleMarker,
  Polyline, Tooltip, useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import {
  FaRoad, FaGasPump, FaHardHat, FaBan, FaTimes, FaDollarSign, FaBox,
  FaExchangeAlt, FaRuler, FaShoppingCart, FaWarehouse, FaRecycle,
  FaCheckCircle, FaExclamationTriangle, FaTimesCircle,
} from 'react-icons/fa'
import { obtenerRutasCache, guardarRutasCache } from '../services/api.js'

// ── Constantes ────────────────────────────────────────────────────────────────
const COLOR_NODO = {
  origen:  '#b91c1c', // rojo más oscuro
  acopio:  '#c2410c', // naranja fuerte
  destino: '#15803d', // verde oscuro vivo
}

const RADIO_NODO = {
  origen:  12,
  acopio:  10,
  destino: 8,
}

const COLOR_RUTA = {
  disponible: '#1d4ed8', // azul fuerte
  normal:     '#15803d', // verde oscuro
  alta:       '#c2410c', // naranja fuerte
  saturada:   '#b91c1c', // rojo oscuro
  bloqueada:  '#374151', // gris oscuro
  riesgo:     '#be123c', // vino / fucsia oscuro
  dijkstra:   '#5b21b6', // morado oscuro
}

const COLOR_RIESGO = COLOR_RUTA.riesgo

const SITUACIONES = [
  { id: 'normal',          label: 'Normal',                Icono: FaRoad,    mult: 1.00, color: '#22c55e', dash: null  },
  { id: 'gasolina_alta',   label: 'Gasolina alta (+15%)',  Icono: FaGasPump, mult: 1.15, color: '#f59e0b', dash: null  },
  { id: 'via_deteriorada', label: 'Vía deteriorada (+25%)',Icono: FaHardHat, mult: 1.25, color: '#ef4444', dash: null  },
  { id: 'via_bloqueada',   label: 'Vía bloqueada',         Icono: FaBan,     mult: null, color: '#6b7280', dash: '6 4' },
]

function rutaEnRiesgo(arista, nodos) {
  const umbral = Number(arista.umbral_calidad) || 0
  if (umbral <= 0) return false
  const o = arista.origen || arista.id_origen
  const d = arista.destino || arista.id_destino
  return [o, d]
    .map(id => nodos.find(n => n.id === id))
    .filter(Boolean)
    .map(n => (n.tasa_calidad ?? 1) * 100)
    .some(c => c < umbral)
}

const OSRM = 'https://router.project-osrm.org/route/v1/driving'

async function fetchRoadPath(lat1, lng1, lat2, lng2) {
  try {
    const url = `${OSRM}/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const data = await res.json()
    if (data.code === 'Ok' && data.routes?.length > 0) {
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng])
    }
  } catch {}
  return null
}

async function cargarTodasLasRutas(aristas, nodos, onProgreso) {
  const paths = {}
  const BATCH = 4
  const PAUSA = 250

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

function estiloArista(arista) {
  if (arista.estado === 'bloqueada') {
  return { color: COLOR_RUTA.bloqueada, weight: 2.4, opacity: 0.85, dashArray: '7 5' }
}
  const sit  = arista._situacion || 'normal'
  const util = arista.utilizacion || 0
  const flujo = arista.flujo || 0

  if (sit !== 'normal') {
    const s = SITUACIONES.find(x => x.id === sit) || SITUACIONES[0]
    return {
      color:     s.color,
      weight:    flujo > 0 ? Math.max(2, Math.min(5, util * 6 + 1.5)) : 1.8,
      opacity:   0.85,
      dashArray: s.dash,
    }
  }
    if (flujo <= 0) {
      return {
        color: COLOR_RUTA.disponible,
        weight: 2.4,
        opacity: 0.85,
        dashArray: null,
      }
    }

    let color

    if      (util >= 0.85) color = COLOR_RUTA.saturada
    else if (util >= 0.60) color = COLOR_RUTA.alta
    else                   color = COLOR_RUTA.normal

    return {
      color,
      weight: Math.max(3.5, Math.min(7, util * 8 + 3)),
      opacity: 0.95,
      dashArray: null,
    }
}

function CerrarAlClickMapa({ onCerrar }) {
  useMapEvents({ click: onCerrar })
  return null
}

function PanelNodo({ nodo, onGuardar, onCerrar }) {
  const [d, setD] = useState({ ...nodo })
  const n = k => e => setD(p => ({ ...p, [k]: Number(e.target.value) }))
  const s = k => e => setD(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="absolute top-3 right-3 z-[1000] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[300px] text-white text-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase
          ${nodo.tipo === 'origen' ? 'bg-red-500/20 text-red-300' :
            nodo.tipo === 'acopio' ? 'bg-amber-500/20 text-amber-300' :
            'bg-green-500/20 text-green-300'}`}>
          {nodo.tipo}
        </span>
        <h3 className="font-bold flex-1 text-sm">{nodo.id}</h3>
        <button className="text-slate-400 hover:text-white" onClick={onCerrar}><FaTimes /></button>
      </div>

      <div className="p-4 flex flex-col gap-3 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Nombre</label>
          <input className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
            value={d.nombre} onChange={s('nombre')} />
        </div>

        {nodo.tipo === 'origen' && <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Oferta disponible (ton)</label>
            <input type="number" min="0" className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              value={d.oferta} onChange={n('oferta')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Capacidad producción (ton)</label>
            <input type="number" min="0" className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              value={d.capacidad} onChange={n('capacidad')} />
          </div>
        </>}

        {nodo.tipo === 'destino' && <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Demanda requerida (ton)</label>
            <input type="number" min="0" className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              value={d.demanda} onChange={n('demanda')} />
          </div>
        </>}

        {nodo.tipo === 'acopio' && <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Capacidad almacenamiento (ton)</label>
            <input type="number" min="0" className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              value={d.capacidad} onChange={n('capacidad')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Tasa de calidad: <strong className="text-white">{Math.round((d.tasa_calidad ?? 1) * 100)}%</strong></label>
            <input type="range" min="0" max="1" step="0.05" value={d.tasa_calidad ?? 1} onChange={n('tasa_calidad')}
              className="w-full accent-indigo-500" />
            <div className={`text-xs px-2 py-1 rounded ${(d.tasa_calidad ?? 1) >= 0.7 ? 'bg-green-500/20 text-green-300' : (d.tasa_calidad ?? 1) >= 0.4 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
              {(d.tasa_calidad ?? 1) >= 0.7 ? <><FaCheckCircle className="inline mr-1" />Cumple criterios</> : (d.tasa_calidad ?? 1) >= 0.4 ? <><FaExclamationTriangle className="inline mr-1" />Calidad deficiente</> : <><FaTimesCircle className="inline mr-1" />No cumple — penaliza flujo</>}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Merma (derivada de calidad)</label>
            <input className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-300"
              readOnly value={`${((1 - (d.tasa_calidad ?? 1)) * 100).toFixed(1)}%`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Costo operación ($/día)</label>
            <input type="number" min="0" className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              value={d.costo_operacion ?? 0} onChange={n('costo_operacion')} />
          </div>
        </>}
      </div>

      <div className="flex gap-2 px-4 py-3 border-t border-slate-700">
        <button className="flex-1 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm transition-colors" onClick={onCerrar}>Cancelar</button>
        <button className="flex-1 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
          onClick={() => onGuardar(nodo.tipo === 'acopio' ? { ...d, tasa_merma: Math.round((1 - (d.tasa_calidad ?? 1)) * 10000) / 10000 } : d)}>
          Guardar
        </button>
      </div>
    </div>
  )
}

function PanelArista({ arista, nodos, onGuardar, onCerrar }) {
  const costoBase = useRef(arista._costoBase ?? arista.costo ?? arista.costo_transporte ?? 0)
  const [sit,   setSit]   = useState(arista._situacion || 'normal')
  const [costo, setCosto] = useState(Number((arista.costo || arista.costo_transporte || 0).toFixed(2)))
  const [cap,   setCap]   = useState(Number(arista.capacidad || 0))

  const seleccionar = (s) => {
    setSit(s.id)
    if (s.id !== 'via_bloqueada' && s.mult !== null) {
      setCosto(Number((costoBase.current * s.mult).toFixed(2)))
    }
  }

  const orig = nodos.find(n => n.id === (arista.origen || arista.id_origen))
  const dest = nodos.find(n => n.id === (arista.destino || arista.id_destino))

  return (
    <div className="absolute top-3 right-3 z-[1000] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[300px] text-white text-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
        <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-indigo-500/20 text-indigo-300">ruta</span>
        <h3 className="font-bold flex-1 text-xs">{orig?.nombre || arista.origen} → {dest?.nombre || arista.destino}</h3>
        <button className="text-slate-400 hover:text-white" onClick={onCerrar}><FaTimes /></button>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <p className="text-xs text-slate-400 uppercase tracking-wide">Situación de la vía</p>
        <div className="grid grid-cols-2 gap-2">
          {SITUACIONES.map(s => (
            <button key={s.id}
              className={`flex items-center gap-2 px-2 py-2 rounded border text-xs transition-all ${sit === s.id ? 'border-current font-bold opacity-100' : 'border-slate-600 text-slate-400 hover:border-slate-400'}`}
              style={sit === s.id ? { borderColor: s.color, color: s.color, background: s.color + '20' } : {}}
              onClick={() => seleccionar(s)}
            >
              <s.Icono /> {s.label}
            </button>
          ))}
        </div>

        {sit !== 'via_bloqueada' && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Costo de transporte ($/ton)</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="0.5"
                  className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                  value={costo} onChange={e => setCosto(Number(e.target.value))} />
                <span className="text-xs text-slate-500">Base: ${costoBase.current.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Capacidad máxima (ton)</label>
              <input type="number" min="1"
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                value={cap} onChange={e => setCap(Number(e.target.value))} />
            </div>
          </>
        )}

        {sit === 'via_bloqueada' && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded p-2 text-red-300 text-xs">
            <FaBan /> Esta ruta quedará bloqueada.
          </div>
        )}
      </div>

      <div className="flex gap-2 px-4 py-3 border-t border-slate-700">
        <button className="flex-1 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm transition-colors" onClick={onCerrar}>Cancelar</button>
        <button className="flex-1 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
          onClick={() => onGuardar({ _situacion: sit, _costoBase: costoBase.current, costo, capacidad: cap, estado: sit === 'via_bloqueada' ? 'bloqueada' : 'activa' })}>
          Aplicar
        </button>
      </div>
    </div>
  )
}

function Leyenda() {
  const [abierta, setAbierta] = useState(false)

  const rutas = [
    { color: COLOR_RUTA.disponible, dash: false, label: 'Disponible (sin flujo)' },
    { color: COLOR_RUTA.normal,     dash: false, label: 'Con flujo — normal' },
    { color: COLOR_RUTA.alta,       dash: false, label: 'Con flujo — alta demanda (>60%)' },
    { color: COLOR_RUTA.saturada,   dash: false, label: 'Con flujo — saturada (>85%)' },
    { color: COLOR_RUTA.bloqueada,  dash: true,  label: 'Bloqueada' },
    { color: COLOR_RUTA.riesgo,     dash: true,  label: 'En riesgo — calidad' },
    { color: COLOR_RUTA.dijkstra,   dash: true,  label: 'Ruta óptima — Dijkstra' },
  ]

  return (
    <div className="absolute bottom-3 left-3 z-[1000]">
      {!abierta ? (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="bg-slate-900/95 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white shadow-lg hover:bg-slate-800 transition-colors"
          title="Mostrar leyenda"
        >
          ☰ Leyenda
        </button>
      ) : (
        <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 text-xs text-white min-w-[210px] shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-slate-200">Leyenda</span>

            <button
              type="button"
              onClick={() => setAbierta(false)}
              className="w-6 h-6 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-white"
              title="Minimizar leyenda"
            >
              −
            </button>
          </div>

          <p className="font-bold text-slate-300 mb-1.5">Nodos</p>

          {[
            ['origen', COLOR_NODO.origen, 'Estación origen'],
            ['acopio', COLOR_NODO.acopio, 'Centro de acopio'],
            ['destino', COLOR_NODO.destino, 'Supermercado'],
          ].map(([, c, lbl]) => (
            <div key={lbl} className="flex items-center gap-2 mb-1">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: c }}
              />
              {lbl}
            </div>
          ))}

          <p className="font-bold text-slate-300 mb-1.5 mt-2">Rutas</p>

          {rutas.map((it, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              {it.dash ? (
                <span
                  className="w-6 border-t-2 border-dashed flex-shrink-0"
                  style={{ borderColor: it.color }}
                />
              ) : (
                <span
                  className="w-6 h-0.5 flex-shrink-0"
                  style={{ background: it.color }}
                />
              )}

              {it.label}
            </div>
          ))}

          <p className="text-slate-500 mt-1.5">
            Click en nodo o ruta para editar
          </p>
        </div>
      )}
    </div>
  )
}

export default function Mapa({
  nodos      = [],
  aristas    = [],
  rutaDestacada = [],
  onNodoEdit    = null,
  onAristaEdit  = null,
}) {
  const centro = [4.5709, -74.2973]
  const [roadPaths,    setRoadPaths]    = useState({})
  const [progreso,     setProgreso]     = useState(0)
  const [cacheLoaded,  setCacheLoaded]  = useState(false)
  const aristasKeyRef = useRef('')
  const [panel, setPanel] = useState(null)

  // ── Cargar caché de rutas desde Supabase (solo una vez al montar) ─────────
  useEffect(() => {
    let activo = true
    async function cargarCache() {
      try {
        const res = await obtenerRutasCache()
        if (activo && res.data && Object.keys(res.data).length > 0) {
          setRoadPaths(res.data)
          aristasKeyRef.current = '__from_cache__'
        }
      } catch { /* sin caché disponible */ }
      if (activo) setCacheLoaded(true)
    }
    cargarCache()
    return () => { activo = false }
  }, [])

  // ── Cargar rutas OSRM solo para las que no están en caché ─────────────────
  const aristasKey = aristas.map(a => `${a.origen||a.id_origen}-${a.destino||a.id_destino}`).join('|')

  const cargarRutas = useCallback(async () => {
    if (!cacheLoaded || nodos.length === 0 || aristas.length === 0) return
    if (aristasKey === aristasKeyRef.current) return
    aristasKeyRef.current = aristasKey

    // Detectar qué rutas faltan en caché
    const faltantes = aristas.filter(a => {
      const key = `${a.origen || a.id_origen}→${a.destino || a.id_destino}`
      return !roadPaths[key]
    })

    if (faltantes.length === 0) {
      setProgreso(100)
      return
    }

    setProgreso(1)
    const nuevas = await cargarTodasLasRutas(faltantes, nodos, p => {
      setProgreso(Math.round(p * faltantes.length / aristas.length))
    })
    const todosLosPath = { ...roadPaths, ...nuevas }
    setRoadPaths(todosLosPath)
    setProgreso(100)

    // Guardar rutas nuevas en Supabase para futuras visitas
    if (Object.keys(nuevas).length > 0) {
      try { await guardarRutasCache(nuevas) } catch { /* no crítico */ }
    }
  }, [aristasKey, nodos.length, cacheLoaded])

  useEffect(() => { cargarRutas() }, [cargarRutas])

  // ── Ruta Dijkstra ─────────────────────────────────────────────────────────
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

  const guardarNodo = (datos) => {
    if (onNodoEdit) onNodoEdit(datos.id, datos)
    setPanel(null)
  }
  const guardarArista = (cambios) => {
    const a = panel.datos
    if (onAristaEdit) onAristaEdit(a.origen || a.id_origen, a.destino || a.id_destino, cambios)
    setPanel(null)
  }
  const cerrarPanel = () => setPanel(null)

  return (
    <div className="relative w-full h-full">
      {/* Barra de progreso OSRM */}
      {progreso > 0 && progreso < 100 && (
        <div className="absolute top-0 left-0 right-0 z-[1001] h-7 bg-slate-800/90 flex items-center gap-2 px-3 text-xs text-white">
          <div className="flex-1 h-1.5 bg-slate-600 rounded overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progreso}%` }} />
          </div>
          <span>Cargando rutas reales... {progreso}%</span>
        </div>
      )}

      <MapContainer center={centro} zoom={6} className="w-full h-full" scrollWheelZoom zoomControl>
        <TileLayer
          url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          attribution='&copy; Google Maps'
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          maxZoom={20}
        />
        <CerrarAlClickMapa onCerrar={cerrarPanel} />

        {aristas.map((a, i) => {
          const origenId  = a.origen  || a.id_origen
          const destinoId = a.destino || a.id_destino
          const key = `${origenId}→${destinoId}`
          const path = roadPaths[key]
          if (!path || path.length < 2) return null
          const enRiesgo = rutaEnRiesgo(a, nodos)
          const base = estiloArista(a)
          const estilo = enRiesgo ? { ...base, color: COLOR_RIESGO, dashArray: '5 4', weight: Math.max(base.weight, 3), opacity: 0.9 } : base
          const nO = nodos.find(n => n.id === origenId)
          const nD = nodos.find(n => n.id === destinoId)
          return (
            <Polyline key={`r-${i}`} positions={path}
              pathOptions={{ ...estilo, lineCap: 'round', lineJoin: 'round' }}
              eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); setPanel({ tipo: 'arista', datos: a }) } }}>
              <Tooltip sticky direction="center">
                <strong>{nO?.nombre || origenId} → {nD?.nombre || destinoId}</strong>
                <span><FaDollarSign /> Costo: ${(a.costo || a.costo_transporte || 0).toFixed(2)}/ton</span>
                <span><FaBox /> Cap: {a.capacidad} ton</span>
                {(a.flujo || 0) > 0 && <span><FaExchangeAlt /> Flujo: {Number(a.flujo).toFixed(1)} ({((a.utilizacion||0)*100).toFixed(0)}%)</span>}
                <span><FaRuler /> {a.distancia} km</span>
                {a.estado === 'bloqueada' && <span><FaBan /> Vía bloqueada</span>}
                {enRiesgo && <span><FaExclamationTriangle /> En riesgo: calidad &lt; {a.umbral_calidad}%</span>}
                <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Click para editar</span>
              </Tooltip>
            </Polyline>
          )
        })}

        {caminoDijkstra.length > 1 && (
          <Polyline positions={caminoDijkstra}
            pathOptions={{ color: COLOR_RUTA.dijkstra, weight: 6, dashArray: '10 5', opacity: 1, lineCap: 'round' }} />
        )}
        

        {nodos.map(nodo => {
          const lat = nodo.lat ?? nodo.latitud
          const lng = nodo.lng ?? nodo.longitud
          if (lat === undefined || lng === undefined) return null
          const calidad = nodo.tasa_calidad ?? 1
          return (
            <CircleMarker key={nodo.id} center={[lat, lng]}
              radius={RADIO_NODO[nodo.tipo] || 7}
              pathOptions={{
                fillColor:   COLOR_NODO[nodo.tipo] || '#334155',
                fillOpacity: 1,
                color:       nodo.tipo === 'acopio' && calidad < 0.5 ? '#facc15' : '#ffffff',
                weight:      nodo.tipo === 'acopio' && calidad < 0.5 ? 4 : 2.5,
              }}
              eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); setPanel({ tipo: 'nodo', datos: nodo }) } }}>
              <Tooltip direction="top" offset={[0, -10]}>
                <strong>{nodo.nombre}</strong>
                {nodo.tipo === 'origen'  && <span><FaBox /> Oferta: {nodo.oferta} ton</span>}
                {nodo.tipo === 'destino' && <span><FaShoppingCart /> Demanda: {nodo.demanda} ton</span>}
                {nodo.tipo === 'acopio'  && <>
                  <span><FaWarehouse /> Cap: {nodo.capacidad} ton</span>
                  <span><FaRecycle /> Merma: {((nodo.tasa_merma||0)*100).toFixed(1)}%/día</span>
                  <span style={{ color: calidad < 0.5 ? '#ef4444' : '#22c55e' }}>
                    {calidad >= 0.7 ? <FaCheckCircle /> : <FaExclamationTriangle />} Calidad: {Math.round(calidad*100)}%
                  </span>
                </>}
                <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Click para editar</span>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {panel?.tipo === 'nodo' && (
        <PanelNodo nodo={panel.datos} onGuardar={guardarNodo} onCerrar={cerrarPanel} />
      )}
      {panel?.tipo === 'arista' && (
        <PanelArista arista={panel.datos} nodos={nodos} onGuardar={guardarArista} onCerrar={cerrarPanel} />
      )}
      <Leyenda />
    </div>
  )
}
