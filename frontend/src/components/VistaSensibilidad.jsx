import { useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import './VistaSensibilidad.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

function GraficoImpacto({ base, escenario, titulo }) {
  if (base === undefined || escenario === undefined) return null
  const positivo = escenario >= base
  const data = {
    labels: ['Escenario base', 'Escenario analizado'],
    datasets: [{
      data: [base, escenario],
      backgroundColor: ['rgba(99,102,241,0.8)', positivo ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)'],
      borderRadius: 6,
    }],
  }
  return (
    <div className="sens-grafico">
      <h4 className="sens-subtitulo">{titulo}</h4>
      <Bar data={data} options={{
        responsive: true, animation: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `$${c.parsed.y.toLocaleString('es-CO',{maximumFractionDigits:0})}` } } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#f1f5f9' }, ticks: { callback: v => `$${(v/1000).toFixed(0)}K` } }
        }
      }} />
    </div>
  )
}

function TarjetaImpacto({ resultado, titulo }) {
  if (!resultado) return null
  const negativo = resultado.impacto_absoluto < 0
  return (
    <div className={`sens-tarjeta ${negativo ? 'negativo' : 'positivo'}`}>
      <p className="sens-tarjeta-titulo">{titulo}</p>
      <p className="sens-desc">{resultado.descripcion}</p>
      <div className="sens-cifras">
        <div>
          <span className="sens-lbl">Ganancia base</span>
          <span className="sens-val">${Number(resultado.ganancia_base||0).toLocaleString('es-CO',{maximumFractionDigits:0})}</span>
        </div>
        <div>
          <span className="sens-lbl">Ganancia escenario</span>
          <span className={`sens-val ${negativo ? 'rojo' : 'verde'}`}>
            ${Number(resultado.ganancia_escenario||0).toLocaleString('es-CO',{maximumFractionDigits:0})}
          </span>
        </div>
        <div>
          <span className="sens-lbl">Impacto</span>
          <span className={`sens-val grande ${negativo ? 'rojo' : 'verde'}`}>
            {negativo ? '' : '+'}{Number(resultado.impacto_absoluto||0).toLocaleString('es-CO',{maximumFractionDigits:0})}
            &nbsp;({negativo ? '' : '+'}{Number(resultado.impacto_porcentual||0).toFixed(1)}%)
          </span>
        </div>
      </div>
    </div>
  )
}

export default function VistaSensibilidad({ grafo, resultados, escenario, onEjecutar, cargando, msgCarga }) {
  const [tipo,           setTipo]           = useState('combustible')
  const [pctCombustible, setPctCombustible] = useState(15)
  const [aristaOrig,     setAristaOrig]     = useState('')
  const [aristaDest,     setAristaDest]     = useState('')
  const [acopioId,       setAcopioId]       = useState('')
  const [pctCalidad,     setPctCalidad]     = useState(20)

  const nodos   = grafo?.nodos   || []
  const aristas = grafo?.aristas || []
  const acopios = nodos.filter(n => n.tipo === 'acopio')
  const origenes = [...new Set(aristas.map(a => a.origen || a.id_origen))]
  const destinosDeOrig = aristas.filter(a => (a.origen||a.id_origen) === aristaOrig).map(a => a.destino || a.id_destino)

  function getNombre(id) { return nodos.find(n => n.id === id)?.nombre || id }

  function ejecutar() {
    if (tipo === 'combustible') {
      onEjecutar('combustible', { porcentaje_aumento: pctCombustible })
    } else if (tipo === 'via_cerrada') {
      if (!aristaOrig || !aristaDest) return alert('Selecciona origen y destino de la vía.')
      onEjecutar('via_cerrada', { id_origen: aristaOrig, id_destino: aristaDest })
    } else if (tipo === 'calidad') {
      if (!acopioId) return alert('Selecciona el acopio afectado.')
      onEjecutar('calidad', { id_acopio: acopioId, tasa_calidad_nueva: pctCalidad / 100 })
    } else if (tipo === 'todos') {
      onEjecutar('todos', {})
    }
  }

  const sinOptimizacion = !resultados
  const gananciaBase = resultados?.ganancia || escenario?.ganancia_base

  // Si ejecutamos todos, el escenario trae 3 sub-resultados
  const esMultiple = escenario && ('escenario_1_combustible' in escenario)

  return (
    <div className="vista-sens">
      {sinOptimizacion && (
        <div className="sens-aviso">
          ℹ️ Debes ejecutar la <strong>optimización</strong> primero para tener una ganancia base de referencia.
        </div>
      )}

      {/* Panel de configuración */}
      <div className="sens-config">
        <h2 className="sens-titulo">Configurar escenario What-If</h2>

        <div className="sens-tipo-btns">
          {[
            { id:'combustible', ico:'⛽', label:'Combustible +%' },
            { id:'via_cerrada', ico:'🚧', label:'Cierre de vía' },
            { id:'calidad',     ico:'⚠️', label:'Fallo calidad' },
            { id:'todos',       ico:'🔬', label:'Los 3 a la vez' },
          ].map(t => (
            <button key={t.id} className={`tipo-btn ${tipo===t.id ? 'activo':''}`} onClick={() => setTipo(t.id)}>
              {t.ico} {t.label}
            </button>
          ))}
        </div>

        {/* Parámetros por escenario */}
        {tipo === 'combustible' && (
          <div className="sens-param">
            <label>Aumento de combustible: <strong>{pctCombustible}%</strong></label>
            <input type="range" min={5} max={50} step={5} value={pctCombustible}
              onChange={e => setPctCombustible(Number(e.target.value))} />
            <p className="sens-param-nota">Incrementa el costo de transporte en rutas del departamento del Meta.</p>
          </div>
        )}

        {tipo === 'via_cerrada' && (
          <div className="sens-param">
            <div className="sens-select-row">
              <div>
                <label>Nodo origen de la vía a cerrar</label>
                <select value={aristaOrig} onChange={e => { setAristaOrig(e.target.value); setAristaDest('') }}>
                  <option value="">— Seleccionar —</option>
                  {origenes.map(id => <option key={id} value={id}>{id} — {getNombre(id)}</option>)}
                </select>
              </div>
              <div>
                <label>Nodo destino</label>
                <select value={aristaDest} onChange={e => setAristaDest(e.target.value)} disabled={!aristaOrig}>
                  <option value="">— Seleccionar —</option>
                  {destinosDeOrig.map(id => <option key={id} value={id}>{id} — {getNombre(id)}</option>)}
                </select>
              </div>
            </div>
            <p className="sens-param-nota">La ruta seleccionada se bloquea y la red busca rutas alternativas.</p>
          </div>
        )}

        {tipo === 'calidad' && (
          <div className="sens-param">
            <div className="sens-select-row">
              <div>
                <label>Centro de acopio afectado</label>
                <select value={acopioId} onChange={e => setAcopioId(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {acopios.map(a => <option key={a.id} value={a.id}>{a.id} — {a.nombre}</option>)}
                </select>
              </div>
              <div>
                <label>Nueva tasa de calidad: <strong>{pctCalidad}%</strong></label>
                <input type="range" min={5} max={80} step={5} value={pctCalidad}
                  onChange={e => setPctCalidad(Number(e.target.value))} />
              </div>
            </div>
            <p className="sens-param-nota">{100 - pctCalidad}% de lotes rechazados → mayor merma y penalización en ese centro.</p>
          </div>
        )}

        {tipo === 'todos' && (
          <div className="sens-param">
            <p>Se ejecutarán automáticamente los 3 escenarios con parámetros estándar:<br />
              1. Combustible +15% en Meta<br />
              2. Cierre de la vía de mayor capacidad<br />
              3. Fallo de calidad (20%) en el acopio más crítico
            </p>
          </div>
        )}

        <button className="sens-btn-ejecutar" onClick={ejecutar} disabled={cargando}>
          {cargando
            ? <><span className="spinner-btn" /> {msgCarga || 'Analizando...'}</>
            : '🔍 Analizar escenario'}
        </button>
      </div>

      {/* Resultado: escenario único */}
      {escenario && !esMultiple && (
        <div className="sens-resultado">
          <TarjetaImpacto resultado={escenario} titulo="Resultado del análisis" />
          <GraficoImpacto
            base={escenario.ganancia_base}
            escenario={escenario.ganancia_escenario}
            titulo="Comparativa de ganancia"
          />
        </div>
      )}

      {/* Resultado: los 3 escenarios */}
      {esMultiple && (
        <div className="sens-multiple">
          <h3 className="sens-seccion-titulo">Comparativa de los 3 escenarios críticos</h3>
          <div className="sens-tres-col">
            <TarjetaImpacto resultado={escenario.escenario_1_combustible} titulo="Escenario 1 — Combustible +15%" />
            <TarjetaImpacto resultado={escenario.escenario_2_via_cerrada} titulo="Escenario 2 — Cierre de vía" />
            <TarjetaImpacto resultado={escenario.escenario_3_calidad}     titulo="Escenario 3 — Fallo calidad" />
          </div>
        </div>
      )}
    </div>
  )
}
