import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar.jsx'
import VistaDatos from './components/VistaDatos.jsx'
import VistaMapa from './components/VistaMapa.jsx'
import VistaEvaluar from './components/VistaEvaluar.jsx'
import VistaSensibilidad from './components/VistaSensibilidad.jsx'
import * as api from './services/api.js'
import './App.css'

export default function App() {
  const [vista,     setVista]     = useState('datos')       // sección activa
  const [rutaDestacada, setRutaDestacada] = useState([])   // ruta Dijkstra resaltada en mapa
  const [nodos,     setNodos]     = useState([])             // datos locales (editables)
  const [aristas,   setAristas]   = useState([])
  const [metricas,  setMetricas]  = useState(null)
  const [grafo,     setGrafo]     = useState(null)           // datos del backend con flujos
  const [resultados, setResultados] = useState(null)
  const [escenario, setEscenario] = useState(null)
  const [cargando,  setCargando]  = useState(false)
  const [msgCarga,  setMsgCarga]  = useState('')
  const [error,     setError]     = useState(null)
  const [ok,        setOk]        = useState(null)           // mensaje de éxito
  const [sincronizado, setSincronizado] = useState(false)    // datos enviados al backend

  // Carga inicial: trae la red predeterminada del backend
  const cargarRedDefecto = useCallback(async () => {
    try {
      setCargando(true); setMsgCarga('Cargando red Acuícola Real del Meta...')
      await api.cargarRedDefecto()
      const [gRes, mRes] = await Promise.all([api.obtenerGrafo(), api.obtenerMetricas()])
      setNodos(gRes.data.nodos)
      setAristas(gRes.data.aristas)
      setGrafo(gRes.data)
      setMetricas(mRes.data)
      setSincronizado(true)
      setOk('Red predeterminada cargada: 41 nodos, ' + gRes.data.aristas.length + ' rutas.')
      setError(null)
    } catch {
      setError('No se pudo conectar con el backend en localhost:8000')
    } finally { setCargando(false); setMsgCarga('') }
  }, [])

  useEffect(() => { cargarRedDefecto() }, [cargarRedDefecto])

  // Enviar datos locales al backend
  const aplicarAlSistema = async () => {
    try {
      setCargando(true); setMsgCarga('Enviando datos al sistema...')
      const payload = {
        nodos: nodos.map(n => ({
          id: n.id, tipo: n.tipo, nombre: n.nombre,
          municipio: n.municipio || '', departamento: n.departamento || '',
          latitud: Number(n.lat || n.latitud), longitud: Number(n.lng || n.longitud),
          capacidad: Number(n.capacidad) || 0,
          oferta: Number(n.oferta) || 0,
          demanda: Number(n.demanda) || 0,
          tasa_merma: Number(n.tasa_merma) || 0,
          tasa_calidad: Number(n.tasa_calidad ?? 1),
          costo_operacion: Number(n.costo_operacion) || 0,
        })),
        aristas: aristas.map(a => ({
          id_origen: a.origen || a.id_origen,
          id_destino: a.destino || a.id_destino,
          costo_transporte: Number(a.costo || a.costo_transporte),
          capacidad: Number(a.capacidad),
          distancia: Number(a.distancia),
          estado: a.estado || 'activa',
        })),
      }
      await api.cargarDatos(payload)
      const [gRes, mRes] = await Promise.all([api.obtenerGrafo(), api.obtenerMetricas()])
      setGrafo(gRes.data)
      setMetricas(mRes.data)
      setSincronizado(true)
      setResultados(null); setEscenario(null)
      setOk('Datos aplicados al sistema correctamente.')
      setError(null)
    } catch (e) {
      setError('Error al aplicar datos: ' + (e.response?.data?.detail || e.message))
    } finally { setCargando(false); setMsgCarga('') }
  }

  // Optimizar
  const ejecutarOptimizacion = async () => {
    try {
      setCargando(true); setMsgCarga('Ejecutando Algoritmo Genético...')
      const r1 = await api.ejecutarOptimizacion()
      setMsgCarga('Obteniendo resultados...')
      const [detRes, gRes, mRes] = await Promise.all([
        api.obtenerResultados(), api.obtenerGrafo(), api.obtenerMetricas()
      ])
      setResultados({
        ...r1.data,
        historialAG: detRes.data?.ag?.historial_fitness || [],
        flujos:      detRes.data?.gradiente?.flujos || {},
        rutas_ag:    detRes.data?.ag?.rutas_activas || [],
        validacion:  detRes.data?.validacion || {},
      })
      setGrafo(gRes.data)
      setMetricas(mRes.data)
      setEscenario(null)
      setOk('Optimización completada.')
    } catch (e) {
      setError('Error en optimización: ' + (e.response?.data?.detail || e.message))
    } finally { setCargando(false); setMsgCarga('') }
  }

  // Sensibilidad
  const ejecutarSensibilidad = async (tipo, params) => {
    try {
      setCargando(true); setMsgCarga(`Analizando escenario: ${tipo}...`)
      let res
      if (tipo === 'combustible') res = await api.sensibilidadCombustible(params.porcentaje_aumento)
      else if (tipo === 'via_cerrada') res = await api.sensibilidadViaCerrada(params.id_origen, params.id_destino)
      else if (tipo === 'calidad') res = await api.sensibilidadCalidad(params.id_acopio, params.tasa_calidad_nueva)
      else if (tipo === 'todos') res = await api.sensibilidadTodos()
      setEscenario(res.data)
      setOk('Análisis completado.')
    } catch (e) {
      setError('Error en sensibilidad: ' + (e.response?.data?.detail || e.message))
    } finally { setCargando(false); setMsgCarga('') }
  }

  const vistas = {
    datos:        <VistaDatos nodos={nodos} aristas={aristas}
                    onNodosChange={setNodos} onAristasChange={setAristas}
                    onAplicar={aplicarAlSistema}
                    onCargarDefecto={cargarRedDefecto}
                    sincronizado={sincronizado}
                    cargando={cargando} />,
    mapa:         <VistaMapa grafo={grafo} metricas={metricas} rutaDestacada={rutaDestacada} />,
    evaluar:      <VistaEvaluar
                    nodos={nodos} grafo={grafo} metricas={metricas}
                    resultados={resultados}
                    onOptimizar={ejecutarOptimizacion}
                    onVerEnMapa={(ruta) => { setRutaDestacada(ruta); setVista('mapa') }}
                    sincronizado={sincronizado} cargando={cargando} msgCarga={msgCarga} />,
    sensibilidad: <VistaSensibilidad grafo={grafo} resultados={resultados}
                    escenario={escenario}
                    onEjecutar={ejecutarSensibilidad}
                    cargando={cargando} msgCarga={msgCarga} />,
  }

  return (
    <div className="app-shell">
      <Sidebar vistaActual={vista} onCambiar={setVista} sincronizado={sincronizado} />

      <div className="app-contenido">
        {/* Barra de estado global */}
        <div className="app-topbar">
          <span className="topbar-titulo">
            {{ datos:'Gestión de Datos', mapa:'Visualización del Grafo',
               evaluar:'Evaluar Red', sensibilidad:'Análisis de Sensibilidad' }[vista]}
          </span>
          {cargando && (
            <span className="topbar-cargando">
              <span className="spinner-mini" /> {msgCarga || 'Procesando...'}
            </span>
          )}
        </div>

        {error && (
          <div className="banner-error">
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {ok && !error && (
          <div className="banner-ok">
            <span>✓ {ok}</span>
            <button onClick={() => setOk(null)}>✕</button>
          </div>
        )}

        <div className="app-vista">
          {vistas[vista]}
        </div>
      </div>
    </div>
  )
}
