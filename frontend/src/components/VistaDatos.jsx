import { useState, useRef, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import {
  FaIndustry, FaWarehouse, FaStore, FaRoute, FaBoxOpen,
  FaCheckCircle, FaExclamationTriangle, FaSyncAlt, FaUpload, FaDownload,
  FaPlus, FaPlay, FaPen, FaTrash, FaTimes, FaSearch, FaSpinner,
} from 'react-icons/fa'
import {
  buscarLugares, geocodificarInverso, distanciaRuta, distanciaHaversine,
  MUNICIPIOS, DEPARTAMENTOS,
} from '../services/geo.js'
import './VistaDatos.css'

// ── Pin arrastrable (divIcon para evitar imágenes rotas con el bundler) ────────
const PIN = L.divIcon({
  className: 'pin-divicon',
  html: '<div class="pin-marker"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
})

// ── Valores iniciales ─────────────────────────────────────────────────────────
const NODO_VACIO = {
  tipo: 'origen', nombre: '', municipio: 'Villavicencio', departamento: 'Meta',
  lat: 4.142, lng: -73.626, capacidad: 100, oferta: 0, demanda: 0,
  tasa_merma: 0, tasa_calidad: 0.9, costo_operacion: 0, direccion: '',
}
const ARISTA_VACIA = {
  origen: '', destino: '', costo: 0, capacidad: 50, distancia: 0, estado: 'activa',
}

const TIPO_BADGE = {
  origen:  { bg: '#fee2e2', color: '#b91c1c', txt: 'Origen'  },
  acopio:  { bg: '#fef9c3', color: '#a16207', txt: 'Acopio'  },
  destino: { bg: '#dcfce7', color: '#166534', txt: 'Destino' },
}

// Merma derivada de la calidad (igual fórmula que el backend)
const mermaDesdeCalidad = c => Math.round((1 - Math.max(0, Math.min(1, c))) * 0.30 * 10000) / 10000

// Genera el siguiente ID automático según el tipo
function siguienteId(nodos, tipo) {
  const prefijo = { origen: 'O', acopio: 'A', destino: 'D' }[tipo]
  const nums = nodos
    .filter(n => n.id?.startsWith(prefijo))
    .map(n => parseInt(n.id.slice(1), 10))
    .filter(n => !isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `${prefijo}${max + 1}`
}

// ── Modal genérico ──────────────────────────────────────────────────────────
function Modal({ titulo, onClose, children, ancho }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-caja" style={ancho ? { maxWidth: ancho } : undefined} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{titulo}</h3>
          <button className="modal-cerrar" onClick={onClose}><FaTimes /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Recentrar el mini-mapa cuando cambian las coordenadas ─────────────────────
function Recentrar({ lat, lng }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], map.getZoom()) }, [lat, lng])  // eslint-disable-line
  return null
}

// ── Click en el mini-mapa coloca el pin ───────────────────────────────────────
function ClickColoca({ onMover }) {
  useMapEvents({ click: e => onMover(e.latlng.lat, e.latlng.lng) })
  return null
}

// ── Mini-mapa con pin arrastrable ─────────────────────────────────────────────
function MiniMapa({ lat, lng, onMover }) {
  return (
    <div className="mini-mapa">
      <MapContainer center={[lat, lng]} zoom={12} className="mini-mapa-leaflet" scrollWheelZoom>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        <Recentrar lat={lat} lng={lng} />
        <ClickColoca onMover={onMover} />
        <Marker
          position={[lat, lng]}
          icon={PIN}
          draggable
          eventHandlers={{
            dragend: e => { const p = e.target.getLatLng(); onMover(p.lat, p.lng) },
          }}
        />
      </MapContainer>
    </div>
  )
}

// ── Formulario de Nodo ────────────────────────────────────────────────────────
function FormNodo({ inicial, onGuardar, onCerrar, nodos }) {
  const esEdicion = !!inicial?.id
  const [d, setD] = useState(() => ({
    ...NODO_VACIO,
    ...inicial,
    lat: inicial?.lat ?? inicial?.latitud ?? NODO_VACIO.lat,
    lng: inicial?.lng ?? inicial?.longitud ?? NODO_VACIO.lng,
  }))

  // Autocompletado de direcciones
  const [sugerencias, setSugerencias] = useState([])
  const [buscando, setBuscando] = useState(false)
  const debounceRef = useRef()

  const set = (k, v) => setD(p => ({ ...p, [k]: v }))

  // Buscar lugares mientras se escribe (debounce 500ms)
  function onCambioDireccion(texto) {
    set('direccion', texto)
    clearTimeout(debounceRef.current)
    if (texto.trim().length < 3) { setSugerencias([]); return }
    setBuscando(true)
    debounceRef.current = setTimeout(async () => {
      const res = await buscarLugares(texto)
      setSugerencias(res)
      setBuscando(false)
    }, 500)
  }

  function elegirSugerencia(s) {
    setD(p => ({
      ...p,
      direccion: s.etiqueta,
      lat: s.lat, lng: s.lng,
      municipio: MUNICIPIOS[p.departamento]?.includes(s.municipio) ? s.municipio : p.municipio,
      departamento: DEPARTAMENTOS.includes(s.departamento) ? s.departamento : p.departamento,
    }))
    setSugerencias([])
  }

  // Mover el pin → reverse geocoding
  const moverPin = useCallback(async (lat, lng) => {
    setD(p => ({ ...p, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }))
    const info = await geocodificarInverso(lat, lng)
    if (info) {
      setD(p => ({
        ...p,
        direccion: info.etiqueta || p.direccion,
        municipio: MUNICIPIOS[p.departamento]?.includes(info.municipio) ? info.municipio : p.municipio,
        departamento: DEPARTAMENTOS.includes(info.departamento) ? info.departamento : p.departamento,
      }))
    }
  }, [])

  // Cambiar departamento → ajustar municipio al primero válido
  function cambiarDepto(dep) {
    setD(p => ({ ...p, departamento: dep, municipio: MUNICIPIOS[dep][0] }))
  }

  const merma = mermaDesdeCalidad(d.tasa_calidad)

  function submit(e) {
    e.preventDefault()
    if (!d.nombre.trim()) return alert('El nombre es obligatorio')
    const datos = {
      ...d,
      nombre: d.nombre.trim(),
      lat: Number(d.lat), lng: Number(d.lng),
      tasa_merma: d.tipo === 'acopio' ? merma : 0,
    }
    onGuardar(datos)
  }

  return (
    <form onSubmit={submit} className="form-datos">
      <div className="form-fila2">
        <div className="form-campo">
          <label>Tipo de nodo *</label>
          <select value={d.tipo} onChange={e => set('tipo', e.target.value)} disabled={esEdicion}>
            <option value="origen">Origen (estación)</option>
            <option value="acopio">Acopio (centro)</option>
            <option value="destino">Destino (supermercado)</option>
          </select>
        </div>
        <div className="form-campo">
          <label>Nombre *</label>
          <input value={d.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre descriptivo" required />
        </div>
      </div>

      {/* Buscador de dirección / lugar */}
      <div className="form-campo form-busca">
        <label><FaSearch /> Buscar dirección o lugar</label>
        <input
          value={d.direccion}
          onChange={e => onCambioDireccion(e.target.value)}
          placeholder="Ej. Centro comercial Villavicencio, calle 40..."
          autoComplete="off"
        />
        {buscando && <span className="form-hint"><FaSpinner className="spin" /> Buscando...</span>}
        {sugerencias.length > 0 && (
          <ul className="sugerencias">
            {sugerencias.map((s, i) => (
              <li key={i} onClick={() => elegirSugerencia(s)}>{s.etiqueta}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Mini-mapa con pin */}
      <MiniMapa lat={Number(d.lat)} lng={Number(d.lng)} onMover={moverPin} />
      <p className="form-hint">Arrastra el pin o haz click en el mapa para ajustar la ubicación.</p>

      <div className="form-fila2">
        <div className="form-campo">
          <label>Departamento</label>
          <select value={d.departamento} onChange={e => cambiarDepto(e.target.value)}>
            {DEPARTAMENTOS.map(dep => <option key={dep} value={dep}>{dep}</option>)}
          </select>
        </div>
        <div className="form-campo">
          <label>Municipio</label>
          <select value={d.municipio} onChange={e => set('municipio', e.target.value)}>
            {(MUNICIPIOS[d.departamento] || []).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="form-fila2">
        <div className="form-campo">
          <label>Latitud (automática)</label>
          <input value={Number(d.lat).toFixed(5)} readOnly className="readonly" />
        </div>
        <div className="form-campo">
          <label>Longitud (automática)</label>
          <input value={Number(d.lng).toFixed(5)} readOnly className="readonly" />
        </div>
      </div>

      <div className="form-fila2">
        <div className="form-campo">
          <label>Capacidad (ton)</label>
          <input type="number" min="0" value={d.capacidad} onChange={e => set('capacidad', Number(e.target.value))} />
        </div>
        {d.tipo === 'origen' && (
          <div className="form-campo">
            <label>Oferta (ton)</label>
            <input type="number" min="0" value={d.oferta} onChange={e => set('oferta', Number(e.target.value))} />
          </div>
        )}
        {d.tipo === 'destino' && (
          <div className="form-campo">
            <label>Demanda (ton)</label>
            <input type="number" min="0" value={d.demanda} onChange={e => set('demanda', Number(e.target.value))} />
          </div>
        )}
        {d.tipo === 'acopio' && (
          <div className="form-campo">
            <label>Costo operación ($/día)</label>
            <input type="number" min="0" value={d.costo_operacion} onChange={e => set('costo_operacion', Number(e.target.value))} />
          </div>
        )}
      </div>

      {d.tipo === 'acopio' && (
        <div className="form-calidad">
          <label>Porcentaje de calidad: <strong>{Math.round(d.tasa_calidad * 100)}%</strong></label>
          <input
            type="range" min="0" max="1" step="0.01"
            value={d.tasa_calidad}
            onChange={e => set('tasa_calidad', Number(e.target.value))}
          />
          <div className="merma-derivada">
            Merma diaria derivada: <strong>{(merma * 100).toFixed(1)}%</strong>
            <span className="form-hint"> (menor calidad → mayor merma)</span>
          </div>
          {d.tasa_calidad < 0.5 && (
            <div className="alerta-calidad">
              <FaExclamationTriangle /> Calidad por debajo del 50% — el acopio falla los criterios y penaliza el flujo.
            </div>
          )}
        </div>
      )}

      <div className="form-acciones">
        <button type="button" className="btn-cancelar" onClick={onCerrar}>Cancelar</button>
        <button type="submit" className="btn-guardar">
          {esEdicion ? 'Guardar cambios' : 'Agregar nodo'}
        </button>
      </div>
    </form>
  )
}

// ── Formulario de Arista ──────────────────────────────────────────────────────
function FormArista({ inicial, onGuardar, onCerrar, nodos, aristas }) {
  const esEdicion = !!inicial?.origen || !!inicial?.id_origen
  const [d, setD] = useState(() => ({
    ...ARISTA_VACIA,
    ...inicial,
    origen: inicial?.origen || inicial?.id_origen || '',
    destino: inicial?.destino || inicial?.id_destino || '',
    costo: inicial?.costo ?? inicial?.costo_transporte ?? 0,
  }))
  const [calcDist, setCalcDist] = useState(false)

  const set = (k, v) => setD(p => ({ ...p, [k]: v }))

  // Calcular distancia automáticamente cuando origen y destino están definidos
  useEffect(() => {
    if (!d.origen || !d.destino || d.origen === d.destino) return
    const nO = nodos.find(n => n.id === d.origen)
    const nD = nodos.find(n => n.id === d.destino)
    if (!nO || !nD) return
    const latO = nO.lat ?? nO.latitud, lngO = nO.lng ?? nO.longitud
    const latD = nD.lat ?? nD.latitud, lngD = nD.lng ?? nD.longitud
    let cancelado = false
    setCalcDist(true)
    distanciaRuta(latO, lngO, latD, lngD).then(km => {
      if (cancelado) return
      const dist = km ?? distanciaHaversine(latO, lngO, latD, lngD)
      setD(p => ({ ...p, distancia: dist }))
      setCalcDist(false)
    })
    return () => { cancelado = true }
  }, [d.origen, d.destino, nodos])

  function existeDuplicado() {
    return aristas.some(a => {
      const o = a.origen || a.id_origen
      const dest = a.destino || a.id_destino
      // al editar, ignorar la propia arista
      if (esEdicion && o === (inicial.origen || inicial.id_origen) && dest === (inicial.destino || inicial.id_destino))
        return false
      return o === d.origen && dest === d.destino
    })
  }

  function submit(e) {
    e.preventDefault()
    if (!d.origen) return alert('Selecciona el nodo origen')
    if (!d.destino) return alert('Selecciona el nodo destino')
    if (d.origen === d.destino) return alert('Origen y destino deben ser diferentes')
    if (existeDuplicado()) return alert(`Ya existe la ruta ${d.origen} → ${d.destino}. No se permiten rutas duplicadas.`)
    if (Number(d.capacidad) <= 0) return alert('La capacidad debe ser mayor a 0')
    if (Number(d.distancia) <= 0) return alert('Aún no se ha calculado la distancia. Espera un momento.')
    onGuardar(d)
  }

  return (
    <form onSubmit={submit} className="form-datos">
      <div className="form-fila2">
        <div className="form-campo">
          <label>Nodo origen *</label>
          <select value={d.origen} onChange={e => set('origen', e.target.value)}>
            <option value="">— Seleccionar —</option>
            {nodos.map(n => <option key={n.id} value={n.id}>{n.nombre} ({n.municipio})</option>)}
          </select>
        </div>
        <div className="form-campo">
          <label>Nodo destino *</label>
          <select value={d.destino} onChange={e => set('destino', e.target.value)}>
            <option value="">— Seleccionar —</option>
            {nodos.filter(n => n.id !== d.origen).map(n =>
              <option key={n.id} value={n.id}>{n.nombre} ({n.municipio})</option>
            )}
          </select>
        </div>
      </div>

      <div className="form-fila3">
        <div className="form-campo">
          <label>Costo ($/ton)</label>
          <input type="number" min="0" step="0.01" value={d.costo} onChange={e => set('costo', Number(e.target.value))} />
        </div>
        <div className="form-campo">
          <label>Capacidad (ton)</label>
          <input type="number" min="1" value={d.capacidad} onChange={e => set('capacidad', Number(e.target.value))} />
        </div>
        <div className="form-campo">
          <label>Distancia (km) — automática</label>
          <input
            value={calcDist ? 'Calculando...' : (d.distancia ? `${d.distancia} km` : '—')}
            readOnly className="readonly"
          />
        </div>
      </div>

      <div className="form-campo">
        <label>Estado</label>
        <select value={d.estado} onChange={e => set('estado', e.target.value)}>
          <option value="activa">Activa</option>
          <option value="bloqueada">Bloqueada</option>
        </select>
      </div>

      <div className="form-acciones">
        <button type="button" className="btn-cancelar" onClick={onCerrar}>Cancelar</button>
        <button type="submit" className="btn-guardar" disabled={calcDist}>
          {esEdicion ? 'Guardar cambios' : 'Agregar ruta'}
        </button>
      </div>
    </form>
  )
}

// ── Vista principal ───────────────────────────────────────────────────────────
export default function VistaDatos({
  nodos, aristas, onNodosChange, onAristasChange,
  onAplicar, onCargarDefecto, sincronizado, cargando,
}) {
  const [tab, setTab] = useState('nodos')
  const [modal, setModal] = useState(null)
  const [filtro, setFiltro] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroDepto, setFiltroDepto] = useState('todos')
  const fileRef = useRef()

  // ── CRUD nodos ─────────────────────────────────────────────────────────────
  function agregarNodo(datos) {
    const id = siguienteId(nodos, datos.tipo)   // ID automático
    onNodosChange([...nodos, { ...datos, id }])
    setModal(null)
  }
  function editarNodo(datos) {
    onNodosChange(nodos.map(n => n.id === datos.id ? datos : n))
    setModal(null)
  }
  function eliminarNodo(id) {
    if (!confirm(`¿Eliminar nodo "${id}"? También se eliminarán sus rutas.`)) return
    onNodosChange(nodos.filter(n => n.id !== id))
    onAristasChange(aristas.filter(a => (a.origen || a.id_origen) !== id && (a.destino || a.id_destino) !== id))
  }

  // ── CRUD aristas ───────────────────────────────────────────────────────────
  function agregarArista(datos) {
    onAristasChange([...aristas, datos])
    setModal(null)
  }
  function editarArista(datos, idx) {
    const nuevo = [...aristas]; nuevo[idx] = datos
    onAristasChange(nuevo)
    setModal(null)
  }
  function eliminarArista(idx) {
    if (!confirm('¿Eliminar esta ruta?')) return
    onAristasChange(aristas.filter((_, i) => i !== idx))
  }

  // ── Import / Export JSON ───────────────────────────────────────────────────
  function importarJSON(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.nodos) onNodosChange(data.nodos)
        if (data.aristas) onAristasChange(data.aristas)
        alert(`Importado: ${data.nodos?.length || 0} nodos, ${data.aristas?.length || 0} aristas`)
      } catch { alert('El archivo no es un JSON válido.') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }
  function exportarJSON() {
    const blob = new Blob([JSON.stringify({ nodos, aristas }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'red_acuicola.json'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  const txt = filtro.toLowerCase()
  const nodosFiltrados = nodos.filter(n =>
    (filtroTipo === 'todos' || n.tipo === filtroTipo) &&
    (filtroDepto === 'todos' || n.departamento === filtroDepto) &&
    (!txt || n.nombre?.toLowerCase().includes(txt) || n.municipio?.toLowerCase().includes(txt))
  )
  const aristasFiltradas = aristas.map((a, idx) => ({ a, idx })).filter(({ a }) => {
    const o = a.origen || a.id_origen || ''
    const dest = a.destino || a.id_destino || ''
    const nO = nodos.find(n => n.id === o)
    const nD = nodos.find(n => n.id === dest)
    if (!txt) return true
    return o.toLowerCase().includes(txt) || dest.toLowerCase().includes(txt)
      || nO?.nombre?.toLowerCase().includes(txt) || nD?.nombre?.toLowerCase().includes(txt)
  })

  const ofertaTotal  = nodos.filter(n => n.tipo === 'origen').reduce((s, n) => s + Number(n.oferta || 0), 0)
  const demandaTotal = nodos.filter(n => n.tipo === 'destino').reduce((s, n) => s + Number(n.demanda || 0), 0)

  return (
    <div className="vista-datos">
      {/* Resumen */}
      <div className="datos-resumen">
        <div className="resumen-chip blue"><FaIndustry /> {nodos.filter(n => n.tipo === 'origen').length} estaciones</div>
        <div className="resumen-chip amber"><FaWarehouse /> {nodos.filter(n => n.tipo === 'acopio').length} acopios</div>
        <div className="resumen-chip green"><FaStore /> {nodos.filter(n => n.tipo === 'destino').length} supermercados</div>
        <div className="resumen-chip gray"><FaRoute /> {aristas.length} rutas</div>
        <div className="resumen-chip blue"><FaBoxOpen /> Oferta: {ofertaTotal} ton</div>
        <div className="resumen-chip green"><FaBoxOpen /> Demanda: {demandaTotal} ton</div>
        <div className={`resumen-chip ${sincronizado ? 'green' : 'red'}`}>
          {sincronizado ? <><FaCheckCircle /> Datos en sistema</> : <><FaExclamationTriangle /> Pendiente de aplicar</>}
        </div>
      </div>

      {/* Toolbar */}
      <div className="datos-toolbar">
        <div className="toolbar-izq">
          <button className="btn-toolbar btn-defecto" onClick={onCargarDefecto} disabled={cargando}>
            <FaSyncAlt /> Red predeterminada
          </button>
          <button className="btn-toolbar" onClick={() => fileRef.current.click()}>
            <FaUpload /> Importar JSON
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importarJSON} />
          <button className="btn-toolbar" onClick={exportarJSON}>
            <FaDownload /> Exportar JSON
          </button>
        </div>
        <button className="btn-aplicar" onClick={onAplicar} disabled={cargando || sincronizado}>
          {cargando ? <><FaSpinner className="spin" /> Aplicando...</> : <><FaPlay /> Aplicar al sistema</>}
        </button>
      </div>

      {/* Tabs + filtros */}
      <div className="datos-tabs-bar">
        <button className={`datos-tab ${tab === 'nodos' ? 'activo' : ''}`} onClick={() => setTab('nodos')}>
          Nodos ({nodos.length})
        </button>
        <button className={`datos-tab ${tab === 'aristas' ? 'activo' : ''}`} onClick={() => setTab('aristas')}>
          Rutas ({aristas.length})
        </button>

        {tab === 'nodos' && (
          <div className="filtros-grupo">
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="filtro-select">
              <option value="todos">Todos los tipos</option>
              <option value="origen">Orígenes</option>
              <option value="acopio">Acopios</option>
              <option value="destino">Destinos</option>
            </select>
            <select value={filtroDepto} onChange={e => setFiltroDepto(e.target.value)} className="filtro-select">
              <option value="todos">Todos los deptos.</option>
              {DEPARTAMENTOS.map(dep => <option key={dep} value={dep}>{dep}</option>)}
            </select>
          </div>
        )}

        <div className="tabs-buscador">
          <FaSearch className="buscador-icono" />
          <input type="text" placeholder="Buscar por nombre o municipio..." value={filtro} onChange={e => setFiltro(e.target.value)} />
          {filtro && <button onClick={() => setFiltro('')}><FaTimes /></button>}
        </div>

        <button
          className="btn-agregar"
          onClick={() => setModal({ tipo: tab === 'nodos' ? 'nodo-nuevo' : 'arista-nueva' })}
        >
          <FaPlus /> Agregar {tab === 'nodos' ? 'nodo' : 'ruta'}
        </button>
      </div>

      {/* Tabla de nodos — SIN columna ID */}
      {tab === 'nodos' && (
        <div className="tabla-wrapper">
          <table className="tabla-datos">
            <thead>
              <tr>
                <th>Nombre</th><th>Tipo</th><th>Municipio</th><th>Depto.</th>
                <th>Lat</th><th>Lng</th><th>Cap (ton)</th>
                <th>Oferta</th><th>Demanda</th><th>Calidad</th><th>Merma</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {nodosFiltrados.map(n => {
                const badge = TIPO_BADGE[n.tipo] || {}
                return (
                  <tr key={n.id}>
                    <td className="td-nombre">{n.nombre}</td>
                    <td><span className="tipo-badge" style={{ background: badge.bg, color: badge.color }}>{badge.txt || n.tipo}</span></td>
                    <td>{n.municipio}</td>
                    <td>{n.departamento}</td>
                    <td className="td-num">{Number(n.lat || n.latitud || 0).toFixed(4)}</td>
                    <td className="td-num">{Number(n.lng || n.longitud || 0).toFixed(4)}</td>
                    <td className="td-num">{n.capacidad}</td>
                    <td className="td-num">{n.tipo === 'origen' ? n.oferta : '—'}</td>
                    <td className="td-num">{n.tipo === 'destino' ? n.demanda : '—'}</td>
                    <td className="td-num">{n.tipo === 'acopio' ? ((n.tasa_calidad ?? 1) * 100).toFixed(0) + '%' : '—'}</td>
                    <td className="td-num">{n.tipo === 'acopio' ? ((n.tasa_merma || 0) * 100).toFixed(1) + '%' : '—'}</td>
                    <td className="td-acciones">
                      <button className="btn-tabla-edit" onClick={() => setModal({ tipo: 'nodo-editar', datos: n })}><FaPen /></button>
                      <button className="btn-tabla-del" onClick={() => eliminarNodo(n.id)}><FaTrash /></button>
                    </td>
                  </tr>
                )
              })}
              {nodosFiltrados.length === 0 && (
                <tr><td colSpan={12} className="td-vacio">No hay nodos que coincidan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla de aristas — SIN columna ID */}
      {tab === 'aristas' && (
        <div className="tabla-wrapper">
          <table className="tabla-datos">
            <thead>
              <tr>
                <th>Origen</th><th>Destino</th>
                <th>Costo ($/ton)</th><th>Capacidad</th><th>Distancia</th>
                <th>Estado</th><th>Flujo</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {aristasFiltradas.map(({ a, idx }) => {
                const o = a.origen || a.id_origen || ''
                const dest = a.destino || a.id_destino || ''
                const nO = nodos.find(n => n.id === o)
                const nD = nodos.find(n => n.id === dest)
                return (
                  <tr key={idx}>
                    <td className="td-nombre">{nO?.nombre || o}</td>
                    <td className="td-nombre">{nD?.nombre || dest}</td>
                    <td className="td-num">${Number(a.costo || a.costo_transporte || 0).toFixed(2)}</td>
                    <td className="td-num">{a.capacidad}</td>
                    <td className="td-num">{a.distancia} km</td>
                    <td><span className={`estado-badge ${a.estado === 'bloqueada' ? 'bloqueada' : 'activa'}`}>{a.estado || 'activa'}</span></td>
                    <td className="td-num">{a.flujo > 0 ? `${Number(a.flujo).toFixed(1)} (${((a.utilizacion || 0) * 100).toFixed(0)}%)` : '—'}</td>
                    <td className="td-acciones">
                      <button className="btn-tabla-edit" onClick={() => setModal({ tipo: 'arista-editar', datos: a, idx })}><FaPen /></button>
                      <button className="btn-tabla-del" onClick={() => eliminarArista(idx)}><FaTrash /></button>
                    </td>
                  </tr>
                )
              })}
              {aristasFiltradas.length === 0 && (
                <tr><td colSpan={8} className="td-vacio">No hay rutas que coincidan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modales */}
      {modal?.tipo === 'nodo-nuevo' && (
        <Modal titulo="Agregar nodo" onClose={() => setModal(null)} ancho="600px">
          <FormNodo inicial={null} onGuardar={agregarNodo} onCerrar={() => setModal(null)} nodos={nodos} />
        </Modal>
      )}
      {modal?.tipo === 'nodo-editar' && (
        <Modal titulo={`Editar ${modal.datos.nombre}`} onClose={() => setModal(null)} ancho="600px">
          <FormNodo inicial={modal.datos} onGuardar={editarNodo} onCerrar={() => setModal(null)} nodos={nodos} />
        </Modal>
      )}
      {modal?.tipo === 'arista-nueva' && (
        <Modal titulo="Agregar ruta" onClose={() => setModal(null)}>
          <FormArista inicial={null} onGuardar={agregarArista} onCerrar={() => setModal(null)} nodos={nodos} aristas={aristas} />
        </Modal>
      )}
      {modal?.tipo === 'arista-editar' && (
        <Modal titulo="Editar ruta" onClose={() => setModal(null)}>
          <FormArista inicial={modal.datos} onGuardar={dd => editarArista(dd, modal.idx)}
            onCerrar={() => setModal(null)} nodos={nodos} aristas={aristas} />
        </Modal>
      )}
    </div>
  )
}
