from __future__ import annotations

from typing import Dict, Iterable, Optional, Tuple

import config
from grafos.distancias import CalculadorDistancias
from models.arista import Arista
from models.grafo import GrafoRed
from models.nodo import Nodo, TipoNodo
from utils.logger import get_logger


logger = get_logger(__name__)


def _float_pos(valor, default: float = 0.0) -> float:
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return default
    return numero if numero > 0 else default


def _reglas_por_par(reglas: Iterable[dict]) -> Dict[Tuple[str, str], dict]:
    resultado: Dict[Tuple[str, str], dict] = {}
    for regla in reglas or []:
        origen = regla.get("id_origen") or regla.get("origen")
        destino = regla.get("id_destino") or regla.get("destino")
        if origen and destino:
            resultado[(origen, destino)] = regla
    return resultado


def _capacidad_automatica(origen: Nodo, destino: Nodo) -> float:
    if origen.tipo == TipoNodo.ORIGEN and destino.tipo == TipoNodo.ACOPIO:
        limite_origen = _float_pos(origen.oferta, _float_pos(origen.capacidad))
        return min(limite_origen, _float_pos(destino.capacidad)) if limite_origen else 0.0

    if origen.tipo == TipoNodo.ACOPIO and destino.tipo == TipoNodo.DESTINO:
        limite_destino = _float_pos(destino.demanda, _float_pos(destino.capacidad))
        return min(_float_pos(origen.capacidad), limite_destino) if limite_destino else 0.0

    if origen.tipo == TipoNodo.ACOPIO and destino.tipo == TipoNodo.ACOPIO:
        return min(_float_pos(origen.capacidad), _float_pos(destino.capacidad))

    return 0.0


def _max_distancia_para(origen: Nodo, destino: Nodo) -> Optional[float]:
    if origen.tipo == TipoNodo.ORIGEN and destino.tipo == TipoNodo.ACOPIO:
        return config.MAX_DISTANCIA_ORIGEN_ACOPIO_KM
    if origen.tipo == TipoNodo.ACOPIO and destino.tipo == TipoNodo.DESTINO:
        return config.MAX_DISTANCIA_ACOPIO_DESTINO_KM
    if origen.tipo == TipoNodo.ACOPIO and destino.tipo == TipoNodo.ACOPIO:
        return config.MAX_DISTANCIA_ACOPIO_ACOPIO_KM
    return None


def _par_logistico_valido(origen: Nodo, destino: Nodo) -> bool:
    if origen.id == destino.id:
        return False
    if origen.tipo == TipoNodo.ORIGEN and destino.tipo == TipoNodo.ACOPIO:
        return True
    if origen.tipo == TipoNodo.ACOPIO and destino.tipo == TipoNodo.DESTINO:
        return True
    return (
        config.GENERAR_ACOPIO_ACOPIO
        and origen.tipo == TipoNodo.ACOPIO
        and destino.tipo == TipoNodo.ACOPIO
    )


def generar_aristas_automaticas(
    grafo: GrafoRed,
    reglas_manuales: Iterable[dict] | None = None,
    calculador: CalculadorDistancias | None = None,
) -> dict:
    """
    Completa el grafo con rutas logisticas validas.

    Las filas manuales de la tabla aristas se interpretan como reglas:
    bloqueo, capacidad especifica, factor de costo y penalizacion. Si no hay
    fila manual para un par valido, se crea una arista automatica.
    """
    reglas = _reglas_por_par(reglas_manuales or [])
    distancias = calculador or CalculadorDistancias()
    stats = {
        "aristas_generadas": 0,
        "aristas_con_regla_bd": 0,
        "aristas_bloqueadas": 0,
        "aristas_descartadas_distancia": 0,
        "aristas_descartadas_capacidad": 0,
        "aristas_directas_origen_destino_omitidas": 0,
        "fuente_distancia": distancias.fuente,
    }

    nodos = list(grafo.nodos.values())
    for origen in nodos:
        for destino in nodos:
            if (
                origen.tipo == TipoNodo.ORIGEN
                and destino.tipo == TipoNodo.DESTINO
            ):
                if (origen.id, destino.id) in reglas:
                    stats["aristas_directas_origen_destino_omitidas"] += 1
                continue

            if not _par_logistico_valido(origen, destino):
                continue

            regla = reglas.get((origen.id, destino.id))
            estado = (regla or {}).get("estado") or "activa"
            if estado == "bloqueada":
                stats["aristas_bloqueadas"] += 1
                continue

            resultado_distancia = distancias.distancia(origen, destino)
            distancia_km = resultado_distancia.distancia_km
            max_distancia = _max_distancia_para(origen, destino)
            if (
                max_distancia is not None
                and distancia_km > max_distancia
                and not regla
            ):
                stats["aristas_descartadas_distancia"] += 1
                continue

            capacidad = (
                _float_pos((regla or {}).get("capacidad"))
                or _capacidad_automatica(origen, destino)
            )
            if capacidad <= 0:
                stats["aristas_descartadas_capacidad"] += 1
                continue

            factor_costo = _float_pos((regla or {}).get("factor_costo"), 1.0)
            penalizacion = float((regla or {}).get("penalizacion") or 0.0)
            costo_base = round(distancia_km * config.COSTO_POR_KM, 2)

            grafo.agregar_arista(
                Arista(
                    id_origen=origen.id,
                    id_destino=destino.id,
                    costo_transporte=costo_base,
                    capacidad=capacidad,
                    distancia=distancia_km,
                    estado=estado,
                    umbral_calidad=float((regla or {}).get("umbral_calidad") or 0.0),
                    fuente_distancia=resultado_distancia.fuente,
                    generada_automaticamente=regla is None,
                    factor_costo=factor_costo,
                    penalizacion=penalizacion,
                )
            )

            if regla is None:
                stats["aristas_generadas"] += 1
            else:
                stats["aristas_con_regla_bd"] += 1

    distancias.guardar_cache_pendiente()
    grafo.metadatos["generacion_aristas"] = stats

    logger.info(
        "Grafo automatico: %s generadas, %s con regla BD, %s bloqueadas",
        stats["aristas_generadas"],
        stats["aristas_con_regla_bd"],
        stats["aristas_bloqueadas"],
    )
    return stats
