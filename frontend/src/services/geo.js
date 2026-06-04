// Archivo: frontend/src/services/geo.js
/**
 * geo.js — Servicios de geocodificación (OpenStreetMap Nominatim) y
 * cálculo de distancia por carretera (OSRM). Sin librerías externas.
 *
 *  - buscarLugares(texto)     → autocompletado de direcciones/lugares
 *  - geocodificarInverso(lat,lng) → dirección a partir de coordenadas
 *  - distanciaRuta(o, d)      → distancia real por carretera (km)
 *
 * Limitado a Colombia. Nominatim pide máx ~1 req/seg: usar con debounce.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const OSRM = 'https://router.project-osrm.org/route/v1/driving'

// Caja delimitadora aproximada de Cundinamarca + Meta (lng_min,lat_min,lng_max,lat_max)
// Nominatim viewbox usa: left,top,right,bottom  (lon_min, lat_max, lon_max, lat_min)
const VIEWBOX = '-75.4,5.9,-71.5,2.8'

// Distancia rápida (km) en línea recta — para ordenar por cercanía.
function _distKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Busca lugares/direcciones en Colombia.
 *  - Devuelve hasta 15 resultados (ej. "Unicentro" → varios centros comerciales).
 *  - Si se pasa `cerca` {lat,lng} (ubicación del usuario), sesga la búsqueda
 *    hacia esa zona y ordena los resultados por cercanía, SIN excluir los
 *    lejanos (no usa `bounded=1`).
 */
export async function buscarLugares(texto, cerca = null) {
  if (!texto || texto.trim().length < 3) return []
  try {
    // viewbox centrado en el usuario (si hay ubicación) para priorizar cercanos.
    let viewbox = VIEWBOX
    if (cerca && Number.isFinite(cerca.lat) && Number.isFinite(cerca.lng)) {
      const d = 1.5 // ~150 km alrededor del usuario
      viewbox = `${cerca.lng - d},${cerca.lat + d},${cerca.lng + d},${cerca.lat - d}`
    }
    const url = `${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(texto)}`
      + `&countrycodes=co&limit=15&addressdetails=1`
      + `&viewbox=${viewbox}`   // sesga sin `bounded` → no excluye otros resultados
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'es' },
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return []
    const data = await res.json()
    let resultados = data.map(item => ({
      etiqueta: item.display_name,
      nombre: item.name || (item.display_name || '').split(',')[0],
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      municipio: item.address?.city || item.address?.town
        || item.address?.village || item.address?.municipality || '',
      departamento: item.address?.state || '',
      tipo: item.type || item.category || '',
    }))
    // Ordenar por cercanía a la ubicación del usuario si está disponible.
    if (cerca && Number.isFinite(cerca.lat) && Number.isFinite(cerca.lng)) {
      resultados = resultados
        .map(r => ({ ...r, _dist: _distKm(cerca.lat, cerca.lng, r.lat, r.lng) }))
        .sort((a, b) => a._dist - b._dist)
    }
    return resultados
  } catch {
    return []
  }
}

/**
 * Obtiene la ubicación actual del navegador (geolocalización).
 * Devuelve {lat,lng} o null si el usuario no concede permiso / no disponible.
 */
export function obtenerUbicacionActual() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve(null); return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  })
}

export async function geocodificarInverso(lat, lng) {
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'es' },
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return null
    const item = await res.json()
    return {
      etiqueta: item.display_name,
      municipio: item.address?.city || item.address?.town
        || item.address?.village || item.address?.municipality || '',
      departamento: item.address?.state || '',
    }
  } catch {
    return null
  }
}

/** Distancia real por carretera (km) entre dos puntos. null si falla. */
export async function distanciaRuta(latO, lngO, latD, lngD) {
  try {
    const url = `${OSRM}/${lngO},${latO};${lngD},${latD}?overview=false`
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) })
    if (!res.ok) return null
    const data = await res.json()
    if (data.code === 'Ok' && data.routes?.length > 0) {
      return Math.round(data.routes[0].distance / 100) / 10  // metros → km (1 decimal)
    }
  } catch {}
  return null
}

/** Distancia en línea recta (km) — respaldo si OSRM falla. */
export function distanciaHaversine(latO, lngO, latD, lngD) {
  const R = 6371
  const dLat = (latD - latO) * Math.PI / 180
  const dLng = (lngD - lngO) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(latO * Math.PI / 180) * Math.cos(latD * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3 * 10) / 10
}

// Municipios válidos por departamento (Cundinamarca + Meta).
// Lista oficial completa (DANE). Bogotá D.C. se incluye en Cundinamarca por
// compatibilidad con los datos de ejemplo de la red.
export const MUNICIPIOS = {
  Cundinamarca: [
    'Bogotá',
    'Agua de Dios', 'Albán', 'Anapoima', 'Anolaima', 'Apulo', 'Arbeláez',
    'Beltrán', 'Bituima', 'Bojacá', 'Cabrera', 'Cachipay', 'Cajicá',
    'Caparrapí', 'Cáqueza', 'Carmen de Carupa', 'Chaguaní', 'Chía', 'Chipaque',
    'Choachí', 'Chocontá', 'Cogua', 'Cota', 'Cucunubá', 'El Colegio',
    'El Peñón', 'El Rosal', 'Facatativá', 'Fómeque', 'Fosca', 'Funza',
    'Fúquene', 'Fusagasugá', 'Gachalá', 'Gachancipá', 'Gachetá', 'Gama',
    'Girardot', 'Granada', 'Guachetá', 'Guaduas', 'Guasca', 'Guataquí',
    'Guatavita', 'Guayabal de Síquima', 'Guayabetal', 'Gutiérrez', 'Jerusalén',
    'Junín', 'La Calera', 'La Mesa', 'La Palma', 'La Peña', 'La Vega',
    'Lenguazaque', 'Macheta', 'Madrid', 'Manta', 'Medina', 'Mosquera',
    'Nariño', 'Nemocón', 'Nilo', 'Nimaima', 'Nocaima', 'Venecia', 'Pacho',
    'Paime', 'Pandi', 'Paratebueno', 'Pasca', 'Puerto Salgar', 'Pulí',
    'Quebradanegra', 'Quetame', 'Quipile', 'Ricaurte', 'San Antonio del Tequendama',
    'San Bernardo', 'San Cayetano', 'San Francisco', 'San Juan de Rioseco',
    'Sasaima', 'Sesquilé', 'Sibaté', 'Silvania', 'Simijaca', 'Soacha', 'Sopó',
    'Subachoque', 'Suesca', 'Supatá', 'Susa', 'Sutatausa', 'Tabio', 'Tausa',
    'Tena', 'Tenjo', 'Tibacuy', 'Tibirita', 'Tocaima', 'Tocancipá', 'Topaipí',
    'Ubalá', 'Ubaque', 'Ubaté', 'Une', 'Útica', 'Vergara', 'Vianí',
    'Villagómez', 'Villapinzón', 'Villeta', 'Viotá', 'Yacopí', 'Zipacón',
    'Zipaquirá',
  ],
  Meta: [
    'Villavicencio',
    'Acacías', 'Barranca de Upía', 'Cabuyaro', 'Castilla La Nueva', 'Cubarral',
    'Cumaral', 'El Calvario', 'El Castillo', 'El Dorado', 'Fuente de Oro',
    'Granada', 'Guamal', 'Mapiripán', 'Mesetas', 'La Macarena', 'Uribe',
    'Lejanías', 'Puerto Concordia', 'Puerto Gaitán', 'Puerto López',
    'Puerto Lleras', 'Puerto Rico', 'Restrepo', 'San Carlos de Guaroa',
    'San Juan de Arama', 'San Juanito', 'San Martín', 'Vista Hermosa',
  ],
}

export const DEPARTAMENTOS = Object.keys(MUNICIPIOS)

// ── Resolución de ubicación a departamento/municipio del proyecto ────────────

/** Normaliza un texto: minúsculas, sin acentos ni prefijos como "Departamento de". */
function _norm(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')        // quita acentos
    .replace(/\bdepartamento de\b/g, '')
    .replace(/\bd\.?\s*c\.?\b/g, '')         // "D.C."
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Hace coincidir un departamento y municipio crudos (devueltos por Nominatim)
 * con las listas válidas del proyecto (Cundinamarca + Meta).
 * Devuelve { departamento, municipio } ya validados, o null si está fuera de cobertura.
 */
export function resolverDeptoMunicipio(deptoRaw, muniRaw) {
  const nd = _norm(deptoRaw)
  const nm = _norm(muniRaw)

  // 1) Departamento por nombre.
  let departamento = DEPARTAMENTOS.find((dep) => _norm(dep) === nd)
  if (!departamento) {
    if (nd.includes('bogota') || nd.includes('cundinamarca') || nd.includes('distrito capital')) {
      departamento = 'Cundinamarca'
    } else if (nd.includes('meta')) {
      departamento = 'Meta'
    }
  }
  // 2) Si no se reconoció el departamento, inferirlo por el municipio.
  if (!departamento) {
    for (const dep of DEPARTAMENTOS) {
      if (MUNICIPIOS[dep].some((m) => _norm(m) === nm)) { departamento = dep; break }
    }
  }
  if (!departamento) return null

  // 3) Municipio dentro del departamento.
  let municipio = MUNICIPIOS[departamento].find((m) => _norm(m) === nm)
  if (!municipio && (nd.includes('bogota') || nm.includes('bogota'))) {
    municipio = 'Bogotá'
  }
  if (!municipio && nm) {
    // Coincidencia parcial (p. ej. "villavicencio, meta" → "Villavicencio").
    municipio = MUNICIPIOS[departamento].find(
      (m) => _norm(m).includes(nm) || nm.includes(_norm(m)),
    )
  }
  return { departamento, municipio: municipio || '' }
}

/**
 * Geocodificación inversa + resolución al departamento/municipio del proyecto.
 * Devuelve { departamento, municipio, etiqueta } o null.
 */
export async function ubicacionDeptoMunicipio(lat, lng) {
  const info = await geocodificarInverso(lat, lng)
  if (!info) return null
  const resuelto = resolverDeptoMunicipio(info.departamento, info.municipio)
  return {
    etiqueta: info.etiqueta || '',
    departamento: resuelto?.departamento || '',
    municipio: resuelto?.municipio || '',
  }
}
