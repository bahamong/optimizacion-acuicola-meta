import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import './ResultadosOptimizacion.css'

ChartJS.register(
  CategoryScale, LinearScale,
  PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler
)

// ── Gráfico de convergencia del AG ────────────────────────────────────────────
function GraficoConvergencia({ historial }) {
  if (!historial || historial.length === 0) return null
  const labels = historial.map((_, i) => `Gen ${i + 1}`)
  const data = {
    labels,
    datasets: [{
      label: 'Mejor fitness (ganancia estimada)',
      data: historial,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.08)',
      fill: true,
      tension: 0.3,
      pointRadius: historial.length > 50 ? 0 : 3,
      borderWidth: 2,
    }],
  }
  const opts = {
    responsive: true,
    animation: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Convergencia del Algoritmo Genético',
        font: { size: 13, weight: '600' },
        color: '#1e293b',
        padding: { bottom: 8 },
      },
      tooltip: {
        callbacks: {
          label: ctx => `$${ctx.parsed.y.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`,
        },
      },
    },
    scales: {
      x: { ticks: { maxTicksLimit: 10, font: { size: 11 } }, grid: { display: false } },
      y: {
        ticks: {
          font: { size: 11 },
          callback: v => `$${(v / 1000).toFixed(0)}K`,
        },
        grid: { color: '#f1f5f9' },
      },
    },
  }
  return <Line data={data} options={opts} />
}

// ── Gráfico comparativo de sensibilidad ──────────────────────────────────────
function GraficoSensibilidad({ gananciaBase, gananciaEscenario, descripcion }) {
  if (gananciaBase === undefined || gananciaEscenario === undefined) return null
  const data = {
    labels: ['Escenario base', 'Escenario analizado'],
    datasets: [{
      label: 'Ganancia ($)',
      data: [gananciaBase, gananciaEscenario],
      backgroundColor: [
        'rgba(99, 102, 241, 0.8)',
        gananciaEscenario >= gananciaBase ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)',
      ],
      borderRadius: 6,
    }],
  }
  const opts = {
    responsive: true,
    animation: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Impacto del escenario en la ganancia',
        font: { size: 13, weight: '600' },
        color: '#1e293b',
      },
      tooltip: {
        callbacks: {
          label: ctx => `$${ctx.parsed.y.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        ticks: { callback: v => `$${(v / 1000).toFixed(0)}K` },
        grid: { color: '#f1f5f9' },
      },
    },
  }
  return (
    <div className="grafico-wrapper">
      <p className="grafico-desc">{descripcion}</p>
      <Bar data={data} options={opts} />
    </div>
  )
}

// ── Tabla de flujos ───────────────────────────────────────────────────────────
function TablaFlujos({ flujos }) {
  if (!flujos || Object.keys(flujos).length === 0) return null
  const entradas = Object.entries(flujos)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
  return (
    <div className="tabla-wrapper">
      <h4 className="tabla-titulo">Rutas con mayor flujo</h4>
      <table className="tabla-flujos">
        <thead>
          <tr><th>Ruta</th><th>Flujo (ton)</th></tr>
        </thead>
        <tbody>
          {entradas.map(([ruta, flujo]) => (
            <tr key={ruta}>
              <td>{ruta}</td>
              <td className="td-num">{flujo.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ResultadosOptimizacion({ resultados, escenario }) {
  if (!resultados && !escenario) return null

  return (
    <div className="panel-resultados">
      <h2 className="panel-titulo">Resultados</h2>

      {/* Resultado de optimización */}
      {resultados && (
        <>
          <div className="resumen-grid">
            <div className="resumen-item">
              <span className="resumen-label">Estado</span>
              <span className={`resumen-badge ${resultados.estado === 'éxito' ? 'badge-ok' : 'badge-err'}`}>
                {resultados.estado}
              </span>
            </div>
            {resultados.ganancia !== undefined && (
              <div className="resumen-item">
                <span className="resumen-label">Ganancia</span>
                <span className="resumen-valor verde">
                  ${(resultados.ganancia).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
            {resultados.costo_total !== undefined && (
              <div className="resumen-item">
                <span className="resumen-label">Costo total</span>
                <span className="resumen-valor rojo">
                  ${(resultados.costo_total).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
            {resultados.demanda_cumplida_pct !== undefined && (
              <div className="resumen-item">
                <span className="resumen-label">Demanda cubierta</span>
                <span className={`resumen-valor ${resultados.demanda_cumplida_pct >= 90 ? 'verde' : 'naranja'}`}>
                  {resultados.demanda_cumplida_pct?.toFixed(1)}%
                </span>
              </div>
            )}
            {resultados.rutas_activas !== undefined && (
              <div className="resumen-item">
                <span className="resumen-label">Rutas activas</span>
                <span className="resumen-valor">{resultados.rutas_activas}</span>
              </div>
            )}
            {resultados.restricciones_validas !== undefined && (
              <div className="resumen-item">
                <span className="resumen-label">Restricciones</span>
                <span className={`resumen-badge ${resultados.restricciones_validas ? 'badge-ok' : 'badge-warn'}`}>
                  {resultados.restricciones_validas ? 'Válidas ✓' : 'Con violaciones'}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Gráfico de convergencia del AG (viene de /api/resultados) */}
      {resultados?.historialAG && resultados.historialAG.length > 0 && (
        <div className="grafico-wrapper">
          <GraficoConvergencia historial={resultados.historialAG} />
        </div>
      )}

      {/* Flujos óptimos */}
      {resultados?.flujos && (
        <TablaFlujos flujos={resultados.flujos} />
      )}

      {/* Análisis de sensibilidad */}
      {escenario && (
        <div className="escenario-resultado">
          <h3 className="escenario-titulo">
            {escenario.evaluacion === 'NEGATIVO' ? '⚠️' : '✅'} {escenario.descripcion}
          </h3>

          <div className="impacto-grid">
            <div className="impacto-item">
              <span className="impacto-label">Ganancia base</span>
              <span className="impacto-valor">
                ${(escenario.ganancia_base || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="impacto-item">
              <span className="impacto-label">Ganancia escenario</span>
              <span className={`impacto-valor ${(escenario.ganancia_escenario >= escenario.ganancia_base) ? 'verde' : 'rojo'}`}>
                ${(escenario.ganancia_escenario || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="impacto-item">
              <span className="impacto-label">Impacto</span>
              <span className={`impacto-valor grande ${escenario.impacto_absoluto >= 0 ? 'verde' : 'rojo'}`}>
                {escenario.impacto_absoluto >= 0 ? '+' : ''}
                ${(escenario.impacto_absoluto || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                {' '}({escenario.impacto_porcentual >= 0 ? '+' : ''}{escenario.impacto_porcentual?.toFixed(1)}%)
              </span>
            </div>
          </div>

          <GraficoSensibilidad
            gananciaBase={escenario.ganancia_base}
            gananciaEscenario={escenario.ganancia_escenario}
            descripcion=""
          />
        </div>
      )}
    </div>
  )
}
