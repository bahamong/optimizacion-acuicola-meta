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

export async function buscarLugares(texto) {
  if (!texto || texto.trim().length < 3) return []
  try {
    const url = `${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(texto)}`
      + `&countrycodes=co&limit=6&addressdetails=1`
      + `&viewbox=${VIEWBOX}&bounded=1`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'es' },
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.map(item => ({
      etiqueta: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      municipio: item.address?.city || item.address?.town
        || item.address?.village || item.address?.municipality || '',
      departamento: item.address?.state || '',
    }))
  } catch {
    return []
  }
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
