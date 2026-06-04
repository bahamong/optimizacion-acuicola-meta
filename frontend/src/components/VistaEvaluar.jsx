// Archivo: frontend/src/components/VistaEvaluar.jsx
import { useState } from 'react'
import {
  FaMapMarkedAlt, FaWater, FaBolt, FaSearch, FaPlay, FaChartBar,
  FaCheckCircle, FaExclamationTriangle, FaTimesCircle,
  FaFlask, FaRobot, FaPlus, FaTrash, FaGasPump, FaRoad, FaIndustry,
  FaArrowUp, FaArrowDown, FaDna,
} from 'react-icons/fa'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import * as api from '../services/api.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

function SelectorNodo({ label, valor, onChange, nodos, excluir = '', requerido = false, tipos = ['origen', 'acopio', 'destino'], placeholder = '— Seleccionar nodo —' }) {
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
        <option value="">{placeholder}</option>
        {tipos.includes('origen') && origenes.length > 0 && (
          <optgroup label="Estaciones de Origen">
            {origenes.filter(n => n.id !== excluir).map(n => (
              <option key={n.id} value={n.id}>{n.id} — {n.nombre}</option>
            ))}
          </optgroup>
        )}
        {tipos.includes('acopio') && acopios.length > 0 && (
          <optgroup label="Centros de Acopio">
            {acopios.filter(n => n.id !== excluir).map(n => (
              <option key={n.id} value={n.id}>{n.id} — {n.nombre}</option>
            ))}
          </optgroup>
        )}
        {tipos.includes('destino') && destinos.length > 0 && (
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
        <FaTimesCircle /> {resultado.error || 'No existe una cadena Origen → Acopio → Destino hacia ese supermercado.'}
      </div>
    )
  }
  const getNombre = id => nodos.find(n => n.id === id)?.nombre || id
  return (
    <div className="mt-4 flex flex-col gap-4">
      {(resultado.origen_optimo || resultado.acopio_intermedio) && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Cadena seleccionada</span>
          <span className="text-slate-700">
            <strong>Origen:</strong> {resultado.origen_optimo} — {getNombre(resultado.origen_optimo)}
          </span>
          <span className="text-slate-700">
            <strong>Acopio:</strong> {resultado.acopio_intermedio} — {getNombre(resultado.acopio_intermedio)}
          </span>
          <span className="text-slate-700">
            <strong>Destino:</strong> {resultado.destino} — {resultado.nombre_destino || getNombre(resultado.destino)}
          </span>
          {resultado.algoritmo && (
            <span className="ml-auto px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-semibold">
              {resultado.algoritmo}
            </span>
          )}
        </div>
      )}
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

function ResultadoFlujo({ resultado, onVerEnMapa }) {
  if (!resultado) return null
  const flujosTotales = resultado.detalle_flujos?.filter(f => f.flujo > 0) || []
  const cuello = resultado.cuello_botella
  const clavesFlujo = flujosTotales.map(f => `${f.origen}→${f.destino}`)
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
      {clavesFlujo.length > 0 && onVerEnMapa && (
        <button className="self-start flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          onClick={() => onVerEnMapa(clavesFlujo)}>
          <FaMapMarkedAlt /> Ver en el mapa
        </button>
      )}
    </div>
  )
}

function DetalleViolaciones({ validacion, metodo }) {
  const vDemanda  = validacion?.violaciones_demanda || []
  const vOferta   = validacion?.violaciones_oferta || []
  const vCapacidad = validacion?.violaciones_capacidad || []
  const vBalance  = validacion?.violaciones_balance || []
  const deficitTotal = validacion?.deficit_total ?? vDemanda.reduce((s, v) => s + (v.deficit || 0), 0)

  return (
    <div className="rounded-lg px-4 py-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 flex flex-col gap-2">
      <div className="flex items-center gap-2 font-semibold">
        <FaExclamationTriangle /> Hay violaciones de restricciones
      </div>

      {vDemanda.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-700">
            Demanda no cubierta ({deficitTotal.toFixed(1)} ton en total):
          </p>
          <ul className="mt-1 ml-4 list-disc text-xs text-amber-700">
            {vDemanda.slice(0, 6).map((v, i) => (
              <li key={i}>
                <strong>{v.nombre || v.nodo}</strong>: recibió {Number(v.recibido).toFixed(1)} de {Number(v.demanda).toFixed(1)} ton (faltan {Number(v.deficit).toFixed(1)} ton)
              </li>
            ))}
            {vDemanda.length > 6 && <li>… y {vDemanda.length - 6} destino(s) más</li>}
          </ul>
        </div>
      )}

      {vOferta.length > 0 && (
        <p className="text-xs text-amber-700">⚠ Oferta excedida en {vOferta.length} origen(es).</p>
      )}
      {vCapacidad.length > 0 && (
        <p className="text-xs text-amber-700">⚠ Capacidad superada en {vCapacidad.length} ruta(s).</p>
      )}
      {vBalance.length > 0 && (
        <p className="text-xs text-amber-700">⚠ Desbalance en {vBalance.length} acopio(s).</p>
      )}

      {vDemanda.length > 0 && vOferta.length === 0 && vCapacidad.length === 0 && vBalance.length === 0 && (
        <p className="text-xs text-amber-600 border-t border-amber-200 pt-2">
          {metodo === 'genetico'
            ? 'El Algoritmo Genético es un método aproximado: puede dejar un déficit pequeño que el método exacto (Programación Lineal) sí llena. Si con ese método el déficit desaparece, la red sí puede cubrir la demanda. Si persiste en ambos, la oferta o las capacidades no alcanzan.'
            : 'La oferta total o las capacidades de las rutas no alcanzan para cubrir toda la demanda solicitada.'}
        </p>
      )}
    </div>
  )
}

const METODOS_OPT = [
  {
    id: 'lineal',
    label: 'Programación Lineal',
    desc: 'Modelo de transporte con transbordo (solver exacto PuLP/CBC).',
    Icono: FaBolt,
  },
  {
    id: 'genetico',
    label: 'Algoritmo Genético',
    desc: 'Metaheurística evolutiva (selección, cruce y mutación).',
    Icono: FaFlask,
  },
]

function ModeloLineal({ resultados }) {
  if (resultados.num_variables == null) return null
  const fmt = n => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })
  const optimo = (resultados.estado_lp || '').toLowerCase() === 'optimal'

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <FaBolt className="text-indigo-600" />
        <h4 className="text-sm font-bold text-slate-800">Modelo de Programación Lineal — Transporte con Transbordo</h4>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        {resultados.modelo_lp || 'Estación → Acopio → … → Supermercado'}. El producto puede pasar por uno o
        varios acopios encadenados (transbordo). El solver halla cuántas toneladas enviar por cada ruta para
        maximizar la ganancia (cubrir la mayor demanda posible al menor costo de transporte).
      </p>

      {/* Estado del solver */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`rounded-lg border p-3 ${optimo ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className="text-xs text-slate-500">Estado del solver</p>
          <p className={`text-base font-bold ${optimo ? 'text-emerald-700' : 'text-amber-700'}`}>
            {optimo ? 'Óptimo encontrado' : (resultados.estado_lp || '—')}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Variables de decisión</p>
          <p className="text-base font-bold text-slate-800">{resultados.num_variables}</p>
          <p className="text-[0.7rem] text-slate-400">
            {resultados.num_rutas_oa ?? '—'} estación→acopio
            {resultados.num_rutas_aa > 0 && ` · ${resultados.num_rutas_aa} acopio→acopio`}
            {' '}· {resultados.num_rutas_ad ?? '—'} acopio→super
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Restricciones</p>
          <p className="text-base font-bold text-slate-800">{resultados.num_restricciones}</p>
          <p className="text-[0.7rem] text-slate-400">oferta · capacidad · demanda · transbordo</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Valor objetivo</p>
          <p className="text-base font-bold text-indigo-700">${fmt(resultados.valor_objetivo)}</p>
          <p className="text-[0.7rem] text-slate-400">función a maximizar</p>
        </div>
      </div>

      {/* Formulación */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex flex-col gap-1">
        <p className="font-semibold text-slate-700">Formulación del modelo</p>
        <p><strong>Variable:</strong> f[u,v] = toneladas enviadas por la ruta u → v (estación→acopio, acopio→acopio o acopio→supermercado)</p>
        <p><strong>Objetivo:</strong> maximizar ingreso por demanda cubierta − costo de transporte (distancia × toneladas)</p>
        <p className="mt-1 font-semibold text-slate-700">Restricciones</p>
        <ol className="ml-4 list-decimal space-y-0.5">
          <li>Cada estación no envía más de su oferta.</li>
          <li>Cada acopio no recibe más de su capacidad.</li>
          <li>Cada supermercado no recibe más de su demanda.</li>
          <li>Transbordo: lo que entra a un acopio = lo que sale (la merma reduce su capacidad de despacho).</li>
          <li>Todo pasa por al menos un acopio (no se permite estación → supermercado directo).</li>
        </ol>
      </div>
    </div>
  )
}

function EvolucionGenetica({ resultados }) {
  const historia = resultados?.historia_generaciones || []
  const params = resultados?.parametros_ag
  if (historia.length === 0) return null

  const fmt = n => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })
  const inicial = resultados.fitness_inicial ?? historia[0]?.mejor ?? 0
  const final = resultados.fitness_final ?? historia[historia.length - 1]?.mejor ?? 0
  const mejora = final - inicial
  const genConverge = (() => {
    // Primera generación cuyo mejor global ya iguala al fitness final.
    const idx = historia.findIndex(h => Math.abs(h.mejor_global - final) < 1e-6)
    return idx >= 0 ? historia[idx].generacion : historia[historia.length - 1].generacion
  })()

  const labels = historia.map(h => h.generacion)
  const data = {
    labels,
    datasets: [
      {
        label: 'Mejor (élite)',
        data: historia.map(h => h.mejor_global),
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22,163,74,0.12)',
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'Promedio población',
        data: historia.map(h => h.promedio),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.08)',
        fill: false,
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'Peor',
        data: historia.map(h => h.peor),
        borderColor: '#f59e0b',
        borderDash: [4, 4],
        fill: false,
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 1.5,
      },
    ],
  }
  const opciones = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          title: items => `Generación ${items[0].label}`,
          label: ctx => `${ctx.dataset.label}: $${fmt(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { title: { display: true, text: 'Generación', font: { size: 11 } }, ticks: { maxTicksLimit: 12, font: { size: 10 } } },
      y: { title: { display: true, text: 'Ganancia (fitness)', font: { size: 11 } }, ticks: { font: { size: 10 }, callback: v => '$' + fmt(v) } },
    },
  }

  // Muestreo del registro para no listar cientos de filas.
  const paso = Math.max(1, Math.ceil(historia.length / 18))
  const filas = historia.filter((_, i) => i % paso === 0)
  if (filas[filas.length - 1] !== historia[historia.length - 1]) filas.push(historia[historia.length - 1])

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <FaDna className="text-emerald-600" />
        <h4 className="text-sm font-bold text-slate-800">Proceso evolutivo del Algoritmo Genético</h4>
      </div>

      {/* Resumen del proceso */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Generaciones</p>
          <p className="text-lg font-bold text-slate-800">{resultados.generaciones_ejecutadas ?? historia.length - 1}</p>
          <p className="text-[0.7rem] text-slate-400">convergió en la gen. {genConverge}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Fitness inicial</p>
          <p className="text-lg font-bold text-slate-700">${fmt(inicial)}</p>
          <p className="text-[0.7rem] text-slate-400">mejor de la gen. 0</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs text-slate-500">Fitness final</p>
          <p className="text-lg font-bold text-emerald-700">${fmt(final)}</p>
          <p className="text-[0.7rem] text-emerald-500">mejor solución hallada</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Mejora total</p>
          <p className={`text-lg font-bold ${mejora >= 0 ? 'text-green-600' : 'text-red-600'}`}>{mejora >= 0 ? '+' : ''}${fmt(mejora)}</p>
          <p className="text-[0.7rem] text-slate-400">{resultados.num_caminos ?? '—'} caminos O→A→D</p>
        </div>
      </div>

      {/* Parámetros del AG */}
      {params && (
        <div className="flex flex-wrap gap-2 text-[0.7rem]">
          {[
            ['Población', params.tam_poblacion],
            ['Gen. máx.', params.generaciones_max],
            ['Prob. cruce', `${Math.round(params.prob_cruce * 100)}%`],
            ['Prob. mutación', `${Math.round(params.prob_mutacion * 100)}%`],
            ['Élite', params.num_elite],
            ['Torneo', params.tam_torneo],
          ].map(([k, v]) => (
            <span key={k} className="px-2 py-1 rounded bg-slate-100 text-slate-600">
              <strong className="text-slate-700">{k}:</strong> {v}
            </span>
          ))}
        </div>
      )}

      {/* Curva de convergencia */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2">Curva de convergencia (ganancia por generación)</p>
        <div className="h-64">
          <Line data={data} options={opciones} />
        </div>
      </div>

      {/* Registro de generaciones */}
      <div className="overflow-x-auto">
        <p className="text-xs font-semibold text-slate-500 mb-2">Registro del proceso (muestreado)</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100">
              {['Gen.', 'Mejor', 'Promedio', 'Peor', 'Diversidad'].map(h => (
                <th key={h} className="text-left px-3 py-2 text-slate-600 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const convergida = f.diversidad < 1e-6
              return (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-mono text-slate-500">{f.generacion}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-700">${fmt(f.mejor)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-indigo-600">${fmt(f.promedio)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-amber-600">${fmt(f.peor)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <span className={`px-2 py-0.5 rounded text-[0.65rem] font-semibold ${convergida ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {convergida ? 'convergida' : `$${fmt(f.diversidad)}`}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PanelOptimizacion({ resultados, metricas, onOptimizar, sincronizado, cargando, msgCarga }) {
  const [metodo, setMetodo] = useState('lineal')
  const metodoSel = METODOS_OPT.find(m => m.id === metodo) || METODOS_OPT[0]

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 mb-2">Optimización de la Red</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Asigna los flujos x<sub>ij</sub> que maximizan la ganancia respetando la oferta, la demanda y la capacidad de cada arista, sobre la cadena Origen → Acopio → Destino. Elige el método de resolución:
          </p>
        </div>

        {/* Selector de método */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {METODOS_OPT.map(m => {
            const activo = metodo === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetodo(m.id)}
                disabled={cargando}
                className={`text-left flex items-start gap-3 rounded-xl border p-3 transition-all
                  ${activo ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-slate-200 bg-white hover:border-slate-300'}
                  ${cargando ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <m.Icono className={`mt-0.5 ${activo ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="flex flex-col">
                  <span className={`text-sm font-bold ${activo ? 'text-indigo-700' : 'text-slate-700'}`}>{m.label}</span>
                  <span className="text-xs text-slate-500">{m.desc}</span>
                </span>
              </button>
            )
          })}
        </div>

        {!sincronizado && (
          <p className="text-sm text-amber-600 flex items-center gap-1">
            <FaExclamationTriangle /> Aplica los datos al sistema primero (pestaña Datos de la Red).
          </p>
        )}

        <button
          className={`self-start flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all
            ${cargando || !sincronizado ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'}`}
          onClick={() => onOptimizar(metodo)}
          disabled={cargando || !sincronizado}
        >
          {cargando
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{msgCarga || 'Procesando...'}</>
            : <><FaPlay /> Ejecutar con {metodoSel.label}</>}
        </button>
      </div>

      {resultados && (
        <>
          {(resultados.algoritmo || resultados.metodo) && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-2 text-sm text-indigo-700">
              {(resultados.metodo === 'genetico') ? <FaFlask /> : <FaBolt />}
              <span>Resultado obtenido con <strong>{resultados.algoritmo || (resultados.metodo === 'genetico' ? 'Algoritmo Genético' : 'Programación Lineal (Transbordo)')}</strong></span>
              {resultados.metodo === 'genetico' && resultados.generaciones_ejecutadas != null && (
                <span className="ml-auto text-xs font-normal text-indigo-500">
                  Convergió en {resultados.generaciones_ejecutadas} generaciones
                </span>
              )}
            </div>
          )}
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
            resultados.restricciones_validas ? (
              <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium bg-green-50 border border-green-200 text-green-700">
                <FaCheckCircle /> Todas las restricciones se cumplen
              </div>
            ) : (
              <DetalleViolaciones validacion={resultados.validacion} metodo={resultados.metodo} />
            )
          )}

          {/* Modelo de programación lineal (solo Programación Lineal) */}
          {resultados.metodo === 'lineal' && <ModeloLineal resultados={resultados} />}

          {/* Proceso evolutivo (solo Algoritmo Genético) */}
          {resultados.metodo === 'genetico' && <EvolucionGenetica resultados={resultados} />}

          {/* Detalle de la lógica de acopios: calidad, merma y costo de operación */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <p className="text-xs text-slate-500 mb-1">Acopios activos</p>
              <p className="text-lg font-bold text-slate-800">
                {resultados.acopios_activos?.length ?? 0}
              </p>
              {resultados.acopios_activos?.length > 0 && (
                <p className="text-[0.7rem] text-slate-400 mt-1 break-words">{resultados.acopios_activos.join(', ')}</p>
              )}
            </div>
            <div className={`border rounded-xl p-4 bg-white ${resultados.acopios_penalizados?.length > 0 ? 'border-amber-300' : 'border-slate-200'}`}>
              <p className="text-xs text-slate-500 mb-1">Penalizados por calidad</p>
              <p className={`text-lg font-bold ${resultados.acopios_penalizados?.length > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {resultados.acopios_penalizados?.length ?? 0}
              </p>
              {resultados.acopios_penalizados?.length > 0 && (
                <p className="text-[0.7rem] text-amber-500 mt-1 break-words">{resultados.acopios_penalizados.join(', ')} (calidad &lt; 50%)</p>
              )}
            </div>
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <p className="text-xs text-slate-500 mb-1">Merma estimada</p>
              <p className="text-lg font-bold text-rose-600">{Number(resultados.merma_total_estimada || 0).toFixed(2)} ton</p>
              <p className="text-[0.7rem] text-slate-400 mt-1">pérdida en acopios</p>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <p className="text-xs text-slate-500 mb-1">Costo operación acopios</p>
              <p className="text-lg font-bold text-slate-800">${Number(resultados.costo_operacion_acopios || 0).toLocaleString('es-CO',{maximumFractionDigits:0})}</p>
              <p className="text-[0.7rem] text-slate-400 mt-1">descontado de la ganancia</p>
            </div>
          </div>

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

            {resultados.rutas_activas_detalle?.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
                <h4 className="text-sm font-bold text-slate-700 mb-3">Rutas activas</h4>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50"><th className="p-2 text-left">Origen</th><th className="p-2 text-left">Destino</th><th className="p-2 text-right">Flujo (ton)</th></tr></thead>
                  <tbody>
                    {resultados.rutas_activas_detalle.slice(0,15).map((r,i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="p-2 font-mono">{r.origen}</td><td className="p-2 font-mono">{r.destino}</td>
                        <td className="p-2 text-right font-mono">{Number(r.flujo).toFixed(2)}</td>
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
          <p className="text-sm">Ejecuta la optimización para ver ganancia, flujos y rutas activas.</p>
          <p className="text-xs text-slate-300">Programación lineal o algoritmo genético sobre la red completa.</p>
        </div>
      )}
    </div>
  )
}

function PanelEscenarios({ nodos, grafo, resultados, onVerFlujoEnMapa }) {
  const acopios = nodos.filter(n => n.tipo === 'acopio')
  const aristas = grafo?.aristas || []
  const departamentos = [...new Set(nodos.map(n => n.departamento).filter(Boolean))]
  const nombreNodo = id => nodos.find(n => n.id === id)?.nombre || id

  const [nombre,    setNombre]    = useState('Escenario personalizado')
  const [combActivo, setCombActivo] = useState(false)
  const [combPct,   setCombPct]   = useState(15)
  const [combDepto, setCombDepto] = useState('Meta')
  const [vias,      setVias]      = useState([])   // [{id_origen, id_destino}]
  const [fallos,    setFallos]    = useState([])   // [{id_acopio, tasa_calidad_nueva}]

  const [resultado, setResultado] = useState(null)
  const [error,     setError]     = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [iaTexto,   setIaTexto]   = useState(null)
  const [iaError,   setIaError]   = useState(null)
  const [iaLoad,    setIaLoad]    = useState(false)

  const sinOptimizar = !resultados

  const agregarVia   = () => setVias(v => [...v, { id_origen: '', id_destino: '' }])
  const quitarVia    = i => setVias(v => v.filter((_, j) => j !== i))
  const setVia       = (i, key) => setVias(v => v.map((x, j) => {
    if (j !== i) return x
    const [id_origen, id_destino] = key.split('→')
    return { id_origen, id_destino }
  })
  )
  const agregarFallo = () => setFallos(f => [...f, { id_acopio: '', tasa_calidad_nueva: 0.2 }])
  const quitarFallo  = i => setFallos(f => f.filter((_, j) => j !== i))
  const setFallo     = (i, campo, val) => setFallos(f => f.map((x, j) => j === i ? { ...x, [campo]: val } : x))

  const hayCondicion = combActivo || vias.some(v => v.id_origen) || fallos.some(f => f.id_acopio)

  async function ejecutar() {
    if (!hayCondicion) { setError('Activa al menos una condición (combustible, vía cerrada o fallo de calidad).'); return }
    try {
      setLoading(true); setError(null); setResultado(null); setIaTexto(null); setIaError(null)
      const params = {
        nombre,
        combustible_activo: combActivo,
        combustible_pct: Number(combPct),
        combustible_departamento: combDepto,
        vias_cerradas: vias.filter(v => v.id_origen && v.id_destino),
        fallos_calidad: fallos.filter(f => f.id_acopio).map(f => ({ id_acopio: f.id_acopio, tasa_calidad_nueva: Number(f.tasa_calidad_nueva) })),
      }
      const res = await api.sensibilidadCombinado(params)
      setResultado(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al ejecutar el escenario.')
    } finally { setLoading(false) }
  }

  async function analizarIA() {
    if (!resultado) return
    try {
      setIaLoad(true); setIaError(null); setIaTexto(null)
      const res = await api.analisisIaEscenario(resultado)
      setIaTexto(res.data?.interpretacion || '')
    } catch (e) {
      setIaError(e.response?.data?.detail || 'Error al generar el análisis de IA.')
    } finally { setIaLoad(false) }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold text-slate-800">Escenarios What-If — Análisis de Sensibilidad</h2>
        <p className="text-sm text-slate-500 mt-1">Combina varias condiciones (combustible caro, vías cerradas y fallos de calidad), re-optimiza la red y mide el impacto en la ganancia.</p>
      </div>

      {sinOptimizar && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          <FaExclamationTriangle /> Ejecuta primero la <strong>Optimización</strong> para que el impacto se compare contra la ganancia base real.
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-600">Nombre del escenario</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      </div>

      {/* Condición 1: combustible */}
      <div className={`border rounded-lg p-3 flex flex-col gap-3 ${combActivo ? 'border-orange-300 bg-orange-50/40' : 'border-slate-200'}`}>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
          <input type="checkbox" checked={combActivo} onChange={e => setCombActivo(e.target.checked)} className="accent-orange-500" />
          <FaGasPump className="text-orange-500" /> Aumento de combustible
        </label>
        {combActivo && (
          <div className="flex flex-wrap items-end gap-3 pl-6">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Aumento (%)</label>
              <input type="number" min="0" step="1" value={combPct} onChange={e => setCombPct(e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm w-28" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Departamento afectado</label>
              <select value={combDepto} onChange={e => setCombDepto(e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white">
                {!departamentos.includes(combDepto) && <option value={combDepto}>{combDepto}</option>}
                {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Condición 2: vías cerradas */}
      <div className="border border-slate-200 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FaRoad className="text-slate-500" /> Vías cerradas</span>
          <button onClick={agregarVia} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"><FaPlus /> Agregar</button>
        </div>
        {vias.length === 0 && <p className="text-xs text-slate-400 pl-6">Ninguna vía cerrada.</p>}
        {vias.map((v, i) => (
          <div key={i} className="flex items-center gap-2 pl-6">
            <select value={v.id_origen && v.id_destino ? `${v.id_origen}→${v.id_destino}` : ''} onChange={e => setVia(i, e.target.value)}
              className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">
              <option value="">— Seleccionar ruta —</option>
              {aristas.map(a => {
                const k = `${a.origen}→${a.destino}`
                return <option key={k} value={k}>{a.origen} → {a.destino} ({nombreNodo(a.origen)} → {nombreNodo(a.destino)})</option>
              })}
            </select>
            <button onClick={() => quitarVia(i)} className="text-red-500 hover:text-red-700 p-1"><FaTrash /></button>
          </div>
        ))}
      </div>

      {/* Condición 3: fallos de calidad */}
      <div className="border border-slate-200 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FaIndustry className="text-slate-500" /> Fallos de calidad en acopios</span>
          <button onClick={agregarFallo} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"><FaPlus /> Agregar</button>
        </div>
        {fallos.length === 0 && <p className="text-xs text-slate-400 pl-6">Ningún fallo de calidad.</p>}
        {fallos.map((f, i) => (
          <div key={i} className="flex items-center gap-2 pl-6">
            <select value={f.id_acopio} onChange={e => setFallo(i, 'id_acopio', e.target.value)}
              className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">
              <option value="">— Seleccionar acopio —</option>
              {acopios.map(a => <option key={a.id} value={a.id}>{a.id} — {a.nombre}</option>)}
            </select>
            <div className="flex flex-col items-center">
              <span className="text-[0.65rem] text-slate-500">calidad → {Math.round(Number(f.tasa_calidad_nueva) * 100)}%</span>
              <input type="range" min="0" max="1" step="0.05" value={f.tasa_calidad_nueva}
                onChange={e => setFallo(i, 'tasa_calidad_nueva', e.target.value)} className="w-28 accent-rose-500" />
            </div>
            <button onClick={() => quitarFallo(i)} className="text-red-500 hover:text-red-700 p-1"><FaTrash /></button>
          </div>
        ))}
      </div>

      <button onClick={ejecutar} disabled={loading || !hayCondicion}
        className={`self-start flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors
          ${loading || !hayCondicion ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
        {loading ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Ejecutando...</> : <><FaFlask /> Ejecutar escenario</>}
      </button>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

      {resultado && <ResultadoEscenario resultado={resultado} onAnalizarIA={analizarIA} iaTexto={iaTexto} iaError={iaError} iaLoad={iaLoad}
        onVerFlujoEnMapa={onVerFlujoEnMapa} />}
    </div>
  )
}

function ResultadoEscenario({ resultado, onAnalizarIA, iaTexto, iaError, iaLoad, onVerFlujoEnMapa }) {
  const neg = resultado.evaluacion === 'NEGATIVO'
  const rutasOpt = resultado.resultado_optimizacion?.grafo?.num_rutas_activas
  const flujosOpt = resultado.resultado_optimizacion?.grafo?.flujos || {}

  return (
    <div className="mt-1 flex flex-col gap-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <span className="text-xs text-slate-500">Ganancia base</span>
          <p className="text-base font-bold text-slate-700">${Number(resultado.ganancia_base).toLocaleString('es-CO',{maximumFractionDigits:0})}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <span className="text-xs text-slate-500">Ganancia escenario</span>
          <p className="text-base font-bold text-slate-700">${Number(resultado.ganancia_escenario).toLocaleString('es-CO',{maximumFractionDigits:0})}</p>
        </div>
        <div className={`rounded-lg border p-3 ${neg ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <span className="text-xs text-slate-500">Impacto</span>
          <p className={`text-base font-bold flex items-center gap-1 ${neg ? 'text-red-600' : 'text-green-600'}`}>
            {neg ? <FaArrowDown /> : <FaArrowUp />}${Math.abs(Number(resultado.impacto_absoluto)).toLocaleString('es-CO',{maximumFractionDigits:0})}
          </p>
        </div>
        <div className={`rounded-lg border p-3 ${neg ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <span className="text-xs text-slate-500">Variación</span>
          <p className={`text-base font-bold ${neg ? 'text-red-600' : 'text-green-600'}`}>{Number(resultado.impacto_porcentual).toFixed(2)}%</p>
        </div>
      </div>

      <div className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${neg ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
        {neg ? <FaArrowDown /> : <FaArrowUp />} Evaluación: {resultado.evaluacion}
        {rutasOpt != null && <span className="ml-auto text-xs font-normal text-slate-500">{rutasOpt} rutas activas tras re-optimizar</span>}
      </div>

      {/* Cambios aplicados */}
      {resultado.cambios_aplicados?.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-500 mb-2">Condiciones aplicadas</p>
          <div className="flex flex-col gap-2">
            {resultado.cambios_aplicados.map((c, i) => (
              <div key={i} className="text-xs text-slate-700">
                {c.tipo === 'combustible' && (
                  <span><FaGasPump className="inline text-orange-500 mr-1" /><strong>Combustible:</strong> {c.descripcion} — {c.rutas_afectadas?.length || 0} rutas afectadas</span>
                )}
                {c.tipo === 'via_cerrada' && (
                  <span><FaRoad className="inline text-slate-500 mr-1" /><strong>Vía cerrada:</strong> {c.arista?.ruta} (cap. {c.arista?.capacidad} ton)</span>
                )}
                {c.tipo === 'fallo_calidad' && (
                  <span><FaIndustry className="inline text-rose-500 mr-1" /><strong>Calidad:</strong> {c.acopio} {Math.round((c.calidad_anterior ?? 0)*100)}% → {Math.round((c.calidad_nueva ?? 0)*100)}% (merma {Math.round((c.merma_nueva ?? 0)*100)}%)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {Object.keys(flujosOpt).length > 0 && onVerFlujoEnMapa && (
          <button onClick={() => onVerFlujoEnMapa(Object.keys(flujosOpt))}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            <FaMapMarkedAlt /> Ver flujos resultantes en el mapa
          </button>
        )}
        <button onClick={onAnalizarIA} disabled={iaLoad}
          className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors ${iaLoad ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}>
          {iaLoad ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analizando...</> : <><FaRobot /> Analizar con IA</>}
        </button>
      </div>

      {iaError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{iaError}</div>}
      {iaTexto && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-violet-600 mb-2 uppercase tracking-wide"><FaRobot /> Análisis del consultor IA</p>
          <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{iaTexto}</p>
        </div>
      )}
    </div>
  )
}

const SUB_ANALISIS = [
  { id: 'ruta',      Icono: FaMapMarkedAlt, label: 'Ruta Óptima',  desc: 'Dijkstra — menor costo' },
  { id: 'flujo',     Icono: FaWater,        label: 'Flujo Máximo', desc: 'Ford-Fulkerson — cuello de botella' },
  { id: 'optimizar', Icono: FaBolt,         label: 'Optimización', desc: 'Programación lineal o algoritmo genético' },
  { id: 'escenarios',Icono: FaFlask,        label: 'Escenarios',   desc: 'What-If — análisis de sensibilidad' },
]

export default function VistaEvaluar({
  nodos, grafo, metricas, resultados,
  onOptimizar, onVerEnMapa, onVerFlujoEnMapa,
  sincronizado, cargando, msgCarga,
}) {
  const [subVista,      setSubVista]      = useState('ruta')
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
    if (!rutaDestino) return
    try {
      setLoadRuta(true); setErrorRuta(null); setResultRuta(null)
      const res = await api.rutaOptima(rutaDestino)
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
            <h2 className="text-base font-bold text-slate-800">Cadena Óptima — Origen → Acopio → Destino</h2>
            <p className="text-sm text-slate-500 mt-1">Elige un supermercado destino: el sistema encuentra automáticamente el mejor origen y centro de acopio intermedio (menor costo de transporte $/ton).</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <SelectorNodo
              label="Supermercado destino"
              valor={rutaDestino}
              onChange={v => { setRutaDestino(v); setResultRuta(null) }}
              nodos={nodos}
              tipos={['destino']}
              placeholder="— Seleccionar destino —"
              requerido
            />
            <button
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                ${!rutaDestino || loadRuta || sinDatos ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
              onClick={calcularRuta}
              disabled={!rutaDestino || loadRuta || sinDatos}
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
          <ResultadoFlujo resultado={resultFlujo} onVerEnMapa={onVerFlujoEnMapa} />
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

      {/* Escenarios What-If */}
      {subVista === 'escenarios' && (
        <PanelEscenarios
          nodos={nodos} grafo={grafo} resultados={resultados}
          onVerFlujoEnMapa={onVerFlujoEnMapa}
        />
      )}
    </div>
  )
}
