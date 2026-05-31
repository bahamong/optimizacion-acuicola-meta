import { useState, useEffect, useCallback } from 'react'
import { FaExclamationTriangle, FaCheckCircle, FaTimes } from 'react-icons/fa'
import Sidebar from './components/Sidebar.jsx'
import VistaDatos from './components/VistaDatos.jsx'
import VistaMapa from './components/VistaMapa.jsx'
import VistaEvaluar from './components/VistaEvaluar.jsx'
import * as api from './services/api.js'

export default function App() {
  const [vista,         setVista]         = useState('datos')
  const [rutaDestacada, setRutaDestacada] = useState([])
  const [nodos,         setNodos]         = useState([])
  const [aristas,       setAristas]       = useState([])
  const [metricas,      setMetricas]      = useState(null)
  const [grafo,         setGrafo]         = useState(null)
  const [resultados,    setResultados]    = useState(null)
  const [cargando,      setCargando]      = useState(false)
  const [msgCarga,      setMsgCarga]      = useState('')
  const [error,         setError]         = useState(null)
  const [ok,            setOk]            = useState(null)
  const [sincronizado,  setSincronizado]  = useState(false)

  const cargarRedDefecto = useCallback(async () => {
    try {
      setCargando(true)
      setMsgCarga('Cargando red Acuícola Real del Meta...')
      await api.cargarRedDefecto()
      const [gRes, mRes] = await Promise.all([api.obtenerGrafo(), api.obtenerMetricas()])
      setNodos(gRes.data.nodos)
      setAristas(gRes.data.aristas)
      setGrafo(gRes.data)
      setMetricas(mRes.data)
      setSincronizado(true)
      setOk(`Red cargada: ${gRes.data.nodos.length} nodos, ${gRes.data.aristas.length} rutas.`)
      setError(null)
    } catch {
      setError('No se pudo conectar con el backend en localhost:8000')
    } finally {
      setCargando(false)
      setMsgCarga('')
    }
  }, [])

  useEffect(() => { cargarRedDefecto() }, [cargarRedDefecto])

  const aplicarAlSistema = async () => {
    try {
      setCargando(true)
      setMsgCarga('Enviando datos al sistema...')
      const payload = {
        nodos: nodos.map(n => ({
          id:              n.id,
          tipo:            n.tipo,
          nombre:          n.nombre,
          municipio:       n.municipio      || '',
          departamento:    n.departamento   || '',
          latitud:         Number(n.lat     || n.latitud  || 0),
          longitud:        Number(n.lng     || n.longitud || 0),
          capacidad:       Number(n.capacidad)       || 0,
          oferta:          Number(n.oferta)          || 0,
          demanda:         Number(n.demanda)         || 0,
          tasa_merma:      Number(n.tasa_merma)      || 0,
          tasa_calidad:    Number(n.tasa_calidad     ?? 1),
          costo_operacion: Number(n.costo_operacion) || 0,
        })),
        aristas: aristas.map(a => ({
          id_origen:        a.origen   || a.id_origen,
          id_destino:       a.destino  || a.id_destino,
          costo_transporte: Number(a.costo || a.costo_transporte),
          capacidad:        Number(a.capacidad),
          distancia:        Number(a.distancia),
          estado:           a.estado   || 'activa',
          umbral_calidad:   Number(a.umbral_calidad) || 0,
        })),
      }
      await api.cargarDatos(payload)
      const [gRes, mRes] = await Promise.all([api.obtenerGrafo(), api.obtenerMetricas()])
      setGrafo(gRes.data)
      setMetricas(mRes.data)
      setSincronizado(true)
      setResultados(null)
      setOk('Datos aplicados correctamente.')
      setError(null)
    } catch (e) {
      setError('Error al aplicar datos: ' + (e.response?.data?.detail || e.message))
    } finally {
      setCargando(false)
      setMsgCarga('')
    }
  }

  const editarNodoDesdeMapа = async (nodoId, cambios) => {
    const nodosActualizados = nodos.map(n =>
      n.id === nodoId ? { ...n, ...cambios } : n
    )
    setNodos(nodosActualizados)
    try {
      const payload = {
        nodos: nodosActualizados.map(n => ({
          id: n.id, tipo: n.tipo, nombre: n.nombre,
          municipio: n.municipio || '', departamento: n.departamento || '',
          latitud: Number(n.lat || n.latitud || 0),
          longitud: Number(n.lng || n.longitud || 0),
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
          umbral_calidad: Number(a.umbral_calidad) || 0,
        })),
      }
      await api.cargarDatos(payload)
      const gRes = await api.obtenerGrafo()
      setGrafo(gRes.data)
      setOk(`Nodo ${nodoId} actualizado.`)
    } catch (e) {
      setError('Error al actualizar nodo: ' + (e.response?.data?.detail || e.message))
    }
  }

  const editarAristaDesdeMapа = async (origenId, destinoId, cambios) => {
    const aristasActualizadas = aristas.map(a => {
      const o = a.origen || a.id_origen
      const d = a.destino || a.id_destino
      if (o === origenId && d === destinoId) {
        return {
          ...a,
          costo:            cambios.costo        ?? (a.costo || a.costo_transporte),
          costo_transporte: cambios.costo        ?? (a.costo || a.costo_transporte),
          capacidad:        cambios.capacidad     ?? a.capacidad,
          estado:           cambios.estado        ?? a.estado ?? 'activa',
          _situacion:       cambios._situacion    ?? a._situacion,
          _costoBase:       cambios._costoBase    ?? a._costoBase,
        }
      }
      return a
    })
    setAristas(aristasActualizadas)
    try {
      const payload = {
        nodos: nodos.map(n => ({
          id: n.id, tipo: n.tipo, nombre: n.nombre,
          municipio: n.municipio || '', departamento: n.departamento || '',
          latitud: Number(n.lat || n.latitud || 0),
          longitud: Number(n.lng || n.longitud || 0),
          capacidad: Number(n.capacidad) || 0,
          oferta: Number(n.oferta) || 0,
          demanda: Number(n.demanda) || 0,
          tasa_merma: Number(n.tasa_merma) || 0,
          tasa_calidad: Number(n.tasa_calidad ?? 1),
          costo_operacion: Number(n.costo_operacion) || 0,
        })),
        aristas: aristasActualizadas.map(a => ({
          id_origen: a.origen || a.id_origen,
          id_destino: a.destino || a.id_destino,
          costo_transporte: Number(a.costo || a.costo_transporte),
          capacidad: Number(a.capacidad),
          distancia: Number(a.distancia),
          estado: a.estado || 'activa',
          umbral_calidad: Number(a.umbral_calidad) || 0,
        })),
      }
      await api.cargarDatos(payload)
      const gRes = await api.obtenerGrafo()
      setGrafo(gRes.data)
      setOk(`Ruta ${origenId}→${destinoId} actualizada.`)
    } catch (e) {
      setError('Error al actualizar ruta: ' + (e.response?.data?.detail || e.message))
    }
  }

  const ejecutarOptimizacion = async () => {
    try {
      setCargando(true)
      setMsgCarga('Ejecutando Algoritmo Genético...')
      const r1 = await api.ejecutarOptimizacion()
      setMsgCarga('Procesando resultados del gradiente...')
      const [detRes, gRes, mRes] = await Promise.all([
        api.obtenerResultados(),
        api.obtenerGrafo(),
        api.obtenerMetricas(),
      ])
      setResultados({
        ...r1.data,
        historialAG: detRes.data?.ag?.historial_fitness || [],
        flujos:      detRes.data?.gradiente?.flujos      || {},
        rutas_ag:    detRes.data?.ag?.rutas_activas      || [],
      })
      setGrafo(gRes.data)
      setMetricas(mRes.data)
      setOk('Optimización completada.')
    } catch (e) {
      setError('Error en optimización: ' + (e.response?.data?.detail || e.message))
    } finally {
      setCargando(false)
      setMsgCarga('')
    }
  }

  const TITULOS = {
    datos:   'Gestión de Datos de la Red',
    mapa:    'Visualización de la Red',
    evaluar: 'Evaluar Red',
  }

  const vistas = {
    datos: (
      <VistaDatos
        nodos={nodos}
        aristas={aristas}
        onNodosChange={v => { setNodos(v); setSincronizado(false) }}
        onAristasChange={v => { setAristas(v); setSincronizado(false) }}
        onAplicar={aplicarAlSistema}
        onCargarDefecto={cargarRedDefecto}
        sincronizado={sincronizado}
        cargando={cargando}
      />
    ),
    mapa: (
      <VistaMapa
        grafo={grafo}
        metricas={metricas}
        rutaDestacada={rutaDestacada}
        onNodoEdit={editarNodoDesdeMapа}
        onAristaEdit={editarAristaDesdeMapа}
      />
    ),
    evaluar: (
      <VistaEvaluar
        nodos={nodos}
        grafo={grafo}
        metricas={metricas}
        resultados={resultados}
        onOptimizar={ejecutarOptimizacion}
        onVerEnMapa={ruta => { setRutaDestacada(ruta); setVista('mapa') }}
        sincronizado={sincronizado}
        cargando={cargando}
        msgCarga={msgCarga}
      />
    ),
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans">
      <Sidebar vistaActual={vista} onCambiar={setVista} sincronizado={sincronizado} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="h-[52px] bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
          <span className="text-[0.95rem] font-bold text-slate-800 tracking-tight">
            {TITULOS[vista]}
          </span>
          {cargando && (
            <span className="flex items-center gap-2 text-[0.82rem] text-indigo-500 font-medium">
              <span className="inline-block w-3.5 h-3.5 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              {msgCarga || 'Procesando...'}
            </span>
          )}
        </div>

        {/* Banners */}
        {error && (
          <div className="flex items-center justify-between px-6 py-2.5 text-sm font-medium bg-red-50 text-red-800 border-b border-red-200 flex-shrink-0">
            <span className="flex items-center gap-2"><FaExclamationTriangle /> {error}</span>
            <button className="opacity-60 hover:opacity-100 p-1" onClick={() => setError(null)}><FaTimes /></button>
          </div>
        )}
        {ok && !error && (
          <div className="flex items-center justify-between px-6 py-2.5 text-sm font-medium bg-green-50 text-green-800 border-b border-green-200 flex-shrink-0">
            <span className="flex items-center gap-2"><FaCheckCircle /> {ok}</span>
            <button className="opacity-60 hover:opacity-100 p-1" onClick={() => setOk(null)}><FaTimes /></button>
          </div>
        )}

        {/* Vista principal */}
        <div className="flex-1 overflow-y-auto p-6">
          {vistas[vista]}
        </div>
      </div>
    </div>
  )
}
