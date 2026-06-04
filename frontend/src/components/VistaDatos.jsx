// Archivo: frontend/src/components/VistaDatos.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  FaIndustry,
  FaWarehouse,
  FaStore,
  FaRoute,
  FaBoxOpen,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPlus,
  FaPen,
  FaTrash,
  FaTimes,
  FaSearch,
  FaSpinner,
  FaFilter,
  FaLocationArrow,
  FaMapMarkerAlt,
} from "react-icons/fa";
import {
  buscarLugares,
  ubicacionDeptoMunicipio,
  resolverDeptoMunicipio,
  distanciaRuta,
  distanciaHaversine,
  obtenerUbicacionActual,
  MUNICIPIOS,
  DEPARTAMENTOS,
} from "../services/geo.js";
import {
  ESTADOS_VIA,
  ESTADO_POR_ID,
  calcularCostoTotal,
  etiquetaEstado,
} from "../services/estados.js";

const PIN = L.divIcon({
  className: "pin-divicon",
  html: '<div class="pin-marker"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

const NODO_VACIO = {
  tipo: "origen",
  nombre: "",
  municipio: "Villavicencio",
  departamento: "Meta",
  lat: 4.142,
  lng: -73.626,
  capacidad: 100,
  oferta: 0,
  demanda: 0,
  tasa_merma: 0,
  tasa_calidad: 0.9,
  costo_operacion: 0,
  direccion: "",
};
const ARISTA_VACIA = {
  origen: "",
  destino: "",
  costo: 0,
  capacidad: 50,
  distancia: 0,
  estado: "activa",
  umbral_calidad: 0,
};

const mermaDesdeCalidad = (c) =>
  Math.round((1 - Math.max(0, Math.min(1, c))) * 10000) / 10000;

function aristaEnRiesgo(a, nodos) {
  const umbral = Number(a.umbral_calidad) || 0;
  if (umbral <= 0) return false;
  const o = a.origen || a.id_origen;
  const dest = a.destino || a.id_destino;
  return [o, dest]
    .map((id) => nodos.find((n) => n.id === id))
    .filter(Boolean)
    .some((n) => (n.tasa_calidad ?? 1) * 100 < umbral);
}

function siguienteId(nodos, tipo) {
  const prefijo = { origen: "O", acopio: "A", destino: "D" }[tipo];
  const nums = nodos
    .filter((n) => n.id?.startsWith(prefijo))
    .map((n) => parseInt(n.id.slice(1), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `${prefijo}${max + 1}`;
}

function Modal({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">{titulo}</h3>
          <button
            className="text-slate-400 hover:text-slate-600 text-xl"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Recentrar({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng]); // eslint-disable-line
  return null;
}

function ClickColoca({ onMover }) {
  useMapEvents({ click: (e) => onMover(e.latlng.lat, e.latlng.lng) });
  return null;
}

function MiniMapa({ lat, lng, onMover }) {
  return (
    <div className="w-full h-[180px] rounded-lg overflow-hidden border border-slate-200">
      <MapContainer
        center={[lat, lng]}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          subdomains={["mt0", "mt1", "mt2", "mt3"]}
        />
        <Recentrar lat={lat} lng={lng} />
        <ClickColoca onMover={onMover} />
        <Marker
          position={[lat, lng]}
          icon={PIN}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = e.target.getLatLng();
              onMover(p.lat, p.lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}

function InputField({ label, children, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
      {hint && <span className="text-[0.68rem] text-slate-400">{hint}</span>}
    </div>
  );
}

const INPUT_CLS =
  "border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white w-full";
const SELECT_CLS =
  "border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white w-full";

function FormNodo({ inicial, onGuardar, onCerrar, nodos }) {
  const esEdicion = !!inicial?.id;
  const [d, setD] = useState(() => ({
    ...NODO_VACIO,
    ...inicial,
    lat: inicial?.lat ?? inicial?.latitud ?? NODO_VACIO.lat,
    lng: inicial?.lng ?? inicial?.longitud ?? NODO_VACIO.lng,
  }));

  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarSugs, setMostrarSugs] = useState(false);
  const [ubicacion, setUbicacion] = useState(null); // {lat,lng} del usuario
  const [geoEstado, setGeoEstado] = useState("idle"); // idle|cargando|ok|error
  const debounceRef = useRef();
  const buscarRef = useRef();

  const [latStr, setLatStr] = useState(() => Number(d.lat).toFixed(6));
  const [lngStr, setLngStr] = useState(() => Number(d.lng).toFixed(6));

  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));

  // Pedir la ubicación del usuario al abrir el formulario (sin bloquear la UI).
  useEffect(() => {
    let activo = true;
    obtenerUbicacionActual().then((loc) => {
      if (activo && loc) {
        setUbicacion(loc);
        setGeoEstado("ok");
      }
    });
    return () => {
      activo = false;
    };
  }, []);

  function onCambioDireccion(texto) {
    set("direccion", texto);
    clearTimeout(debounceRef.current);
    if (texto.trim().length < 3) {
      setSugerencias([]);
      setMostrarSugs(false);
      return;
    }
    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      // Pasa la ubicación del usuario para priorizar resultados cercanos.
      const res = await buscarLugares(texto, ubicacion);
      setSugerencias(res);
      setMostrarSugs(res.length > 0);
      setBuscando(false);
    }, 300);
  }

  function elegirSugerencia(s) {
    const resuelto = resolverDeptoMunicipio(s.departamento, s.municipio);
    setD((p) => {
      const departamento = resuelto?.departamento || p.departamento;
      let municipio = p.municipio;
      if (resuelto?.municipio && MUNICIPIOS[departamento]?.includes(resuelto.municipio)) {
        municipio = resuelto.municipio;
      } else if (resuelto?.departamento && resuelto.departamento !== p.departamento) {
        municipio = MUNICIPIOS[departamento]?.[0] || p.municipio;
      }
      return {
        ...p,
        direccion: s.etiqueta,
        lat: s.lat,
        lng: s.lng,
        departamento,
        municipio,
      };
    });
    setSugerencias([]);
    setMostrarSugs(false);
  }

  const moverPin = useCallback(async (lat, lng) => {
    setD((p) => ({
      ...p,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
    }));
    // Auto-completar departamento y municipio según la ubicación elegida.
    const info = await ubicacionDeptoMunicipio(lat, lng);
    if (info) {
      setD((p) => {
        const departamento = info.departamento || p.departamento;
        // Municipio válido dentro del departamento resuelto; si no se reconoce,
        // se conserva el actual (o el primero del nuevo departamento).
        let municipio = p.municipio;
        if (info.municipio && MUNICIPIOS[departamento]?.includes(info.municipio)) {
          municipio = info.municipio;
        } else if (info.departamento && info.departamento !== p.departamento) {
          municipio = MUNICIPIOS[departamento]?.[0] || p.municipio;
        }
        return {
          ...p,
          direccion: info.etiqueta || p.direccion,
          departamento,
          municipio,
        };
      });
    }
  }, []);

  // Botón "Usar mi ubicación": centra el pin en la ubicación actual del usuario.
  const usarMiUbicacion = useCallback(async () => {
    setGeoEstado("cargando");
    const loc = await obtenerUbicacionActual();
    if (loc) {
      setUbicacion(loc);
      setGeoEstado("ok");
      moverPin(loc.lat, loc.lng);
    } else {
      setGeoEstado("error");
    }
  }, [moverPin]);

  useEffect(() => {
    setLatStr(Number(d.lat).toFixed(6));
    setLngStr(Number(d.lng).toFixed(6));
  }, [d.lat, d.lng]);

  function aplicarCoordManual() {
    const la = parseFloat(latStr),
      ln = parseFloat(lngStr);
    if (
      !isNaN(la) &&
      !isNaN(ln) &&
      la >= -90 &&
      la <= 90 &&
      ln >= -180 &&
      ln <= 180
    ) {
      moverPin(la, ln);
    } else {
      setLatStr(Number(d.lat).toFixed(6));
      setLngStr(Number(d.lng).toFixed(6));
    }
  }

  function cambiarDepto(dep) {
    setD((p) => ({ ...p, departamento: dep, municipio: MUNICIPIOS[dep][0] }));
  }

  const merma = mermaDesdeCalidad(d.tasa_calidad);

  function submit(e) {
    e.preventDefault();
    if (!d.nombre.trim()) return alert("El nombre es obligatorio");
    onGuardar({
      ...d,
      nombre: d.nombre.trim(),
      lat: Number(d.lat),
      lng: Number(d.lng),
      tasa_merma: d.tipo === "acopio" ? merma : 0,
    });
  }

  return (
    <form onSubmit={submit} className="px-6 py-4 flex flex-col gap-4">
      {/* Tipo + Nombre */}
      <div className="grid grid-cols-2 gap-3">
        <InputField label="Tipo de nodo *">
          <select
            className={SELECT_CLS}
            value={d.tipo}
            onChange={(e) => set("tipo", e.target.value)}
            disabled={esEdicion}
          >
            <option value="origen">Origen (estación)</option>
            <option value="acopio">Acopio (centro)</option>
            <option value="destino">Destino (supermercado)</option>
          </select>
        </InputField>
        <InputField label="Nombre *">
          <input
            className={INPUT_CLS}
            value={d.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="Nombre descriptivo"
            required
          />
        </InputField>
      </div>

      {/* Buscador de dirección — con dropdown de sugerencias y botón de ubicación */}
      <InputField
        label={
          <span className="flex items-center gap-1">
            <FaSearch /> Buscar dirección o lugar
          </span>
        }
      >
        <div className="flex gap-2 items-start">
          <div className="relative flex-1" ref={buscarRef}>
            <input
              className={INPUT_CLS + " pr-8"}
              value={d.direccion}
              onChange={(e) => onCambioDireccion(e.target.value)}
              onFocus={() => sugerencias.length > 0 && setMostrarSugs(true)}
              onBlur={() => setTimeout(() => setMostrarSugs(false), 200)}
              placeholder="Ej: Unicentro, Villavicencio, calle 40..."
              autoComplete="off"
            />
            {buscando && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <FaSpinner className="animate-spin" />
              </span>
            )}
            {/* Dropdown de sugerencias */}
            {mostrarSugs && sugerencias.length > 0 && (
              <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[99999] max-h-60 overflow-y-auto">
                {sugerencias.map((s, i) => (
                  <li
                    key={i}
                    className="px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0"
                    onMouseDown={() => elegirSugerencia(s)}
                    title={s.etiqueta}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800 truncate">
                        {s.nombre || s.etiqueta.split(",")[0]}
                      </span>
                      {Number.isFinite(s._dist) && (
                        <span className="text-[0.68rem] text-indigo-500 whitespace-nowrap flex items-center gap-0.5">
                          <FaMapMarkerAlt />{" "}
                          {s._dist < 1
                            ? `${Math.round(s._dist * 1000)} m`
                            : `${s._dist.toFixed(1)} km`}
                        </span>
                      )}
                    </div>
                    <div className="text-[0.7rem] text-slate-400 truncate">
                      {s.etiqueta}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Botón usar mi ubicación */}
          <button
            type="button"
            onClick={usarMiUbicacion}
            title="Usar mi ubicación actual"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap
              ${
                geoEstado === "error"
                  ? "border-red-300 text-red-600 bg-red-50"
                  : "border-indigo-300 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
              }`}
          >
            {geoEstado === "cargando" ? (
              <FaSpinner className="animate-spin" />
            ) : (
              <FaLocationArrow />
            )}
            <span className="hidden sm:inline">Mi ubicación</span>
          </button>
        </div>
        {geoEstado === "ok" && ubicacion && (
          <span className="text-[0.68rem] text-green-600 flex items-center gap-1 mt-1">
            <FaCheckCircle /> Ubicación activa — los resultados se ordenan por
            cercanía a ti.
          </span>
        )}
        {geoEstado === "error" && (
          <span className="text-[0.68rem] text-red-500 mt-1">
            No se pudo obtener tu ubicación (permiso denegado o no disponible).
          </span>
        )}
      </InputField>

      {/* Mini mapa */}
      <MiniMapa lat={Number(d.lat)} lng={Number(d.lng)} onMover={moverPin} />
      <p className="text-xs text-slate-400">
        Arrastra el pin o haz click en el mapa para ajustar la ubicación.
      </p>

      {/* Departamento + Municipio */}
      <div className="grid grid-cols-2 gap-3">
        <InputField label="Departamento">
          <select
            className={SELECT_CLS}
            value={d.departamento}
            onChange={(e) => cambiarDepto(e.target.value)}
          >
            {DEPARTAMENTOS.map((dep) => (
              <option key={dep} value={dep}>
                {dep}
              </option>
            ))}
          </select>
        </InputField>
        <InputField label="Municipio">
          <select
            className={SELECT_CLS}
            value={d.municipio}
            onChange={(e) => set("municipio", e.target.value)}
          >
            {(MUNICIPIOS[d.departamento] || []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </InputField>
      </div>

      {/* Lat / Lng */}
      <div className="grid grid-cols-2 gap-3">
        <InputField label="Latitud">
          <input
            type="number"
            step="0.000001"
            className={INPUT_CLS}
            value={latStr}
            onChange={(e) => setLatStr(e.target.value)}
            onBlur={aplicarCoordManual}
          />
        </InputField>
        <InputField label="Longitud">
          <input
            type="number"
            step="0.000001"
            className={INPUT_CLS}
            value={lngStr}
            onChange={(e) => setLngStr(e.target.value)}
            onBlur={aplicarCoordManual}
          />
        </InputField>
      </div>

      {/* Campos específicos por tipo */}
      <div className="grid grid-cols-2 gap-3">
        <InputField label="Capacidad (ton)">
          <input
            type="number"
            min="0"
            className={INPUT_CLS}
            value={d.capacidad}
            onChange={(e) => set("capacidad", Number(e.target.value))}
          />
        </InputField>
        {d.tipo === "origen" && (
          <InputField label="Oferta (ton)">
            <input
              type="number"
              min="0"
              className={INPUT_CLS}
              value={d.oferta}
              onChange={(e) => set("oferta", Number(e.target.value))}
            />
          </InputField>
        )}
        {d.tipo === "destino" && (
          <InputField label="Demanda (ton)">
            <input
              type="number"
              min="0"
              className={INPUT_CLS}
              value={d.demanda}
              onChange={(e) => set("demanda", Number(e.target.value))}
            />
          </InputField>
        )}
        {d.tipo === "acopio" && (
          <InputField label="Costo operación ($/día)">
            <input
              type="number"
              min="0"
              className={INPUT_CLS}
              value={d.costo_operacion}
              onChange={(e) => set("costo_operacion", Number(e.target.value))}
            />
          </InputField>
        )}
      </div>

      {/* Calidad (solo acopios) */}
      {d.tipo === "acopio" && (
        <div className="flex flex-col gap-2 bg-slate-50 rounded-lg p-3 border border-slate-200">
          <label className="text-xs font-semibold text-slate-600">
            Tasa de calidad:{" "}
            <strong className="text-indigo-600">
              {Math.round(d.tasa_calidad * 100)}%
            </strong>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={d.tasa_calidad}
            onChange={(e) => set("tasa_calidad", Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <p className="text-xs text-slate-500">
            Merma derivada: <strong>{(merma * 100).toFixed(1)}%</strong>
            <span className="text-slate-400">
              {" "}
              (menor calidad → mayor merma)
            </span>
          </p>
          {d.tasa_calidad < 0.5 && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              <FaExclamationTriangle /> Calidad &lt; 50% — penaliza el flujo.
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          className="flex-1 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          onClick={onCerrar}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          {esEdicion ? "Guardar cambios" : "Agregar nodo"}
        </button>
      </div>
    </form>
  );
}

function FormArista({ inicial, onGuardar, onCerrar, nodos, aristas }) {
  const esEdicion = !!inicial?.origen || !!inicial?.id_origen;
  const [d, setD] = useState(() => ({
    ...ARISTA_VACIA,
    ...inicial,
    origen: inicial?.origen || inicial?.id_origen || "",
    destino: inicial?.destino || inicial?.id_destino || "",
    costo: inicial?.costo ?? inicial?.costo_transporte ?? 0,
    umbral_calidad: inicial?.umbral_calidad ?? 0,
  }));
  const [calcDist, setCalcDist] = useState(false);

  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));

  // Costo total = costo base ajustado por el estado de la vía (no editable).
  const costoTotal = calcularCostoTotal(d.costo, d.estado);

  useEffect(() => {
    if (!d.origen || !d.destino || d.origen === d.destino) return;
    const nO = nodos.find((n) => n.id === d.origen);
    const nD = nodos.find((n) => n.id === d.destino);
    if (!nO || !nD) return;
    const latO = nO.lat ?? nO.latitud,
      lngO = nO.lng ?? nO.longitud;
    const latD = nD.lat ?? nD.latitud,
      lngD = nD.lng ?? nD.longitud;
    let cancelado = false;
    setCalcDist(true);
    distanciaRuta(latO, lngO, latD, lngD).then((km) => {
      if (cancelado) return;
      setD((p) => ({
        ...p,
        distancia: km ?? distanciaHaversine(latO, lngO, latD, lngD),
      }));
      setCalcDist(false);
    });
    return () => {
      cancelado = true;
    };
  }, [d.origen, d.destino, nodos]);

  function existeDuplicado() {
    return aristas.some((a) => {
      const o = a.origen || a.id_origen,
        dest = a.destino || a.id_destino;
      if (
        esEdicion &&
        o === (inicial.origen || inicial.id_origen) &&
        dest === (inicial.destino || inicial.id_destino)
      )
        return false;
      return o === d.origen && dest === d.destino;
    });
  }

  function submit(e) {
    e.preventDefault();
    if (!d.origen) return alert("Selecciona el nodo origen");
    if (!d.destino) return alert("Selecciona el nodo destino");
    if (d.origen === d.destino)
      return alert("Origen y destino deben ser diferentes");
    if (existeDuplicado())
      return alert(`Ya existe la ruta ${d.origen} → ${d.destino}`);
    if (Number(d.capacidad) <= 0)
      return alert("La capacidad debe ser mayor a 0");
    if (Number(d.distancia) <= 0)
      return alert("Aún no se ha calculado la distancia. Espera un momento.");
    onGuardar(d);
  }

  return (
    <form onSubmit={submit} className="px-6 py-4 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <InputField label="Nodo origen *">
          <select
            className={SELECT_CLS}
            value={d.origen}
            onChange={(e) => set("origen", e.target.value)}
          >
            <option value="">— Seleccionar —</option>
            {nodos.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre} ({n.municipio})
              </option>
            ))}
          </select>
        </InputField>
        <InputField label="Nodo destino *">
          <select
            className={SELECT_CLS}
            value={d.destino}
            onChange={(e) => set("destino", e.target.value)}
          >
            <option value="">— Seleccionar —</option>
            {nodos
              .filter((n) => n.id !== d.origen)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nombre} ({n.municipio})
                </option>
              ))}
          </select>
        </InputField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <InputField label="Costo base ($/ton)">
          <input
            type="number"
            min="0"
            step="0.01"
            className={INPUT_CLS}
            value={d.costo}
            onChange={(e) => set("costo", Number(e.target.value))}
          />
        </InputField>
        <InputField
          label="Costo total ($/ton)"
          hint="Calculado del costo base y el estado de la vía. No editable."
        >
          <input
            className={
              INPUT_CLS + " bg-slate-50 text-slate-500 cursor-not-allowed"
            }
            value={
              costoTotal === null
                ? "Vía bloqueada"
                : `$${costoTotal.toFixed(2)}`
            }
            readOnly
          />
        </InputField>
        <InputField label="Capacidad (ton)">
          <input
            type="number"
            min="1"
            className={INPUT_CLS}
            value={d.capacidad}
            onChange={(e) => set("capacidad", Number(e.target.value))}
          />
        </InputField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <InputField label="Distancia — automática">
          <input
            className={
              INPUT_CLS + " bg-slate-50 text-slate-500 cursor-not-allowed"
            }
            value={
              calcDist
                ? "Calculando..."
                : d.distancia
                  ? `${d.distancia} km`
                  : "—"
            }
            readOnly
          />
        </InputField>
        <InputField label="Estado de la vía">
          <select
            className={SELECT_CLS}
            value={d.estado}
            onChange={(e) => set("estado", e.target.value)}
          >
            {ESTADOS_VIA.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </InputField>
        <InputField
          label="Umbral fallo de calidad (%)"
          hint="Si calidad origen/destino baja de este %, ruta en riesgo (0 = sin control)."
        >
          <input
            type="number"
            min="0"
            max="100"
            className={INPUT_CLS}
            value={d.umbral_calidad}
            onChange={(e) =>
              set(
                "umbral_calidad",
                Math.max(0, Math.min(100, Number(e.target.value))),
              )
            }
          />
        </InputField>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          className="flex-1 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          onClick={onCerrar}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={calcDist}
          className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-semibold transition-colors"
        >
          {esEdicion ? "Guardar cambios" : "Agregar ruta"}
        </button>
      </div>
    </form>
  );
}

export default function VistaDatos({
  nodos,
  aristas,
  onCrearNodo,
  onActualizarNodo,
  onEliminarNodo,
  onCrearArista,
  onActualizarArista,
  onEliminarArista,
}) {
  const [tab, setTab] = useState("nodos");
  const [modal, setModal] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroDepto, setFiltroDepto] = useState("todos");
  const [filtroMunicipio, setFiltroMunicipio] = useState("todos");

  const limpiarFiltros = () => {
    setFiltroTipo("todos");
    setFiltroDepto("todos");
    setFiltroMunicipio("todos");
    setFiltro("");
  };

  async function agregarNodo(datos) {
    await onCrearNodo({ ...datos, id: siguienteId(nodos, datos.tipo) });
    setModal(null);
  }
  async function editarNodo(datos) {
    await onActualizarNodo(datos.id, datos);
    setModal(null);
  }
  function eliminarNodo(id) {
    if (!confirm(`¿Eliminar nodo "${id}"? También se eliminarán sus rutas.`))
      return;
    onEliminarNodo(id);
  }

  async function agregarArista(datos) {
    await onCrearArista(datos);
    setModal(null);
  }
  async function editarArista(datos) {
    await onActualizarArista(datos.id, datos);
    setModal(null);
  }
  function eliminarArista(arista) {
    if (!confirm("¿Eliminar esta ruta?")) return;
    onEliminarArista(arista.id);
  }

  const txt = filtro.toLowerCase();
  const nodosFiltrados = nodos.filter(
    (n) =>
      (filtroTipo === "todos" || n.tipo === filtroTipo) &&
      (filtroDepto === "todos" || n.departamento === filtroDepto) &&
      (filtroMunicipio === "todos" || n.municipio === filtroMunicipio) &&
      (!txt ||
        n.nombre?.toLowerCase().includes(txt) ||
        n.municipio?.toLowerCase().includes(txt)),
  );
  const aristasFiltradas = aristas
    .map((a, idx) => ({ a, idx }))
    .filter(({ a }) => {
      const o = a.origen || a.id_origen || "",
        dest = a.destino || a.id_destino || "";
      const nO = nodos.find((n) => n.id === o),
        nD = nodos.find((n) => n.id === dest);
      if (!txt) return true;
      return (
        o.includes(txt) ||
        dest.includes(txt) ||
        nO?.nombre?.toLowerCase().includes(txt) ||
        nD?.nombre?.toLowerCase().includes(txt)
      );
    });

  const ofertaTotal = nodos
    .filter((n) => n.tipo === "origen")
    .reduce((s, n) => s + Number(n.oferta || 0), 0);
  const demandaTotal = nodos
    .filter((n) => n.tipo === "destino")
    .reduce((s, n) => s + Number(n.demanda || 0), 0);

  const CHIP =
    "flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 font-medium shadow-sm";
  const SELECT_FILTER =
    "border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white";

  const TIPO_CLASSES = {
    origen: "bg-red-50 text-red-700 border-red-200",
    acopio: "bg-amber-50 text-amber-700 border-amber-200",
    destino: "bg-green-50 text-green-700 border-green-200",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen */}
      <div className="flex flex-wrap gap-2">
        <span className={CHIP}>
          <FaIndustry className="text-blue-500" />{" "}
          {nodos.filter((n) => n.tipo === "origen").length} estaciones
        </span>
        <span className={CHIP}>
          <FaWarehouse className="text-amber-500" />{" "}
          {nodos.filter((n) => n.tipo === "acopio").length} acopios
        </span>
        <span className={CHIP}>
          <FaStore className="text-green-500" />{" "}
          {nodos.filter((n) => n.tipo === "destino").length} supermercados
        </span>
        <span className={CHIP}>
          <FaRoute /> {aristas.length} rutas
        </span>
        <span className={CHIP}>
          <FaBoxOpen className="text-blue-400" /> Oferta: {ofertaTotal} ton
        </span>
        <span className={CHIP}>
          <FaBoxOpen className="text-green-400" /> Demanda: {demandaTotal} ton
        </span>
        <span className={`${CHIP} text-green-700 border-green-200`}>
          <FaCheckCircle /> Datos en vivo (Supabase)
        </span>
      </div>

      {/* Tabs + Filtros */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
        <button
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === "nodos" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          onClick={() => setTab("nodos")}
        >
          Nodos ({nodos.length})
        </button>
        <button
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === "aristas" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          onClick={() => setTab("aristas")}
        >
          Rutas ({aristas.length})
        </button>

        {tab === "nodos" && (
          <div className="flex items-center gap-2 ml-2 flex-wrap">
            <FaFilter className="text-slate-400 text-xs" />
            <select
              className={SELECT_FILTER}
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="todos">Todos los tipos</option>
              <option value="origen">Orígenes</option>
              <option value="acopio">Acopios</option>
              <option value="destino">Destinos</option>
            </select>
            <select
              className={SELECT_FILTER}
              value={filtroDepto}
              onChange={(e) => {
                setFiltroDepto(e.target.value);
                setFiltroMunicipio("todos");
              }}
            >
              <option value="todos">Todos los deptos.</option>
              {DEPARTAMENTOS.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
            <select
              className={SELECT_FILTER}
              value={filtroMunicipio}
              onChange={(e) => setFiltroMunicipio(e.target.value)}
              disabled={filtroDepto === "todos"}
            >
              <option value="todos">Todos los municipios</option>
              {(MUNICIPIOS[filtroDepto] || []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
              onClick={limpiarFiltros}
            >
              <FaTimes /> Limpiar
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto bg-slate-100 rounded-lg px-2 py-1">
          <FaSearch className="text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Buscar..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="bg-transparent text-xs focus:outline-none w-32 text-slate-700 placeholder-slate-400"
          />
          {filtro && (
            <button
              className="text-slate-400 hover:text-slate-600"
              onClick={() => setFiltro("")}
            >
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>

        <button
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
          onClick={() =>
            setModal({ tipo: tab === "nodos" ? "nodo-nuevo" : "arista-nueva" })
          }
        >
          <FaPlus /> Agregar {tab === "nodos" ? "nodo" : "ruta"}
        </button>
      </div>

      {/* Tabla de nodos */}
      {tab === "nodos" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {[
                  "Nombre",
                  "Tipo",
                  "Municipio",
                  "Depto.",
                  "Lat",
                  "Lng",
                  "Cap (ton)",
                  "Oferta",
                  "Demanda",
                  "Calidad",
                  "Merma",
                  "Acciones",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodosFiltrados.map((n) => (
                <tr
                  key={n.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 font-medium text-slate-800 max-w-[160px] truncate">
                    {n.nombre}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded border text-xs font-semibold ${TIPO_CLASSES[n.tipo] || ""}`}
                    >
                      {n.tipo}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 text-xs">
                    {n.municipio}
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-xs">
                    {n.departamento}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-slate-500">
                    {Number(n.lat || n.latitud || 0).toFixed(4)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-slate-500">
                    {Number(n.lng || n.longitud || 0).toFixed(4)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {n.capacidad}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {n.tipo === "origen" ? n.oferta : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {n.tipo === "destino" ? n.demanda : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {n.tipo === "acopio"
                      ? ((n.tasa_calidad ?? 1) * 100).toFixed(0) + "%"
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {n.tipo === "acopio"
                      ? ((n.tasa_merma || 0) * 100).toFixed(1) + "%"
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        className="p-1.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                        onClick={() =>
                          setModal({ tipo: "nodo-editar", datos: n })
                        }
                      >
                        <FaPen className="text-xs" />
                      </button>
                      <button
                        className="p-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        onClick={() => eliminarNodo(n.id)}
                      >
                        <FaTrash className="text-xs" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {nodosFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    className="text-center py-8 text-slate-400 text-sm"
                  >
                    No hay nodos que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla de aristas */}
      {tab === "aristas" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {[
                  "Origen",
                  "Destino",
                  "Costo base ($/ton)",
                  "Costo total ($/ton)",
                  "Capacidad",
                  "Distancia",
                  "Estado",
                  "Flujo",
                  "Acciones",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aristasFiltradas.map(({ a, idx }) => {
                const o = a.origen || a.id_origen || "",
                  dest = a.destino || a.id_destino || "";
                const nO = nodos.find((n) => n.id === o),
                  nD = nodos.find((n) => n.id === dest);
                const riesgo = aristaEnRiesgo(a, nodos);
                const costoBase = Number(a.costo || a.costo_transporte || 0);
                const costoTotal = calcularCostoTotal(costoBase, a.estado);
                const estadoInfo = ESTADO_POR_ID[a.estado] || ESTADO_POR_ID.activa;
                return (
                  <tr
                    key={idx}
                    className={`border-b border-slate-100 hover:bg-slate-50 ${riesgo ? "bg-red-50/50" : ""}`}
                  >
                    <td className="px-3 py-2 text-slate-800 max-w-[140px] truncate text-xs">
                      {nO?.nombre || o}
                    </td>
                    <td className="px-3 py-2 text-slate-800 max-w-[140px] truncate text-xs">
                      {nD?.nombre || dest}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      ${costoBase.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-500">
                      {costoTotal === null
                        ? "—"
                        : `$${costoTotal.toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {a.capacidad}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {a.distancia} km
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold border"
                        style={{
                          color: estadoInfo.color,
                          borderColor: estadoInfo.color,
                          backgroundColor: estadoInfo.color + "1a",
                        }}
                      >
                        {etiquetaEstado(a.estado)}
                      </span>
                      {riesgo && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-xs">
                          <FaExclamationTriangle className="inline text-[0.6rem]" />{" "}
                          riesgo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500">
                      {a.flujo > 0
                        ? `${Number(a.flujo).toFixed(1)} (${((a.utilizacion || 0) * 100).toFixed(0)}%)`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          className="p-1.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                          onClick={() =>
                            setModal({ tipo: "arista-editar", datos: a })
                          }
                        >
                          <FaPen className="text-xs" />
                        </button>
                        <button
                          className="p-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                          onClick={() => eliminarArista(a)}
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {aristasFiltradas.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-8 text-slate-400 text-sm"
                  >
                    No hay rutas que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modales */}
      {modal?.tipo === "nodo-nuevo" && (
        <Modal titulo="Agregar nodo" onClose={() => setModal(null)}>
          <FormNodo
            inicial={null}
            onGuardar={agregarNodo}
            onCerrar={() => setModal(null)}
            nodos={nodos}
          />
        </Modal>
      )}
      {modal?.tipo === "nodo-editar" && (
        <Modal
          titulo={`Editar ${modal.datos.nombre}`}
          onClose={() => setModal(null)}
        >
          <FormNodo
            inicial={modal.datos}
            onGuardar={editarNodo}
            onCerrar={() => setModal(null)}
            nodos={nodos}
          />
        </Modal>
      )}
      {modal?.tipo === "arista-nueva" && (
        <Modal titulo="Agregar ruta" onClose={() => setModal(null)}>
          <FormArista
            inicial={null}
            onGuardar={agregarArista}
            onCerrar={() => setModal(null)}
            nodos={nodos}
            aristas={aristas}
          />
        </Modal>
      )}
      {modal?.tipo === "arista-editar" && (
        <Modal titulo="Editar ruta" onClose={() => setModal(null)}>
          <FormArista
            inicial={modal.datos}
            onGuardar={editarArista}
            onCerrar={() => setModal(null)}
            nodos={nodos}
            aristas={aristas}
          />
        </Modal>
      )}
    </div>
  );
}
