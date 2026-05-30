import { useState } from 'react'
import './ControladorEscenarios.css'

export default function ControladorEscenarios({
  onOptimizar,
  onSensibilidad,
  cargando,
  grafo,
  mensajeCarga,
}) {
  const [escenario, setEscenario] = useState('combustible')
  const [pctCombustible, setPctCombustible] = useState(15)

  // Para "vía cerrada": seleccionar una arista del grafo
  const aristas = grafo?.aristas || []
  const [aristaOrigen,  setAristaOrigen]  = useState('')
  const [aristaDestino, setAristaDestino] = useState('')

  // Para "calidad": seleccionar un acopio
  const acopios = (grafo?.nodos || []).filter(n => n.tipo === 'acopio')
  const [acopioId,      setAcopioId]      = useState('')
  const [pctCalidad,    setPctCalidad]    = useState(20)  // tasa_calidad_nueva = 0.20

  // Poblar destinos de la arista al cambiar origen
  const destinosDeOrigen = aristas
    .filter(a => a.origen === aristaOrigen)
    .map(a => a.destino)
    .filter((v, i, arr) => arr.indexOf(v) === i)

  const origenesUnicos = [...new Set(aristas.map(a => a.origen))]

  function getNombreNodo(id) {
    return grafo?.nodos?.find(n => n.id === id)?.nombre || id
  }

  async function handleSensibilidad() {
    if (escenario === 'combustible') {
      await onSensibilidad('combustible', { porcentaje_aumento: pctCombustible })
    } else if (escenario === 'via_cerrada') {
      if (!aristaOrigen || !aristaDestino) return alert('Selecciona origen y destino de la vía a cerrar.')
      await onSensibilidad('via_cerrada', { id_origen: aristaOrigen, id_destino: aristaDestino })
    } else if (escenario === 'calidad') {
      if (!acopioId) return alert('Selecciona el centro de acopio afectado.')
      await onSensibilidad('calidad', { id_acopio: acopioId, tasa_calidad_nueva: pctCalidad / 100 })
    }
  }

  return (
    <div className="panel-control">
      {/* Sección Optimización */}
      <section className="ctrl-seccion">
        <h3 className="ctrl-titulo">Optimización híbrida</h3>
        <p className="ctrl-desc">
          Ejecuta el <strong>Algoritmo Genético</strong> (selección de rutas) seguido del
          <strong> Método de Gradiente</strong> (ajuste fino de flujos). Puede tomar 20-40 seg.
        </p>
        <button
          className="btn btn-primary"
          onClick={onOptimizar}
          disabled={cargando}
        >
          {cargando ? (
            <><span className="spinner-btn" /> {mensajeCarga || 'Procesando...'}</>
          ) : (
            '▶ Ejecutar optimización'
          )}
        </button>
      </section>

      <hr className="ctrl-hr" />

      {/* Sección Sensibilidad */}
      <section className="ctrl-seccion">
        <h3 className="ctrl-titulo">Análisis What-If</h3>
        <p className="ctrl-desc">
          Modifica parámetros y compara la ganancia respecto al escenario base.
        </p>

        {/* Selector de escenario */}
        <div className="ctrl-campo">
          <label>Escenario</label>
          <select value={escenario} onChange={e => setEscenario(e.target.value)} disabled={cargando}>
            <option value="combustible">1. Aumento de combustible (+%)</option>
            <option value="via_cerrada">2. Cierre de vía principal</option>
            <option value="calidad">3. Fallo de calidad en acopio</option>
          </select>
        </div>

        {/* Parámetros específicos por escenario */}
        {escenario === 'combustible' && (
          <div className="ctrl-campo">
            <label>Aumento de combustible: <strong>{pctCombustible}%</strong></label>
            <input
              type="range" min={5} max={50} step={5}
              value={pctCombustible}
              onChange={e => setPctCombustible(Number(e.target.value))}
              disabled={cargando}
            />
            <span className="ctrl-nota">Afecta costos en rutas del Meta</span>
          </div>
        )}

        {escenario === 'via_cerrada' && (
          <>
            <div className="ctrl-campo">
              <label>Nodo origen de la vía</label>
              <select
                value={aristaOrigen}
                onChange={e => { setAristaOrigen(e.target.value); setAristaDestino('') }}
                disabled={cargando}
              >
                <option value="">— Seleccionar —</option>
                {origenesUnicos.map(id => (
                  <option key={id} value={id}>{getNombreNodo(id)}</option>
                ))}
              </select>
            </div>
            <div className="ctrl-campo">
              <label>Nodo destino de la vía</label>
              <select
                value={aristaDestino}
                onChange={e => setAristaDestino(e.target.value)}
                disabled={!aristaOrigen || cargando}
              >
                <option value="">— Seleccionar —</option>
                {destinosDeOrigen.map(id => (
                  <option key={id} value={id}>{getNombreNodo(id)}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {escenario === 'calidad' && (
          <>
            <div className="ctrl-campo">
              <label>Centro de acopio afectado</label>
              <select value={acopioId} onChange={e => setAcopioId(e.target.value)} disabled={cargando}>
                <option value="">— Seleccionar —</option>
                {acopios.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
            <div className="ctrl-campo">
              <label>Tasa de calidad nueva: <strong>{pctCalidad}%</strong></label>
              <input
                type="range" min={5} max={80} step={5}
                value={pctCalidad}
                onChange={e => setPctCalidad(Number(e.target.value))}
                disabled={cargando}
              />
              <span className="ctrl-nota">
                {100 - pctCalidad}% de lotes rechazados — alta merma y penalización
              </span>
            </div>
          </>
        )}

        <button
          className="btn btn-secondary"
          onClick={handleSensibilidad}
          disabled={cargando}
        >
          {cargando ? <><span className="spinner-btn" /> Analizando...</> : '🔍 Analizar escenario'}
        </button>
      </section>
    </div>
  )
}
