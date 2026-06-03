// Archivo: frontend/src/components/VistaEvaluar.jsx
import { useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import {
  FaMapMarkedAlt, FaWater, FaBolt, FaSearch, FaPlay, FaChartBar,
  FaCheckCircle, FaExclamationTriangle, FaTimesCircle,
} from 'react-icons/fa'
import * as api from '../services/api.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

function SelectorNodo({ label, valor, onChange, nodos, excluir = '', requerido = false }) {
  const origenes = nodos.filter(n => n.tipo === 'origen')
  const acopios  = nodos.filter(n => n.tipo === 'acopio')
  const destinos = nodos.filter(n => n.tipo === 'destino')
  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      <label className="text-xs font-semibold text-slate-600">{label}{requerido && ' *'}</label>
      <select
        value={valor}
        onChange={e => onChange(e.target.value)}
        className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
      >
        <option value="">— Seleccionar nodo —</option>
        {origenes.length > 0 && (
          <optgroup label="Estaciones de Origen">
            {origenes.filter(n => n.id !== excluir).map(n => (
              <option key={n.id} value={n.id}>{n.id} — {n.nombre}</option>
            ))}
          </optgroup>
        )}
        {acopios.length > 0 && (
          <optgroup label="Centros de Acopio">
            {acopios.filter(n => n.id !== excluir).map(n => (
              <option key={n.id} value={n.id}>{n.id} — {n.nombre}</option>
            ))}
          </optgroup>
        )}
        {destinos.length > 0 && (
          <optgroup label="Supermercados">
            {destinos.filter(n => n.id !== excluir).map(n => (
              <option key={n.id} value={n.id}>{n.id} — {n.nombre}</option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  )
}

function ResultadoRuta({ resultado, nodos, onVerEnMapa }) {
  if (!resultado) return null
  if (!resultado.existe) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mt-4">
        <FaTimesCircle /> No existe ruta entre los nodos seleccionados.
      </div>
    )
  }
  const getNombre = id => nodos.find(n => n.id === id)?.nombre || id
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Costo total', val:`$${resultado.costo_total?.toFixed(2)}/ton`, color:'text-green-600', bg:'bg-green-50', border:'border-green-200' },
          { label:'Saltos', val:resultado.saltos, color:'text-blue-600', bg:'bg-blue-50', border:'border-blue-200' },
          { label:'Distancia', val:`${resultado.detalle?.reduce((s,d)=>s+(d.distancia_km||0),0).toFixed(0)} km`, color:'text-violet-600', bg:'bg-violet-50', border:'border-violet-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-lg border ${k.border} ${k.bg} p-3 flex flex-col gap-1`}>
            <span className="text-xs text-slate-500">{k.label}</span>
            <span className={`text-lg font-bold ${k.color}`}>{k.val}</span>
          </div>
        ))}
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <p className="text-xs font-semibold text-slate-500 mb-2">Ruta óptima:</p>
        <div className="flex flex-wrap items-center gap-1">
          {resultado.ruta.map((id, idx) => {
            const tipo = nodos.find(n => n.id === id)?.tipo
            return (
              <span key={id} className="flex items-center gap-1">
                <span className={`px-2 py-0.5 rounded text-xs font-bold
                  ${tipo === 'origen' ? 'bg-red-100 text-red-700' : tipo === 'acopio' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  <strong>{id}</strong> <small className="font-normal">{getNombre(id)}</small>
                </span>
                {idx < resultado.ruta.length - 1 && <span className="text-slate-400">→</span>}
              </span>
            )
          })}
        </div>
      </div>
      {resultado.detalle?.length > 0 && (
        <div className="overflow-x-auto">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Detalle por tramo</h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                {['#','Desde','Hasta','Costo $/ton','Distancia','Capacidad'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-slate-600 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultado.detalle.map((tramo, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-center text-slate-400">{i+1}</td>
                  <td className="px-3 py-2"><code className="bg-slate-100 px-1 rounded">{tramo.de}</code> {tramo.nombre_de}</td>
                  <td className="px-3 py-2"><code className="bg-slate-100 px-1 rounded">{tramo.a}</code> {tramo.nombre_a}</td>
                  <td className="px-3 py-2 text-right font-mono">${tramo.costo_unitario?.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono">{tramo.distancia_km?.toFixed(0)} km</td>
                  <td className="px-3 py-2 text-right font-mono">{tramo.capacidad} ton</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button className="self-start flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        onClick={() => onVerEnMapa(resultado.ruta)}>
        <FaMapMarkedAlt /> Ver en el mapa
      </button>
    </div>
  )
}

function ResultadoFlujo({ resultado }) {
  if (!resultado) return null
  const flujosTotales = resultado.detalle_flujos?.filter(f => f.flujo > 0) || []
  const cuello = resultado.cuello_botella
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <span className="text-xs text-slate-500">Flujo máximo posible</span>
          <p className="text-xl font-bold text-blue-600">{resultado.flujo_maximo?.toFixed(2)} ton</p>
        </div>
        {cuello?.origen && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <span className="text-xs text-slate-500">Cuello de botella</span>
            <p className="text-sm font-bold text-red-600">{cuello.nombre_origen || cuello.origen} → {cuello.nombre_destino || cuello.destino}</p>
          </div>
        )}
      </div>
      {flujosTotales.length > 0 && (
        <div className="overflow-x-auto">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Distribución de flujo</h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                {['Origen','Destino','Flujo','Capacidad','Utilización'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-slate-600 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flujosTotales.sort((a,b) => b.flujo - a.flujo).slice(0,20).map((f,i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2"><code className="bg-slate-100 px-1 rounded">{f.origen}</code></td>
                  <td className="px-3 py-2"><code className="bg-slate-100 px-1 rounded">{f.destino}</code></td>
                  <td className="px-3 py-2 text-right font-mono">{f.flujo.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono">{f.capacidad}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${f.utilizacion>=0.85?'bg-red-100 text-red-700':f.utilizacion>=0.6?'bg-amber-100 text-amber-700':'bg-green-100 text-green-700'}`}>
                      {(f.utilizacion*100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PanelOptimizacion({ resultados, metricas, onOptimizar, sincronizado, cargando, msgCarga }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-bold text-slate-800 mb-2">Optimización Híbrida de la Red</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong>Paso 1 — AG:</strong> cromosoma binario y<sub>ij</sub> ∈ {'{0,1}'} determina rutas activas. Población 60, 150 generaciones.<br />
            <strong>Paso 2 — Gradiente (SLSQP):</strong> optimiza flujos x<sub>ij</sub> y stocks s<sub>j</sub> minimizando costos respetando restricciones.
          </p>
          {!sincronizado && (
            <p className="mt-2 text-sm text-amber-600 flex items-center gap-1">
              <FaExclamationTriangle /> Aplica los datos al sistema primero (pestaña Datos de la Red).
            </p>
          )}
        </div>
        <button
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all flex-shrink-0
            ${cargando || !sincronizado ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'}`}
          onClick={onOptimizar}
          disabled={cargando || !sincronizado}
        >
          {cargando
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{msgCarga || 'Procesando...'}</>
            : <><FaPlay /> Ejecutar optimización</>}
        </button>
      </div>

      {resultados && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label:'Ganancia total',   val:`$${Number(resultados.ganancia||0).toLocaleString('es-CO',{maximumFractionDigits:0})}`, color:'border-t-green-500'  },
              { label:'Costo total',      val:`$${Number(resultados.costo_total||0).toLocaleString('es-CO',{maximumFractionDigits:0})}`, color:'border-t-red-400'    },
              { label:'Demanda cubierta', val:`${Number(resultados.demanda_cumplida_pct||0).toFixed(1)}%`, color: (resultados.demanda_cumplida_pct>=90?'border-t-green-500':'border-t-amber-500') },
              { label:'Rutas activas',    val:`${resultados.rutas_activas||'—'} / ${metricas?.aristas_totales||'?'}`, color:'border-t-indigo-500' },
            ].map(k => (
              <div key={k.label} className={`border border-slate-200 rounded-xl p-4 bg-white border-t-4 ${k.color}`}>
                <p className="text-xs text-slate-500 mb-1">{k.label}</p>
                <p className="text-xl font-bold text-slate-800">{k.val}</p>
              </div>
            ))}
          </div>

          {resultados.restricciones_validas !== undefined && (
            <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${resultados.restricciones_validas ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
              {resultados.restricciones_validas ? <><FaCheckCircle /> Todas las restricciones se cumplen</> : <><FaExclamationTriangle /> Hay violaciones de restricciones</>}
            </div>
          )}

          {resultados.historialAG?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">Convergencia del Algoritmo Genético</h4>
              <Line
                data={{
                  labels: resultados.historialAG.map((_, i) => `Gen ${i+1}`),
                  datasets: [{
                    data: resultados.historialAG,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99,102,241,0.07)',
                    fill: true, tension: 0.3, borderWidth: 2,
                    pointRadius: resultados.historialAG.length > 50 ? 0 : 3,
                  }],
                }}
                options={{
                  responsive: true, animation: false,
                  plugins: { legend:{display:false} },
                  scales: {
                    x: { grid:{display:false}, ticks:{maxTicksLimit:10,font:{size:11}} },
                    y: { grid:{color:'#f1f5f9'}, ticks:{font:{size:11},callback:v=>`$${(v/1000).toFixed(0)}K`} },
                  },
                }}
              />
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {resultados.flujos && (() => {
              const filas = Object.entries(resultados.flujos).filter(([,v])=>v>0.01).sort(([,a],[,b])=>b-a)
              return filas.length > 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
                  <h4 className="text-sm font-bold text-slate-700 mb-3">Flujos óptimos asignados</h4>
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50"><th className="text-left p-2">Ruta</th><th className="text-right p-2">Flujo (ton)</th></tr></thead>
                    <tbody>
                      {filas.slice(0,15).map(([ruta,flujo]) => (
                        <tr key={ruta} className="border-t border-slate-100">
                          <td className="p-2 font-mono text-xs">{ruta}</td>
                          <td className="p-2 text-right font-mono">{Number(flujo).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null
            })()}

            {resultados.rutas_ag?.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
                <h4 className="text-sm font-bold text-slate-700 mb-3">Rutas activas (AG)</h4>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50"><th className="p-2 text-left">Origen</th><th className="p-2 text-left">Destino</th><th className="p-2 text-right">$/ton</th><th className="p-2 text-right">Cap</th></tr></thead>
                  <tbody>
                    {resultados.rutas_ag.slice(0,15).map((r,i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="p-2 font-mono">{r.origen}</td><td className="p-2 font-mono">{r.destino}</td>
                        <td className="p-2 text-right">${r.costo}</td><td className="p-2 text-right">{r.capacidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!resultados && !cargando && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <FaChartBar className="text-5xl" />
          <p className="text-sm">Ejecuta la optimización para ver ganancia, flujos y convergencia del AG.</p>
          <p className="text-xs text-slate-300">Tiempo estimado: 20–40 segundos con la red completa.</p>
        </div>
      )}
    </div>
  )
}

const SUB_ANALISIS = [
  { id: 'ruta',      Icono: FaMapMarkedAlt, label: 'Ruta Óptima',  desc: 'Dijkstra — menor costo' },
  { id: 'flujo',     Icono: FaWater,        label: 'Flujo Máximo', desc: 'Ford-Fulkerson — cuello de botella' },
  { id: 'optimizar', Icono: FaBolt,         label: 'Optimización', desc: 'AG + Gradiente — red completa' },
]

export default function VistaEvaluar({
  nodos, grafo, metricas, resultados,
  onOptimizar, onVerEnMapa,
  sincronizado, cargando, msgCarga,
}) {
  const [subVista,      setSubVista]      = useState('ruta')
  const [rutaOrigen,    setRutaOrigen]    = useState('')
  const [rutaDestino,   setRutaDestino]   = useState('')
  const [resultRuta,    setResultRuta]    = useState(null)
  const [errorRuta,     setErrorRuta]     = useState(null)
  const [loadRuta,      setLoadRuta]      = useState(false)
  const [flujoFuente,   setFlujoFuente]   = useState('')
  const [flujoSumidero, setFlujoSumidero] = useState('')
  const [resultFlujo,   setResultFlujo]   = useState(null)
  const [errorFlujo,    setErrorFlujo]    = useState(null)
  const [loadFlujo,     setLoadFlujo]     = useState(false)

  async function calcularRuta() {
    if (!rutaOrigen || !rutaDestino) return
    if (rutaOrigen === rutaDestino) { setErrorRuta('Origen y destino deben ser distintos.'); return }
    try {
      setLoadRuta(true); setErrorRuta(null); setResultRuta(null)
      const res = await api.rutaOptima(rutaOrigen, rutaDestino)
      setResultRuta(res.data)
    } catch (e) {
      setErrorRuta(e.response?.data?.detail || 'Error al calcular la ruta.')
    } finally { setLoadRuta(false) }
  }

  async function calcularFlujo() {
    if (!flujoFuente || !flujoSumidero) return
    if (flujoFuente === flujoSumidero) { setErrorFlujo('Fuente y sumidero deben ser distintos.'); return }
    try {
      setLoadFlujo(true); setErrorFlujo(null); setResultFlujo(null)
      const res = await api.flujoMaximo(flujoFuente, flujoSumidero)
      setResultFlujo(res.data)
    } catch (e) {
      setErrorFlujo(e.response?.data?.detail || 'Error al calcular el flujo.')
    } finally { setLoadFlujo(false) }
  }

  const sinDatos = !nodos || nodos.length === 0

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
        {SUB_ANALISIS.map(s => (
          <button key={s.id}
            className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
              ${subVista === s.id ? 'bg-white text-slate-800 shadow font-semibold' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setSubVista(s.id)}>
            <s.Icono className={subVista === s.id ? 'text-indigo-500' : ''} />
            <span className="flex flex-col items-start text-left">
              <strong className="text-xs">{s.label}</strong>
              <small className="text-[0.65rem] font-normal text-slate-400">{s.desc}</small>
            </span>
          </button>
        ))}
      </div>

      {sinDatos && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          <FaExclamationTriangle /> No hay datos. Ve a <em>Datos de la Red</em> y crea nodos y rutas.
        </div>
      )}

      {/* Ruta óptima */}
      {subVista === 'ruta' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Ruta Óptima — Dijkstra</h2>
            <p className="text-sm text-slate-500 mt-1">Calcula el camino de menor costo de transporte ($/ton) entre dos nodos.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <SelectorNodo label="Nodo de origen" valor={rutaOrigen} onChange={v => { setRutaOrigen(v); setResultRuta(null) }} nodos={nodos} excluir={rutaDestino} requerido />
            <span className="text-slate-400 text-lg pb-2">→</span>
            <SelectorNodo label="Nodo de destino" valor={rutaDestino} onChange={v => { setRutaDestino(v); setResultRuta(null) }} nodos={nodos} excluir={rutaOrigen} requerido />
            <button
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                ${!rutaOrigen || !rutaDestino || loadRuta || sinDatos ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
              onClick={calcularRuta}
              disabled={!rutaOrigen || !rutaDestino || loadRuta || sinDatos}
            >
              {loadRuta ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Calculando...</> : <><FaSearch /> Calcular</>}
            </button>
          </div>
          {errorRuta && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{errorRuta}</div>}
          <ResultadoRuta resultado={resultRuta} nodos={nodos} onVerEnMapa={onVerEnMapa} />
        </div>
      )}

      {/* Flujo máximo */}
      {subVista === 'flujo' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Flujo Máximo — Ford-Fulkerson</h2>
            <p className="text-sm text-slate-500 mt-1">Máxima cantidad de toneladas entre fuente y sumidero, identificando el cuello de botella.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <SelectorNodo label="Nodo fuente" valor={flujoFuente} onChange={v => { setFlujoFuente(v); setResultFlujo(null) }} nodos={nodos} excluir={flujoSumidero} requerido />
            <span className="text-slate-400 text-lg pb-2">→</span>
            <SelectorNodo label="Nodo sumidero" valor={flujoSumidero} onChange={v => { setFlujoSumidero(v); setResultFlujo(null) }} nodos={nodos} excluir={flujoFuente} requerido />
            <button
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                ${!flujoFuente || !flujoSumidero || loadFlujo || sinDatos ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
              onClick={calcularFlujo}
              disabled={!flujoFuente || !flujoSumidero || loadFlujo || sinDatos}
            >
              {loadFlujo ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Calculando...</> : <><FaWater /> Calcular</>}
            </button>
          </div>
          {errorFlujo && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{errorFlujo}</div>}
          <ResultadoFlujo resultado={resultFlujo} />
        </div>
      )}

      {/* Optimización */}
      {subVista === 'optimizar' && (
        <PanelOptimizacion
          resultados={resultados} metricas={metricas}
          onOptimizar={onOptimizar} sincronizado={sincronizado}
          cargando={cargando} msgCarga={msgCarga}
        />
      )}
    </div>
  )
}
