/**
 * VistaEvaluar — sección de análisis interactivos de la red logística.
 *
 * Sub-análisis disponibles:
 *  1. Ruta Óptima (Dijkstra)    — selecciona origen y destino, calcula menor costo
 *  2. Flujo Máximo (Ford-Fulkerson) — selecciona fuente y sumidero, detecta cuello de botella
 *  3. Optimización (AG + Gradiente) — optimización completa de rutas y flujos
 */

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
import './VistaEvaluar.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

// ── Selector de nodos agrupado por tipo ───────────────────────────────────────
function SelectorNodo({ label, valor, onChange, nodos, excluir = '', requerido = false }) {
  const origenes  = nodos.filter(n => n.tipo === 'origen')
  const acopios   = nodos.filter(n => n.tipo === 'acopio')
  const destinos  = nodos.filter(n => n.tipo === 'destino')

  return (
    <div className="ev-campo">
      <label>{label}{requerido && ' *'}</label>
      <select value={valor} onChange={e => onChange(e.target.value)}>
        <option value="">— Seleccionar nodo —</option>
        {origenes.length > 0 && (
          <optgroup label="Estaciones de Origen">
            {origenes.filter(n => n.id !== excluir).map(n => (
              <option key={n.id} value={n.id}>{n.id} — {n.nombre} ({n.municipio})</option>
            ))}
          </optgroup>
        )}
        {acopios.length > 0 && (
          <optgroup label="Centros de Acopio">
            {acopios.filter(n => n.id !== excluir).map(n => (
              <option key={n.id} value={n.id}>{n.id} — {n.nombre} ({n.municipio})</option>
            ))}
          </optgroup>
        )}
        {destinos.length > 0 && (
          <optgroup label="Supermercados / Destinos">
            {destinos.filter(n => n.id !== excluir).map(n => (
              <option key={n.id} value={n.id}>{n.id} — {n.nombre} ({n.municipio})</option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  )
}

// ── Resultado Ruta Óptima ─────────────────────────────────────────────────────
function ResultadoRuta({ resultado, nodos, onVerEnMapa }) {
  if (!resultado) return null

  if (!resultado.existe) {
    return (
      <div className="ev-no-ruta">
        <FaTimesCircle /> No existe ruta entre los nodos seleccionados con la red actual.
      </div>
    )
  }

  const getNombre = id => nodos.find(n => n.id === id)?.nombre || id

  return (
    <div className="ev-resultado-ruta">
      {/* Cabecera con KPIs */}
      <div className="ev-ruta-kpis">
        <div className="ev-kpi green">
          <span className="ev-kpi-label">Costo total</span>
          <span className="ev-kpi-valor">${resultado.costo_total?.toFixed(2)}<span className="ev-kpi-unit">/ton</span></span>
        </div>
        <div className="ev-kpi blue">
          <span className="ev-kpi-label">Saltos (nodos intermedios)</span>
          <span className="ev-kpi-valor">{resultado.saltos}</span>
        </div>
        <div className="ev-kpi purple">
          <span className="ev-kpi-label">Distancia total</span>
          <span className="ev-kpi-valor">
            {resultado.detalle?.reduce((s, d) => s + (d.distancia_km || 0), 0).toFixed(0)}
            <span className="ev-kpi-unit"> km</span>
          </span>
        </div>
      </div>

      {/* Visualización del camino */}
      <div className="ev-ruta-path">
        <span className="ev-path-label">Ruta óptima:</span>
        <div className="ev-path-nodos">
          {resultado.ruta.map((id, idx) => (
            <span key={id} className="ev-path-item">
              <span className={`ev-path-nodo tipo-${nodos.find(n=>n.id===id)?.tipo}`}>
                <strong>{id}</strong>
                <small>{getNombre(id)}</small>
              </span>
              {idx < resultado.ruta.length - 1 && (
                <span className="ev-path-flecha">→</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Tabla de tramos */}
      {resultado.detalle?.length > 0 && (
        <div className="ev-tabla-tramos">
          <h4 className="ev-subtitulo">Detalle por tramo</h4>
          <table className="ev-tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Desde</th>
                <th>Hasta</th>
                <th>Costo ($/ton)</th>
                <th>Distancia</th>
                <th>Capacidad</th>
              </tr>
            </thead>
            <tbody>
              {resultado.detalle.map((tramo, i) => (
                <tr key={i}>
                  <td className="td-c">{i + 1}</td>
                  <td>
                    <code>{tramo.de}</code>
                    <span className="td-nombre"> {tramo.nombre_de}</span>
                  </td>
                  <td>
                    <code>{tramo.a}</code>
                    <span className="td-nombre"> {tramo.nombre_a}</span>
                  </td>
                  <td className="td-r">${tramo.costo_unitario?.toFixed(2)}</td>
                  <td className="td-r">{tramo.distancia_km?.toFixed(0)} km</td>
                  <td className="td-r">{tramo.capacidad} ton</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className="ev-btn-mapa" onClick={() => onVerEnMapa(resultado.ruta)}>
        <FaMapMarkedAlt /> Ver esta ruta en el mapa
      </button>
    </div>
  )
}

// ── Resultado Flujo Máximo ────────────────────────────────────────────────────
function ResultadoFlujo({ resultado }) {
  if (!resultado) return null

  const cuello = resultado.cuello_botella
  const flujosTotales = resultado.detalle_flujos?.filter(f => f.flujo > 0) || []

  return (
    <div className="ev-resultado-flujo">
      <div className="ev-ruta-kpis">
        <div className="ev-kpi blue">
          <span className="ev-kpi-label">Flujo máximo posible</span>
          <span className="ev-kpi-valor">{resultado.flujo_maximo?.toFixed(2)}<span className="ev-kpi-unit"> ton</span></span>
        </div>
        {cuello?.origen && (
          <div className="ev-kpi red">
            <span className="ev-kpi-label">Cuello de botella</span>
            <span className="ev-kpi-valor" style={{fontSize:'0.95rem'}}>
              {cuello.nombre_origen || cuello.origen} → {cuello.nombre_destino || cuello.destino}
            </span>
          </div>
        )}
      </div>

      {flujosTotales.length > 0 && (
        <div className="ev-tabla-tramos">
          <h4 className="ev-subtitulo">Distribución de flujo en rutas activas</h4>
          <table className="ev-tabla">
            <thead>
              <tr>
                <th>Origen</th><th>Destino</th>
                <th>Flujo (ton)</th><th>Capacidad</th><th>Utilización</th>
              </tr>
            </thead>
            <tbody>
              {flujosTotales
                .sort((a, b) => b.flujo - a.flujo)
                .slice(0, 20)
                .map((f, i) => (
                  <tr key={i}>
                    <td><code>{f.origen}</code></td>
                    <td><code>{f.destino}</code></td>
                    <td className="td-r">{f.flujo.toFixed(2)}</td>
                    <td className="td-r">{f.capacidad}</td>
                    <td className="td-r">
                      <span className={`util-badge ${
                        f.utilizacion >= 0.85 ? 'rojo' :
                        f.utilizacion >= 0.6  ? 'amber' : 'verde'
                      }`}>
                        {(f.utilizacion * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Optimización AG + Gradiente ───────────────────────────────────────────────
function PanelOptimizacion({ resultados, metricas, onOptimizar, sincronizado, cargando, msgCarga }) {
  return (
    <div className="ev-opt-wrapper">
      {/* Descripción y botón */}
      <div className="ev-opt-header">
        <div className="ev-opt-desc">
          <h3 className="ev-opt-titulo">Optimización Híbrida de la Red</h3>
          <p>
            <strong>Paso 1 — Algoritmo Genético:</strong> cromosoma binario y<sub>ij</sub> ∈ {'{0,1}'}
            determina qué rutas activar. Población 60, generaciones 150, selección por torneo.<br />
            <strong>Paso 2 — Gradiente (SLSQP):</strong> dado el conjunto de rutas activas,
            optimiza los flujos continuos x<sub>ij</sub> y stocks s<sub>j</sub> minimizando
            costo de transporte + almacenamiento + mermas, respetando oferta, demanda y capacidades.
          </p>
          {!sincronizado && (
            <p className="ev-aviso"><FaExclamationTriangle /> Aplica los datos al sistema primero (pestaña Datos de la Red).</p>
          )}
        </div>
        <button
          className="ev-btn-optimizar"
          onClick={onOptimizar}
          disabled={cargando || !sincronizado}
        >
          {cargando
            ? <><span className="spinner-btn" />{msgCarga || 'Procesando...'}</>
            : <><FaPlay /> Ejecutar optimización</>}
        </button>
      </div>

      {/* Resultados */}
      {resultados && (
        <>
          {/* KPIs */}
          <div className="ev-opt-kpis">
            {[
              { label:'Ganancia total',     val:`$${Number(resultados.ganancia||0).toLocaleString('es-CO',{maximumFractionDigits:0})}`, color:'#22c55e' },
              { label:'Costo total',        val:`$${Number(resultados.costo_total||0).toLocaleString('es-CO',{maximumFractionDigits:0})}`, color:'#ef4444' },
              { label:'Demanda cubierta',   val:`${Number(resultados.demanda_cumplida_pct||0).toFixed(1)}%`, color: resultados.demanda_cumplida_pct>=90?'#22c55e':'#f59e0b' },
              { label:'Rutas activas',      val:`${resultados.rutas_activas||'—'} / ${metricas?.aristas_totales||'?'}`, color:'#6366f1' },
            ].map(k => (
              <div key={k.label} className="ev-opt-kpi" style={{borderTopColor: k.color}}>
                <p className="ev-opt-kpi-label">{k.label}</p>
                <p className="ev-opt-kpi-valor">{k.val}</p>
              </div>
            ))}
          </div>

          {/* Estado de restricciones */}
          {resultados.validacion && (
            <div className={`ev-validacion ${resultados.validacion.total_violaciones===0?'ok':'warn'}`}>
              {resultados.validacion.total_violaciones === 0
                ? <><FaCheckCircle /> Todas las restricciones se cumplen (oferta, demanda, capacidad, calidad)</>
                : <><FaExclamationTriangle /> {resultados.validacion.total_violaciones} violación(es) — déficit: {resultados.validacion.deficit_total?.toFixed(2)} ton</>
              }
            </div>
          )}

          {/* Gráfico convergencia AG */}
          {resultados.historialAG?.length > 0 && (
            <div className="ev-grafico">
              <h4 className="ev-subtitulo">Convergencia del Algoritmo Genético</h4>
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
                  plugins: { legend:{display:false}, tooltip:{callbacks:{label:c=>`$${c.parsed.y.toLocaleString('es-CO',{maximumFractionDigits:0})}`}} },
                  scales: {
                    x: { grid:{display:false}, ticks:{maxTicksLimit:10,font:{size:11}} },
                    y: { grid:{color:'#f1f5f9'}, ticks:{font:{size:11},callback:v=>`$${(v/1000).toFixed(0)}K`} },
                  },
                }}
              />
            </div>
          )}

          {/* Tablas de flujos y rutas AG */}
          <div className="ev-opt-dos-col">
            {resultados.flujos && (() => {
              const filas = Object.entries(resultados.flujos).filter(([,v])=>v>0.01).sort(([,a],[,b])=>b-a)
              return filas.length > 0 ? (
                <div className="ev-tabla-tramos">
                  <h4 className="ev-subtitulo">Flujos óptimos asignados</h4>
                  <table className="ev-tabla">
                    <thead><tr><th>Ruta</th><th>Flujo (ton)</th></tr></thead>
                    <tbody>
                      {filas.slice(0,15).map(([ruta,flujo]) => (
                        <tr key={ruta}><td>{ruta}</td><td className="td-r">{Number(flujo).toFixed(2)}</td></tr>
                      ))}
                      {filas.length > 15 && (
                        <tr><td colSpan={2} className="td-mas">...y {filas.length-15} rutas más</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null
            })()}

            {resultados.rutas_ag?.length > 0 && (
              <div className="ev-tabla-tramos">
                <h4 className="ev-subtitulo">Rutas activas seleccionadas por el AG</h4>
                <table className="ev-tabla">
                  <thead><tr><th>Origen</th><th>Destino</th><th>Costo $/ton</th><th>Cap ton</th></tr></thead>
                  <tbody>
                    {resultados.rutas_ag.slice(0,15).map((r,i) => (
                      <tr key={i}>
                        <td>{r.origen}</td><td>{r.destino}</td>
                        <td className="td-r">${r.costo}</td>
                        <td className="td-r">{r.capacidad}</td>
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
        <div className="ev-placeholder">
          <p className="ev-placeholder-icon"><FaChartBar /></p>
          <p>Ejecuta la optimización para ver ganancia, flujos óptimos y convergencia del AG.</p>
          <p className="ev-placeholder-sub">Tiempo estimado: 20–40 segundos con la red completa (41 nodos).</p>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
const SUB_ANALISIS = [
  { id: 'ruta',      Icono: FaMapMarkedAlt, label: 'Ruta Óptima',  desc: 'Dijkstra — menor costo entre dos nodos' },
  { id: 'flujo',     Icono: FaWater,        label: 'Flujo Máximo', desc: 'Ford-Fulkerson — cuello de botella' },
  { id: 'optimizar', Icono: FaBolt,         label: 'Optimización', desc: 'AG + Gradiente — optimización completa' },
]

export default function VistaEvaluar({
  nodos, grafo, metricas, resultados,
  onOptimizar, onVerEnMapa,
  sincronizado, cargando, msgCarga,
}) {
  const [subVista, setSubVista] = useState('ruta')

  // Estado Ruta Óptima
  const [rutaOrigen,   setRutaOrigen]   = useState('')
  const [rutaDestino,  setRutaDestino]  = useState('')
  const [resultRuta,   setResultRuta]   = useState(null)
  const [errorRuta,    setErrorRuta]    = useState(null)
  const [loadRuta,     setLoadRuta]     = useState(false)

  // Estado Flujo Máximo
  const [flujoFuente,  setFlujoFuente]  = useState('')
  const [flujoSumidero,setFlujoSumidero]= useState('')
  const [resultFlujo,  setResultFlujo]  = useState(null)
  const [errorFlujo,   setErrorFlujo]   = useState(null)
  const [loadFlujo,    setLoadFlujo]    = useState(false)

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
    <div className="vista-evaluar">
      {/* ── Selector de sub-análisis ──────────────────────────────────── */}
      <div className="ev-tabs">
        {SUB_ANALISIS.map(s => (
          <button
            key={s.id}
            className={`ev-tab ${subVista === s.id ? 'activo' : ''}`}
            onClick={() => setSubVista(s.id)}
          >
            <span className="ev-tab-icon"><s.Icono /></span>
            <span className="ev-tab-texto">
              <strong>{s.label}</strong>
              <small>{s.desc}</small>
            </span>
          </button>
        ))}
      </div>

      {sinDatos && (
        <div className="ev-aviso">
          <FaExclamationTriangle /> No hay datos cargados. Ve a <em>Datos de la Red</em> y aplica los datos al sistema primero.
        </div>
      )}

      {/* ── Sub-análisis 1: Ruta Óptima ──────────────────────────────── */}
      {subVista === 'ruta' && (
        <div className="ev-panel">
          <div className="ev-panel-header">
            <h2 className="ev-titulo">Ruta Óptima — Algoritmo de Dijkstra</h2>
            <p className="ev-desc">
              Calcula el camino de <strong>menor costo</strong> entre dos nodos de la red, considerando
              el costo de transporte ($/ton) en cada arista. Útil para determinar la ruta más eficiente
              desde una estación de producción hasta un supermercado específico.
            </p>
          </div>

          <div className="ev-form-row">
            <SelectorNodo
              label="Nodo de origen"
              valor={rutaOrigen}
              onChange={v => { setRutaOrigen(v); setResultRuta(null) }}
              nodos={nodos}
              excluir={rutaDestino}
              requerido
            />
            <div className="ev-flecha-central">→</div>
            <SelectorNodo
              label="Nodo de destino"
              valor={rutaDestino}
              onChange={v => { setRutaDestino(v); setResultRuta(null) }}
              nodos={nodos}
              excluir={rutaOrigen}
              requerido
            />
            <button
              className="ev-btn-calcular"
              onClick={calcularRuta}
              disabled={!rutaOrigen || !rutaDestino || loadRuta || sinDatos}
            >
              {loadRuta ? <><span className="spinner-btn" />Calculando...</> : <><FaSearch /> Calcular ruta</>}
            </button>
          </div>

          {errorRuta && <div className="ev-error">{errorRuta}</div>}
          <ResultadoRuta resultado={resultRuta} nodos={nodos} onVerEnMapa={onVerEnMapa} />
        </div>
      )}

      {/* ── Sub-análisis 2: Flujo Máximo ─────────────────────────────── */}
      {subVista === 'flujo' && (
        <div className="ev-panel">
          <div className="ev-panel-header">
            <h2 className="ev-titulo">Flujo Máximo — Algoritmo de Ford-Fulkerson (Edmonds-Karp)</h2>
            <p className="ev-desc">
              Determina la <strong>máxima cantidad de toneladas</strong> que pueden fluir entre un nodo
              fuente y un sumidero, respetando las capacidades de cada ruta. Identifica el
              <strong> cuello de botella</strong>: la arista que limita el flujo total de la red.
            </p>
          </div>

          <div className="ev-form-row">
            <SelectorNodo
              label="Nodo fuente (origen del flujo)"
              valor={flujoFuente}
              onChange={v => { setFlujoFuente(v); setResultFlujo(null) }}
              nodos={nodos}
              excluir={flujoSumidero}
              requerido
            />
            <div className="ev-flecha-central">→</div>
            <SelectorNodo
              label="Nodo sumidero (destino del flujo)"
              valor={flujoSumidero}
              onChange={v => { setFlujoSumidero(v); setResultFlujo(null) }}
              nodos={nodos}
              excluir={flujoFuente}
              requerido
            />
            <button
              className="ev-btn-calcular"
              onClick={calcularFlujo}
              disabled={!flujoFuente || !flujoSumidero || loadFlujo || sinDatos}
            >
              {loadFlujo ? <><span className="spinner-btn" />Calculando...</> : <><FaWater /> Calcular flujo</>}
            </button>
          </div>

          {errorFlujo && <div className="ev-error">{errorFlujo}</div>}
          <ResultadoFlujo resultado={resultFlujo} />
        </div>
      )}

      {/* ── Sub-análisis 3: Optimización ─────────────────────────────── */}
      {subVista === 'optimizar' && (
        <PanelOptimizacion
          resultados={resultados}
          metricas={metricas}
          onOptimizar={onOptimizar}
          sincronizado={sincronizado}
          cargando={cargando}
          msgCarga={msgCarga}
        />
      )}
    </div>
  )
}
