import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'
import './VistaOptimizacion.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

function KPI({ label, valor, sub, color = '#6366f1' }) {
  return (
    <div className="opt-kpi" style={{ borderTopColor: color }}>
      <p className="opt-kpi-label">{label}</p>
      <p className="opt-kpi-valor">{valor ?? '—'}</p>
      {sub && <p className="opt-kpi-sub">{sub}</p>}
    </div>
  )
}

function GraficoAG({ historial }) {
  if (!historial?.length) return null
  const data = {
    labels: historial.map((_, i) => `Gen ${i + 1}`),
    datasets: [{
      label: 'Mejor ganancia estimada ($)',
      data: historial,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.08)',
      fill: true, tension: 0.3,
      pointRadius: historial.length > 50 ? 0 : 3,
      borderWidth: 2,
    }],
  }
  return (
    <div className="opt-grafico">
      <h3 className="opt-section-title">Convergencia del Algoritmo Genético</h3>
      <Line data={data} options={{
        responsive: true, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => `$${c.parsed.y.toLocaleString('es-CO',{maximumFractionDigits:0})}` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 11 } } },
          y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, callback: v => `$${(v/1000).toFixed(0)}K` } }
        }
      }} />
    </div>
  )
}

function TablaFlujos({ flujos }) {
  if (!flujos) return null
  const filas = Object.entries(flujos).filter(([,v]) => v > 0.01).sort(([,a],[,b]) => b - a)
  if (!filas.length) return null
  return (
    <div className="opt-tabla-wrapper">
      <h3 className="opt-section-title">Flujos óptimos (rutas con flujo &gt; 0)</h3>
      <table className="opt-tabla">
        <thead><tr><th>Ruta</th><th>Flujo (ton)</th></tr></thead>
        <tbody>
          {filas.slice(0, 20).map(([ruta, flujo]) => (
            <tr key={ruta}>
              <td>{ruta}</td>
              <td className="td-r">{Number(flujo).toFixed(2)}</td>
            </tr>
          ))}
          {filas.length > 20 && (
            <tr><td colSpan={2} style={{color:'#94a3b8',textAlign:'center',fontStyle:'italic'}}>
              ... y {filas.length - 20} rutas más
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function EstadoValidacion({ validacion }) {
  if (!validacion) return null
  const total = validacion.total_violaciones || 0
  return (
    <div className={`validacion-box ${total === 0 ? 'ok' : 'warn'}`}>
      <strong>{total === 0 ? '✓ Todas las restricciones cumplidas' : `⚠ ${total} violaciones de restricciones`}</strong>
      {validacion.deficit_total > 0 && (
        <p>Déficit de demanda: {validacion.deficit_total.toFixed(2)} ton</p>
      )}
      {validacion.alertas_calidad?.length > 0 && (
        <p>Alertas de calidad: {validacion.alertas_calidad.map(a => a.nombre).join(', ')}</p>
      )}
    </div>
  )
}

export default function VistaOptimizacion({ metricas, resultados, onOptimizar, sincronizado, cargando, msgCarga }) {
  return (
    <div className="vista-opt">
      {/* Panel de ejecución */}
      <div className="opt-panel-control">
        <div className="opt-panel-texto">
          <h2 className="opt-panel-titulo">Optimización Híbrida</h2>
          <p className="opt-panel-desc">
            <strong>Paso 1 — Algoritmo Genético:</strong> Explora combinaciones de rutas activas (cromosoma binario y<sub>ij</sub>)
            para maximizar la ganancia. Población: 60 · Generaciones: 150.<br />
            <strong>Paso 2 — Gradiente (SLSQP):</strong> Dada la estructura del AG, optimiza los flujos exactos x<sub>ij</sub>
            y stocks s<sub>j</sub> minimizando el costo total respetando todas las restricciones.
          </p>
          {!sincronizado && (
            <p className="opt-aviso">⚠ Debes aplicar los datos al sistema primero (pestaña <em>Datos de la Red</em>).</p>
          )}
        </div>
        <button
          className="opt-btn-ejecutar"
          onClick={onOptimizar}
          disabled={cargando || !sincronizado}
        >
          {cargando ? (
            <><span className="spinner-btn" /> {msgCarga || 'Procesando...'}</>
          ) : '▶  Ejecutar optimización'}
        </button>
      </div>

      {/* KPIs del resultado */}
      {resultados && (
        <>
          <div className="opt-kpis">
            <KPI label="Ganancia total"
              valor={`$${Number(resultados.ganancia||0).toLocaleString('es-CO',{maximumFractionDigits:0})}`}
              color="#22c55e" />
            <KPI label="Costo total"
              valor={`$${Number(resultados.costo_total||0).toLocaleString('es-CO',{maximumFractionDigits:0})}`}
              color="#ef4444" />
            <KPI label="Demanda cubierta"
              valor={`${Number(resultados.demanda_cumplida_pct||0).toFixed(1)}%`}
              color={resultados.demanda_cumplida_pct >= 90 ? '#22c55e' : '#f59e0b'} />
            <KPI label="Rutas activas"
              valor={`${resultados.rutas_activas || '—'}`}
              sub={metricas ? `de ${metricas.aristas_totales} totales` : ''} />
          </div>

          <EstadoValidacion validacion={resultados.validacion} />
          <GraficoAG historial={resultados.historialAG} />

          <div className="opt-dos-col">
            <TablaFlujos flujos={resultados.flujos} />

            {resultados.rutas_ag?.length > 0 && (
              <div className="opt-tabla-wrapper">
                <h3 className="opt-section-title">Rutas seleccionadas por el AG</h3>
                <table className="opt-tabla">
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
        <div className="opt-placeholder">
          <p>Ejecuta la optimización para ver los resultados aquí.</p>
          <p className="opt-placeholder-sub">El proceso puede tardar 20-40 segundos con la red completa.</p>
        </div>
      )}
    </div>
  )
}
