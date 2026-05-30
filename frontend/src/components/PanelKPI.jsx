import './PanelKPI.css'

function KPICard({ titulo, valor, unidad = '', color = 'blue', icono }) {
  return (
    <div className={`kpi-card kpi-${color}`}>
      <div className="kpi-icono">{icono}</div>
      <div className="kpi-contenido">
        <p className="kpi-titulo">{titulo}</p>
        <p className="kpi-valor">
          {valor !== null && valor !== undefined ? valor : '—'}
          {unidad && <span className="kpi-unidad"> {unidad}</span>}
        </p>
      </div>
    </div>
  )
}

export default function PanelKPI({ metricas, resultado }) {
  if (!metricas) return null

  const ganancia = resultado?.ganancia ?? metricas.ganancia_total
  const costo    = resultado?.costo_total ?? metricas.costo_total
  const pctDem   = resultado?.demanda_cumplida_pct ?? metricas.porcentaje_demanda_cumplida
  const rutasAct = resultado?.rutas_activas

  return (
    <div className="panel-kpi">
      <h2 className="panel-titulo">Métricas de la Red</h2>

      <div className="kpi-seccion">
        <p className="kpi-seccion-label">Red logística</p>
        <div className="kpi-grid">
          <KPICard icono="📍" titulo="Nodos totales"  valor={metricas.nodos_totales} color="gray" />
          <KPICard icono="🏭" titulo="Estaciones"     valor={metricas.num_origenes}  color="red" />
          <KPICard icono="🏢" titulo="Acopios"        valor={metricas.num_acopios}   color="amber" />
          <KPICard icono="🛒" titulo="Supermercados"  valor={metricas.num_destinos}  color="green" />
          <KPICard icono="🔗" titulo="Rutas"          valor={metricas.aristas_totales} color="gray" />
          <KPICard icono="⚖️" titulo="Oferta total"  valor={metricas.oferta_total}  unidad="ton" color="blue" />
          <KPICard icono="📦" titulo="Demanda total"  valor={metricas.demanda_total} unidad="ton" color="blue" />
        </div>
      </div>

      {(ganancia !== undefined || costo !== undefined) && (
        <div className="kpi-seccion">
          <p className="kpi-seccion-label">Resultado de optimización</p>
          <div className="kpi-grid">
            {ganancia !== undefined && (
              <KPICard icono="💰" titulo="Ganancia"    valor={`$${(ganancia).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`} color="green" />
            )}
            {costo !== undefined && (
              <KPICard icono="💸" titulo="Costo total" valor={`$${(costo).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`}    color="red" />
            )}
            {pctDem !== undefined && (
              <KPICard icono="✅" titulo="Demanda cubierta" valor={`${pctDem?.toFixed(1)}%`} color={pctDem >= 90 ? 'green' : 'amber'} />
            )}
            {rutasAct !== undefined && (
              <KPICard icono="🚛" titulo="Rutas activas" valor={rutasAct} color="blue" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
