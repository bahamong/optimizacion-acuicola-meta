import { useState, useRef } from 'react'
import './VistaDatos.css'

// ── Valores iniciales de los formularios ──────────────────────────────────────
const NODO_VACIO = {
  id:'', tipo:'origen', nombre:'', municipio:'', departamento:'',
  lat:4.7, lng:-74.1, capacidad:100, oferta:0, demanda:0,
  tasa_merma:0, tasa_calidad:1, costo_operacion:0
}
const ARISTA_VACIA = {
  origen:'', destino:'', costo:0, capacidad:0, distancia:0, estado:'activa'
}

// ── Etiquetas legibles por tipo ───────────────────────────────────────────────
const TIPO_BADGE = {
  origen:  { bg:'#fee2e2', color:'#b91c1c', txt:'Origen'  },
  acopio:  { bg:'#fef9c3', color:'#a16207', txt:'Acopio'  },
  destino: { bg:'#dcfce7', color:'#166534', txt:'Destino' },
}

// ── Modal genérico ────────────────────────────────────────────────────────────
function Modal({ titulo, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-caja" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{titulo}</h3>
          <button className="modal-cerrar" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Formulario de Nodo ────────────────────────────────────────────────────────
function FormNodo({ inicial, onGuardar, onCerrar, idsExistentes }) {
  const [d, setD] = useState({ ...NODO_VACIO, ...inicial })
  const s = k => e => setD(p => ({ ...p, [k]: e.target.value }))
  const n = k => e => setD(p => ({ ...p, [k]: Number(e.target.value) }))

  function submit(e) {
    e.preventDefault()
    if (!d.id.trim()) return alert('El ID es obligatorio')
    if (!d.nombre.trim()) return alert('El nombre es obligatorio')
    if (!inicial && idsExistentes.includes(d.id.trim()))
      return alert(`Ya existe un nodo con ID "${d.id}"`)
    onGuardar({ ...d, id: d.id.trim(), nombre: d.nombre.trim() })
  }

  return (
    <form onSubmit={submit} className="form-datos">
      <div className="form-fila2">
        <div className="form-campo">
          <label>ID *</label>
          <input value={d.id} onChange={s('id')} disabled={!!inicial?.id} placeholder="ej. O1" required />
        </div>
        <div className="form-campo">
          <label>Tipo *</label>
          <select value={d.tipo} onChange={s('tipo')}>
            <option value="origen">Origen (estación)</option>
            <option value="acopio">Acopio (centro)</option>
            <option value="destino">Destino (supermercado)</option>
          </select>
        </div>
      </div>

      <div className="form-campo">
        <label>Nombre *</label>
        <input value={d.nombre} onChange={s('nombre')} placeholder="Nombre descriptivo" required />
      </div>

      <div className="form-fila2">
        <div className="form-campo">
          <label>Municipio</label>
          <input value={d.municipio} onChange={s('municipio')} placeholder="ej. Bogotá" />
        </div>
        <div className="form-campo">
          <label>Departamento</label>
          <input value={d.departamento} onChange={s('departamento')} placeholder="ej. Cundinamarca" />
        </div>
      </div>

      <div className="form-fila2">
        <div className="form-campo">
          <label>Latitud</label>
          <input type="number" step="0.0001" value={d.lat} onChange={n('lat')} />
        </div>
        <div className="form-campo">
          <label>Longitud</label>
          <input type="number" step="0.0001" value={d.lng} onChange={n('lng')} />
        </div>
      </div>

      <div className="form-fila2">
        <div className="form-campo">
          <label>Capacidad (ton)</label>
          <input type="number" min="0" value={d.capacidad} onChange={n('capacidad')} />
        </div>
        {d.tipo === 'origen' && (
          <div className="form-campo">
            <label>Oferta (ton)</label>
            <input type="number" min="0" value={d.oferta} onChange={n('oferta')} />
          </div>
        )}
        {d.tipo === 'destino' && (
          <div className="form-campo">
            <label>Demanda (ton)</label>
            <input type="number" min="0" value={d.demanda} onChange={n('demanda')} />
          </div>
        )}
        {d.tipo === 'acopio' && (
          <div className="form-campo">
            <label>Costo operación ($/día)</label>
            <input type="number" min="0" value={d.costo_operacion} onChange={n('costo_operacion')} />
          </div>
        )}
      </div>

      {d.tipo === 'acopio' && (
        <div className="form-fila2">
          <div className="form-campo">
            <label>Tasa merma diaria (0-1)</label>
            <input type="number" step="0.001" min="0" max="1" value={d.tasa_merma} onChange={n('tasa_merma')} />
            <span className="form-hint">{(d.tasa_merma * 100).toFixed(1)}% pérdida diaria</span>
          </div>
          <div className="form-campo">
            <label>Tasa calidad (0-1)</label>
            <input type="number" step="0.01" min="0" max="1" value={d.tasa_calidad} onChange={n('tasa_calidad')} />
            <span className="form-hint">{(d.tasa_calidad * 100).toFixed(0)}% productos aprobados</span>
          </div>
        </div>
      )}

      <div className="form-acciones">
        <button type="button" className="btn-cancelar" onClick={onCerrar}>Cancelar</button>
        <button type="submit" className="btn-guardar">
          {inicial?.id ? 'Guardar cambios' : 'Agregar nodo'}
        </button>
      </div>
    </form>
  )
}

// ── Formulario de Arista ──────────────────────────────────────────────────────
function FormArista({ inicial, onGuardar, onCerrar, nodos }) {
  const [d, setD] = useState({ ...ARISTA_VACIA, ...inicial })
  const s = k => e => setD(p => ({ ...p, [k]: e.target.value }))
  const n = k => e => setD(p => ({ ...p, [k]: Number(e.target.value) }))

  function submit(e) {
    e.preventDefault()
    if (!d.origen) return alert('Selecciona el nodo origen')
    if (!d.destino) return alert('Selecciona el nodo destino')
    if (d.origen === d.destino) return alert('Origen y destino deben ser diferentes')
    if (Number(d.capacidad) <= 0) return alert('La capacidad debe ser mayor a 0')
    if (Number(d.distancia) <= 0) return alert('La distancia debe ser mayor a 0')
    onGuardar(d)
  }

  return (
    <form onSubmit={submit} className="form-datos">
      <div className="form-fila2">
        <div className="form-campo">
          <label>Nodo origen *</label>
          <select value={d.origen} onChange={s('origen')}>
            <option value="">— Seleccionar —</option>
            {nodos.map(n => <option key={n.id} value={n.id}>{n.id} — {n.nombre}</option>)}
          </select>
        </div>
        <div className="form-campo">
          <label>Nodo destino *</label>
          <select value={d.destino} onChange={s('destino')}>
            <option value="">— Seleccionar —</option>
            {nodos.filter(n => n.id !== d.origen).map(n =>
              <option key={n.id} value={n.id}>{n.id} — {n.nombre}</option>
            )}
          </select>
        </div>
      </div>

      <div className="form-fila3">
        <div className="form-campo">
          <label>Costo ($/ton)</label>
          <input type="number" min="0" step="0.01" value={d.costo} onChange={n('costo')} />
        </div>
        <div className="form-campo">
          <label>Capacidad (ton)</label>
          <input type="number" min="1" value={d.capacidad} onChange={n('capacidad')} />
        </div>
        <div className="form-campo">
          <label>Distancia (km)</label>
          <input type="number" min="1" value={d.distancia} onChange={n('distancia')} />
        </div>
      </div>

      <div className="form-campo">
        <label>Estado</label>
        <select value={d.estado} onChange={s('estado')}>
          <option value="activa">Activa</option>
          <option value="bloqueada">Bloqueada</option>
        </select>
      </div>

      <div className="form-acciones">
        <button type="button" className="btn-cancelar" onClick={onCerrar}>Cancelar</button>
        <button type="submit" className="btn-guardar">
          {inicial?.origen ? 'Guardar cambios' : 'Agregar arista'}
        </button>
      </div>
    </form>
  )
}

// ── Vista principal ───────────────────────────────────────────────────────────
export default function VistaDatos({
  nodos, aristas, onNodosChange, onAristasChange,
  onAplicar, onCargarDefecto, sincronizado, cargando
}) {
  const [tab,         setTab]         = useState('nodos')
  const [modal,       setModal]       = useState(null)   // null | {tipo, datos}
  const [filtro,      setFiltro]      = useState('')
  const fileRef = useRef()

  // ── CRUD nodos ─────────────────────────────────────────────────────────────
  function agregarNodo(datos) {
    onNodosChange([...nodos, datos])
    setModal(null)
  }
  function editarNodo(datos) {
    onNodosChange(nodos.map(n => n.id === datos.id ? datos : n))
    setModal(null)
  }
  function eliminarNodo(id) {
    if (!confirm(`¿Eliminar nodo "${id}"? También se eliminarán sus rutas.`)) return
    onNodosChange(nodos.filter(n => n.id !== id))
    onAristasChange(aristas.filter(a => (a.origen||a.id_origen) !== id && (a.destino||a.id_destino) !== id))
  }

  // ── CRUD aristas ───────────────────────────────────────────────────────────
  function agregarArista(datos) {
    onAristasChange([...aristas, datos])
    setModal(null)
  }
  function editarArista(datos, idx) {
    const nuevo = [...aristas]
    nuevo[idx] = datos
    onAristasChange(nuevo)
    setModal(null)
  }
  function eliminarArista(idx) {
    if (!confirm('¿Eliminar esta ruta?')) return
    onAristasChange(aristas.filter((_, i) => i !== idx))
  }

  // ── Importar/Exportar JSON ─────────────────────────────────────────────────
  function importarJSON(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.nodos) onNodosChange(data.nodos)
        if (data.aristas) onAristasChange(data.aristas)
        alert(`Importado: ${data.nodos?.length||0} nodos, ${data.aristas?.length||0} aristas`)
      } catch { alert('El archivo no es un JSON válido.') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function exportarJSON() {
    const blob = new Blob([JSON.stringify({ nodos, aristas }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'red_acuicola.json'
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  const nodosFiltrados = nodos.filter(n =>
    !filtro || n.id.toLowerCase().includes(filtro.toLowerCase()) ||
    n.nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
    n.tipo?.toLowerCase().includes(filtro.toLowerCase())
  )
  const aristasFiltradas = aristas.filter(a =>
    !filtro || (a.origen||a.id_origen||'').toLowerCase().includes(filtro.toLowerCase()) ||
    (a.destino||a.id_destino||'').toLowerCase().includes(filtro.toLowerCase())
  )

  // ── Resumen superior ──────────────────────────────────────────────────────
  const ofertaTotal  = nodos.filter(n=>n.tipo==='origen').reduce((s,n)=>s+Number(n.oferta||0),0)
  const demandaTotal = nodos.filter(n=>n.tipo==='destino').reduce((s,n)=>s+Number(n.demanda||0),0)

  return (
    <div className="vista-datos">
      {/* ── Resumen rápido ─────────────────────────────────────────────── */}
      <div className="datos-resumen">
        <div className="resumen-chip blue">🏭 {nodos.filter(n=>n.tipo==='origen').length} estaciones</div>
        <div className="resumen-chip amber">🏢 {nodos.filter(n=>n.tipo==='acopio').length} acopios</div>
        <div className="resumen-chip green">🛒 {nodos.filter(n=>n.tipo==='destino').length} supermercados</div>
        <div className="resumen-chip gray">🔗 {aristas.length} rutas</div>
        <div className="resumen-chip blue">📦 Oferta: {ofertaTotal} ton</div>
        <div className="resumen-chip green">📦 Demanda: {demandaTotal} ton</div>
        <div className={`resumen-chip ${sincronizado ? 'green' : 'red'}`}>
          {sincronizado ? '✓ Datos en sistema' : '⚠ Pendiente de aplicar'}
        </div>
      </div>

      {/* ── Barra de acciones ─────────────────────────────────────────── */}
      <div className="datos-toolbar">
        <div className="toolbar-izq">
          <button className="btn-toolbar btn-defecto" onClick={onCargarDefecto} disabled={cargando}>
            ↺ Red predeterminada
          </button>
          <button className="btn-toolbar" onClick={() => fileRef.current.click()}>
            ⬆ Importar JSON
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{display:'none'}} onChange={importarJSON} />
          <button className="btn-toolbar" onClick={exportarJSON}>
            ⬇ Exportar JSON
          </button>
        </div>
        <button className="btn-aplicar" onClick={onAplicar} disabled={cargando || sincronizado}>
          {cargando ? '⏳ Aplicando...' : '▶ Aplicar al sistema'}
        </button>
      </div>

      {/* ── Tabs Nodos / Aristas ───────────────────────────────────────── */}
      <div className="datos-tabs-bar">
        <button className={`datos-tab ${tab==='nodos' ? 'activo':''}`} onClick={()=>setTab('nodos')}>
          Nodos ({nodos.length})
        </button>
        <button className={`datos-tab ${tab==='aristas' ? 'activo':''}`} onClick={()=>setTab('aristas')}>
          Aristas / Rutas ({aristas.length})
        </button>

        <div className="tabs-buscador">
          <input
            type="text"
            placeholder="Buscar..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
          />
          {filtro && <button onClick={() => setFiltro('')}>✕</button>}
        </div>

        <button
          className="btn-agregar"
          onClick={() => setModal({ tipo: tab === 'nodos' ? 'nodo-nuevo' : 'arista-nueva' })}
        >
          + Agregar {tab === 'nodos' ? 'nodo' : 'ruta'}
        </button>
      </div>

      {/* ── Tabla de nodos ────────────────────────────────────────────── */}
      {tab === 'nodos' && (
        <div className="tabla-wrapper">
          <table className="tabla-datos">
            <thead>
              <tr>
                <th>ID</th><th>Nombre</th><th>Tipo</th><th>Municipio</th>
                <th>Lat</th><th>Lng</th><th>Cap (ton)</th>
                <th>Oferta</th><th>Demanda</th>
                <th>Merma %</th><th>Calidad %</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {nodosFiltrados.map(n => {
                const badge = TIPO_BADGE[n.tipo] || {}
                return (
                  <tr key={n.id}>
                    <td><code className="cod-id">{n.id}</code></td>
                    <td className="td-nombre">{n.nombre}</td>
                    <td>
                      <span className="tipo-badge" style={{background: badge.bg, color: badge.color}}>
                        {badge.txt || n.tipo}
                      </span>
                    </td>
                    <td>{n.municipio}</td>
                    <td className="td-num">{Number(n.lat||n.latitud||0).toFixed(4)}</td>
                    <td className="td-num">{Number(n.lng||n.longitud||0).toFixed(4)}</td>
                    <td className="td-num">{n.capacidad}</td>
                    <td className="td-num">{n.tipo==='origen'  ? n.oferta  : '—'}</td>
                    <td className="td-num">{n.tipo==='destino' ? n.demanda : '—'}</td>
                    <td className="td-num">{n.tipo==='acopio'  ? ((n.tasa_merma||0)*100).toFixed(1)+'%' : '—'}</td>
                    <td className="td-num">{n.tipo==='acopio'  ? ((n.tasa_calidad??1)*100).toFixed(0)+'%' : '—'}</td>
                    <td className="td-acciones">
                      <button className="btn-tabla-edit" onClick={() => setModal({ tipo:'nodo-editar', datos: n })}>✏</button>
                      <button className="btn-tabla-del"  onClick={() => eliminarNodo(n.id)}>🗑</button>
                    </td>
                  </tr>
                )
              })}
              {nodosFiltrados.length === 0 && (
                <tr><td colSpan={12} className="td-vacio">No hay nodos. Agrega uno o carga la red predeterminada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tabla de aristas ──────────────────────────────────────────── */}
      {tab === 'aristas' && (
        <div className="tabla-wrapper">
          <table className="tabla-datos">
            <thead>
              <tr>
                <th>Origen</th><th>Destino</th>
                <th>Costo ($/ton)</th><th>Capacidad (ton)</th>
                <th>Distancia (km)</th><th>Estado</th>
                <th>Flujo actual</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {aristasFiltradas.map((a, idx) => {
                const orig = a.origen || a.id_origen || ''
                const dest = a.destino || a.id_destino || ''
                const nOrig = nodos.find(n => n.id === orig)
                const nDest = nodos.find(n => n.id === dest)
                return (
                  <tr key={idx}>
                    <td>
                      <code className="cod-id">{orig}</code>
                      <span className="td-nombre-small"> {nOrig?.nombre}</span>
                    </td>
                    <td>
                      <code className="cod-id">{dest}</code>
                      <span className="td-nombre-small"> {nDest?.nombre}</span>
                    </td>
                    <td className="td-num">${Number(a.costo||a.costo_transporte||0).toFixed(2)}</td>
                    <td className="td-num">{a.capacidad}</td>
                    <td className="td-num">{a.distancia} km</td>
                    <td>
                      <span className={`estado-badge ${a.estado === 'bloqueada' ? 'bloqueada' : 'activa'}`}>
                        {a.estado || 'activa'}
                      </span>
                    </td>
                    <td className="td-num">
                      {a.flujo > 0 ? (
                        <span>
                          {Number(a.flujo||0).toFixed(1)} ton
                          <span className="utilizacion"> ({((a.utilizacion||0)*100).toFixed(0)}%)</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="td-acciones">
                      <button className="btn-tabla-edit" onClick={() => setModal({ tipo:'arista-editar', datos:a, idx })}>✏</button>
                      <button className="btn-tabla-del"  onClick={() => eliminarArista(idx)}>🗑</button>
                    </td>
                  </tr>
                )
              })}
              {aristasFiltradas.length === 0 && (
                <tr><td colSpan={8} className="td-vacio">No hay rutas. Agrega una o carga la red predeterminada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modales ───────────────────────────────────────────────────── */}
      {modal?.tipo === 'nodo-nuevo' && (
        <Modal titulo="Agregar nodo" onClose={() => setModal(null)}>
          <FormNodo inicial={null} onGuardar={agregarNodo} onCerrar={() => setModal(null)}
            idsExistentes={nodos.map(n => n.id)} />
        </Modal>
      )}
      {modal?.tipo === 'nodo-editar' && (
        <Modal titulo={`Editar nodo ${modal.datos.id}`} onClose={() => setModal(null)}>
          <FormNodo inicial={modal.datos} onGuardar={editarNodo} onCerrar={() => setModal(null)}
            idsExistentes={[]} />
        </Modal>
      )}
      {modal?.tipo === 'arista-nueva' && (
        <Modal titulo="Agregar ruta" onClose={() => setModal(null)}>
          <FormArista inicial={null} onGuardar={agregarArista} onCerrar={() => setModal(null)} nodos={nodos} />
        </Modal>
      )}
      {modal?.tipo === 'arista-editar' && (
        <Modal titulo="Editar ruta" onClose={() => setModal(null)}>
          <FormArista inicial={modal.datos} onGuardar={d => editarArista(d, modal.idx)}
            onCerrar={() => setModal(null)} nodos={nodos} />
        </Modal>
      )}
    </div>
  )
}
