// Archivo: frontend/src/App.jsx
import { useState, useEffect, useCallback } from "react";
import { FaExclamationTriangle, FaCheckCircle, FaTimes } from "react-icons/fa";
import Sidebar from "./components/Sidebar.jsx";
import VistaDatos from "./components/VistaDatos.jsx";
import VistaMapa from "./components/VistaMapa.jsx";
import VistaEvaluar from "./components/VistaEvaluar.jsx";
import * as api from "./services/api.js";

// Mapea un nodo del frontend (lat/lng) al payload que espera la API.
const toNodoPayload = (n) => ({
  id: n.id,
  tipo: n.tipo,
  nombre: n.nombre,
  municipio: n.municipio || "",
  departamento: n.departamento || "",
  lat: Number(n.lat ?? n.latitud ?? 0),
  lng: Number(n.lng ?? n.longitud ?? 0),
  capacidad: Number(n.capacidad) || 0,
  oferta: Number(n.oferta) || 0,
  demanda: Number(n.demanda) || 0,
  tasa_merma: Number(n.tasa_merma) || 0,
  tasa_calidad: Number(n.tasa_calidad ?? 1),
  costo_operacion: Number(n.costo_operacion) || 0,
  precio_venta: Number(n.precio_venta ?? 250),
});

// Mapea una arista del frontend (origen/destino/costo) al payload de la API.
const toAristaPayload = (a) => ({
  origen: a.origen || a.id_origen,
  destino: a.destino || a.id_destino,
  costo: Number(a.costo ?? a.costo_transporte) || 0,
  capacidad: Number(a.capacidad) || 0,
  distancia: Number(a.distancia) || 0,
  estado: a.estado || "activa",
  umbral_calidad: Number(a.umbral_calidad) || 0,
});

export default function App() {
  const [vista, setVista] = useState("datos");
  const [rutaDestacada, setRutaDestacada] = useState([]);
  const [aristasDestacadas, setAristasDestacadas] = useState([]);
  const [nodos, setNodos] = useState([]);
  const [aristas, setAristas] = useState([]);
  const [metricas, setMetricas] = useState(null);
  const [grafo, setGrafo] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [msgCarga, setMsgCarga] = useState("");
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  // Recarga nodos y aristas directamente desde Supabase (datos en vivo).
  const refrescar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargando(true);
    try {
      const [nRes, aRes] = await Promise.all([
        api.obtenerNodos(),
        api.obtenerAristas(),
      ]);
      setNodos(nRes.data);
      setAristas(aRes.data);
      // El grafo y las métricas requieren que exista una red válida en la BD.
      try {
        const [gRes, mRes] = await Promise.all([
          api.obtenerGrafo(),
          api.obtenerMetricas(),
        ]);
        setGrafo(gRes.data);
        setMetricas(mRes.data);
      } catch {
        setGrafo(null);
        setMetricas(null);
      }
      setError(null);
    } catch {
      setError("No se pudo conectar con el backend en localhost:8000");
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  // ── CRUD de nodos contra Supabase ───────────────────────────────────────────
  const onCrearNodo = async (nodo) => {
    try {
      await api.crearNodo(toNodoPayload(nodo));
      await refrescar({ silencioso: true });
      setResultados(null);
      setOk(`Nodo "${nodo.nombre}" creado.`);
      setError(null);
    } catch (e) {
      setError("Error al crear nodo: " + (e.response?.data?.detail || e.message));
    }
  };

  const onActualizarNodo = async (id, nodo) => {
    try {
      await api.actualizarNodo(id, toNodoPayload(nodo));
      await refrescar({ silencioso: true });
      setResultados(null);
      setOk(`Nodo ${id} actualizado.`);
      setError(null);
    } catch (e) {
      setError("Error al actualizar nodo: " + (e.response?.data?.detail || e.message));
    }
  };

  const onEliminarNodo = async (id) => {
    try {
      await api.eliminarNodo(id);
      await refrescar({ silencioso: true });
      setResultados(null);
      setOk(`Nodo ${id} eliminado.`);
      setError(null);
    } catch (e) {
      setError("Error al eliminar nodo: " + (e.response?.data?.detail || e.message));
    }
  };

  // ── CRUD de aristas contra Supabase ─────────────────────────────────────────
  const onCrearArista = async (arista) => {
    try {
      await api.crearArista(toAristaPayload(arista));
      await refrescar({ silencioso: true });
      setResultados(null);
      setOk("Ruta creada.");
      setError(null);
    } catch (e) {
      setError("Error al crear ruta: " + (e.response?.data?.detail || e.message));
    }
  };

  const onActualizarArista = async (id, arista) => {
    try {
      await api.actualizarArista(id, toAristaPayload(arista));
      await refrescar({ silencioso: true });
      setResultados(null);
      setOk("Ruta actualizada.");
      setError(null);
    } catch (e) {
      setError("Error al actualizar ruta: " + (e.response?.data?.detail || e.message));
    }
  };

  const onEliminarArista = async (id) => {
    try {
      await api.eliminarArista(id);
      await refrescar({ silencioso: true });
      setResultados(null);
      setOk("Ruta eliminada.");
      setError(null);
    } catch (e) {
      setError("Error al eliminar ruta: " + (e.response?.data?.detail || e.message));
    }
  };

  // ── Edición rápida desde el mapa ────────────────────────────────────────────
  const editarNodoDesdeMapa = async (nodoId, cambios) => {
    const actual = nodos.find((n) => n.id === nodoId);
    if (!actual) return;
    await onActualizarNodo(nodoId, { ...actual, ...cambios });
  };

  const editarAristaDesdeMapa = async (origenId, destinoId, cambios) => {
    const actual = aristas.find(
      (a) =>
        (a.origen || a.id_origen) === origenId &&
        (a.destino || a.id_destino) === destinoId,
    );
    if (!actual?.id) return;
    await onActualizarArista(actual.id, {
      ...actual,
      costo: cambios.costo ?? (actual.costo ?? actual.costo_transporte),
      capacidad: cambios.capacidad ?? actual.capacidad,
      estado: cambios.estado ?? actual.estado ?? "activa",
    });
  };

  const ejecutarOptimizacion = async (metodo = "lineal") => {
    try {
      setCargando(true);
      setMsgCarga(
        metodo === "genetico"
          ? "Ejecutando Algoritmo Genético..."
          : "Ejecutando Programación Lineal (Transbordo)...",
      );
      const r1 = await api.ejecutarOptimizacion(metodo);
      setMsgCarga("Procesando resultados...");
      const [detRes, gRes, mRes] = await Promise.all([
        api.obtenerResultados(),
        api.obtenerGrafo(),
        api.obtenerMetricas(),
      ]);
      setResultados({
        ...r1.data,
        metodo: r1.data?.metodo || metodo,
        algoritmo: r1.data?.algoritmo || detRes.data?.grafo?.algoritmo,
        flujos: detRes.data?.grafo?.flujos || {},
        rutas_activas_detalle: detRes.data?.grafo?.rutas_activas || [],
        acopios_penalizados: detRes.data?.grafo?.acopios_penalizados || [],
        acopios_activos: detRes.data?.grafo?.acopios_activos || [],
        merma_total_estimada: detRes.data?.grafo?.merma_total_estimada ?? 0,
        costo_operacion_acopios: detRes.data?.grafo?.costo_operacion_acopios ?? 0,
        generaciones_ejecutadas: detRes.data?.grafo?.generaciones_ejecutadas,
        historia_fitness: detRes.data?.grafo?.historia_fitness,
        historia_generaciones: detRes.data?.grafo?.historia_generaciones,
        parametros_ag: detRes.data?.grafo?.parametros_ag,
        fitness_inicial: detRes.data?.grafo?.fitness_inicial,
        fitness_final: detRes.data?.grafo?.fitness_final,
        num_caminos: detRes.data?.grafo?.num_caminos,
        // Programación lineal (transbordo)
        estado_lp: detRes.data?.grafo?.estado_lp,
        valor_objetivo: detRes.data?.grafo?.valor_objetivo,
        num_variables: detRes.data?.grafo?.num_variables,
        num_restricciones: detRes.data?.grafo?.num_restricciones,
        num_rutas_oa: detRes.data?.grafo?.num_rutas_oa,
        num_rutas_aa: detRes.data?.grafo?.num_rutas_aa,
        num_rutas_ad: detRes.data?.grafo?.num_rutas_ad,
        modelo_lp: detRes.data?.grafo?.modelo,
        validacion: detRes.data?.validacion || null,
      });
      setGrafo(gRes.data);
      setMetricas(mRes.data);
      setOk("Optimización completada.");
    } catch (e) {
      setError(
        "Error en optimización: " + (e.response?.data?.detail || e.message),
      );
    } finally {
      setCargando(false);
      setMsgCarga("");
    }
  };

  const TITULOS = {
    datos: "Gestión de Datos de la Red",
    mapa: "Visualización y Evaluación de la Red",
  };

  const vistas = {
    datos: (
      <VistaDatos
        nodos={nodos}
        aristas={aristas}
        onCrearNodo={onCrearNodo}
        onActualizarNodo={onActualizarNodo}
        onEliminarNodo={onEliminarNodo}
        onCrearArista={onCrearArista}
        onActualizarArista={onActualizarArista}
        onEliminarArista={onEliminarArista}
        cargando={cargando}
      />
    ),
    // Vista combinada: mapa en la mitad izquierda, evaluaciones en la mitad derecha.
    mapa: (
      <div className="flex gap-4 h-full">
        {/* Mitad izquierda — mapa */}
        <div className="w-1/2 flex-shrink-0 h-full min-w-0">
          <VistaMapa
            grafo={grafo}
            metricas={metricas}
            rutaDestacada={rutaDestacada}
            aristasDestacadas={aristasDestacadas}
            onLimpiarFoco={() => { setRutaDestacada([]); setAristasDestacadas([]); }}
            onNodoEdit={editarNodoDesdeMapa}
            onAristaEdit={editarAristaDesdeMapa}
          />
        </div>

        {/* Mitad derecha — Ruta óptima, Flujo máximo y Optimización */}
        <div className="w-1/2 flex-shrink-0 h-full overflow-y-auto min-w-0 pr-1">
          <VistaEvaluar
            nodos={nodos}
            grafo={grafo}
            metricas={metricas}
            resultados={resultados}
            onOptimizar={ejecutarOptimizacion}
            onVerEnMapa={(ruta) => { setRutaDestacada(ruta); setAristasDestacadas([]); }}
            onVerFlujoEnMapa={(claves) => { setAristasDestacadas(claves); setRutaDestacada([]); }}
            sincronizado={true}
            cargando={cargando}
            msgCarga={msgCarga}
          />
        </div>
      </div>
    ),
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans">
      <Sidebar vistaActual={vista} onCambiar={setVista} sincronizado={true} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="h-[52px] bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
          <span className="text-[0.95rem] font-bold text-slate-800 tracking-tight">
            {TITULOS[vista]}
          </span>
          {cargando && (
            <span className="flex items-center gap-2 text-[0.82rem] text-indigo-500 font-medium">
              <span className="inline-block w-3.5 h-3.5 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              {msgCarga || "Procesando..."}
            </span>
          )}
        </div>

        {/* Banners */}
        {error && (
          <div className="flex items-center justify-between px-6 py-2.5 text-sm font-medium bg-red-50 text-red-800 border-b border-red-200 flex-shrink-0">
            <span className="flex items-center gap-2">
              <FaExclamationTriangle /> {error}
            </span>
            <button
              className="opacity-60 hover:opacity-100 p-1"
              onClick={() => setError(null)}
            >
              <FaTimes />
            </button>
          </div>
        )}
        {ok && !error && (
          <div className="flex items-center justify-between px-6 py-2.5 text-sm font-medium bg-green-50 text-green-800 border-b border-green-200 flex-shrink-0">
            <span className="flex items-center gap-2">
              <FaCheckCircle /> {ok}
            </span>
            <button
              className="opacity-60 hover:opacity-100 p-1"
              onClick={() => setOk(null)}
            >
              <FaTimes />
            </button>
          </div>
        )}

        {/* Vista principal */}
        <div className="flex-1 overflow-y-auto p-6">{vistas[vista]}</div>
      </div>
    </div>
  );
}
