// Archivo: frontend/src/services/api.js
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE,
  timeout: 120_000,
})

// ── Red ──────────────────────────────────────────────────────────────────────
export const obtenerGrafo     = () => api.get('/api/grafo_json')
export const obtenerMetricas  = () => api.get('/api/metricas')

// ── CRUD de nodos (Supabase en vivo) ──────────────────────────────────────────
export const obtenerNodos    = () => api.get('/api/nodos')
export const crearNodo       = (nodo)        => api.post('/api/nodos', nodo)
export const actualizarNodo  = (id, nodo)    => api.put(`/api/nodos/${id}`, nodo)
export const eliminarNodo    = (id)          => api.delete(`/api/nodos/${id}`)

// ── CRUD de aristas (Supabase en vivo) ────────────────────────────────────────
export const obtenerAristas    = () => api.get('/api/aristas')
export const crearArista       = (arista)     => api.post('/api/aristas', arista)
export const actualizarArista  = (id, arista) => api.put(`/api/aristas/${id}`, arista)
export const eliminarArista    = (id)         => api.delete(`/api/aristas/${id}`)

// ── Optimización ──────────────────────────────────────────────────────────────
export const ejecutarOptimizacion = () => api.post('/api/optimizar')
export const obtenerResultados    = () => api.get('/api/resultados')

// ── Algoritmos de grafos ──────────────────────────────────────────────────────
export const rutaOptima  = (origen, destino)  => api.get('/api/ruta_optima',  { params: { origen, destino } })
export const flujoMaximo = (fuente, sumidero) => api.get('/api/flujo_maximo', { params: { fuente, sumidero } })

// ── Análisis de sensibilidad ──────────────────────────────────────────────────
export const sensibilidadCombustible = (porcentaje_aumento) =>
  api.post('/api/sensibilidad/combustible', { porcentaje_aumento })

export const sensibilidadViaCerrada = (id_origen, id_destino) =>
  api.post('/api/sensibilidad/via_cerrada', { id_origen, id_destino })

export const sensibilidadCalidad = (id_acopio, tasa_calidad_nueva) =>
  api.post('/api/sensibilidad/calidad', { id_acopio, tasa_calidad_nueva })

export const sensibilidadTodos = () => api.post('/api/sensibilidad/todos')

// ── Caché de rutas OSRM (Supabase) ───────────────────────────────────────────
export const obtenerRutasCache = () => api.get('/api/rutas_cache')
export const guardarRutasCache = (rutas) => api.post('/api/rutas_cache', { rutas })
