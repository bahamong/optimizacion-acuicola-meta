# Archivo: backend/algoritmos/resultado.py
"""
Finalización compartida del resultado de optimización.

Tanto el optimizador por grafos (Flujo de Mínimo Costo) como el optimizador
por Algoritmo Genético asignan flujos a las aristas de la red. Una vez que los
flujos están en `arista.flujo_actual`, este módulo construye el diccionario de
resultado con EXACTAMENTE el mismo formato para ambos métodos, de modo que el
resto del sistema (API, mapa, métricas, validación, sensibilidad) funcione sin
depender del algoritmo usado.
"""

from typing import Dict, List

import config
from models.grafo import GrafoRed
from models.nodo import TipoNodo


def calcular_ganancia(grafo: GrafoRed, costo_operacion_total: float = 0.0) -> float:
    """Ingreso por demanda cubierta − costo de transporte − costo de operación
    de acopios − penalización por demanda no satisfecha, usando los flujos ya
    asignados en `arista.flujo_actual`.

    El ingreso usa el precio_venta individual de cada destino (cae al precio
    global solo si el nodo no define uno positivo).
    """
    destinos = grafo.obtener_nodos_por_tipo(TipoNodo.DESTINO)

    ingreso = 0.0
    penalizacion = 0.0

    for destino in destinos:
        recibido = sum(
            grafo.obtener_arista(u, destino.id).flujo_actual
            for u in grafo.vecinos_entrada(destino.id)
        )
        cubierto = min(recibido, destino.demanda)
        precio = (
            destino.precio_venta
            if getattr(destino, "precio_venta", 0.0) > 0
            else config.PRECIO_VENTA_TON
        )
        ingreso += cubierto * precio
        penalizacion += max(0.0, destino.demanda - recibido) * config.PENALIZACION_INCUMPLIMIENTO

    costo = sum(a.flujo_actual * a.costo_transporte for a in grafo.aristas.values())

    return ingreso - costo - costo_operacion_total - penalizacion


def construir_resultado(
    grafo: GrafoRed,
    acopios_penalizados: List[str],
    algoritmo: str,
    extra: Dict | None = None,
) -> dict:
    """Construye el diccionario de resultado a partir de los flujos ya
    asignados en `arista.flujo_actual`.

    Es la única fuente de verdad del formato de salida: ambos optimizadores la
    invocan tras fijar los flujos, garantizando resultados comparables.
    """
    acopios = grafo.obtener_nodos_por_tipo(TipoNodo.ACOPIO)

    rutas_activas = []
    flujos_optimos: Dict[str, float] = {}
    costo_total = 0.0

    for (u, v), arista in grafo.aristas.items():
        flujo = max(0.0, float(arista.flujo_actual))
        arista.flujo_actual = flujo

        if flujo > 1e-6:
            flujos_optimos[f"{u}→{v}"] = round(flujo, 4)
            # Costo ajustado por el estado de la vía (costo base * multiplicador).
            costo_total += flujo * arista.costo_total_unitario
            rutas_activas.append({
                "origen": u,
                "destino": v,
                "flujo": round(flujo, 4),
                "costo": round(arista.costo_base, 4),
                "costo_total": round(arista.costo_total_unitario, 4),
                "capacidad": arista.capacidad,
                "utilizacion": round(arista.utilizacion, 4),
            })

    # Merma total estimada por el producto que pasa por acopios.
    merma_total_estimada = 0.0
    for (u, v), arista in grafo.aristas.items():
        nodo_u = grafo.obtener_nodo(u)
        if (
            nodo_u is not None
            and nodo_u.tipo == TipoNodo.ACOPIO
            and arista.flujo_actual > 1e-6
        ):
            merma_total_estimada += arista.flujo_actual * nodo_u.tasa_merma

    # Costo de operación de los acopios activos (con flujo entrante).
    costo_operacion_total = 0.0
    acopios_activos = []
    for acopio in acopios:
        flujo_entrante = sum(
            grafo.obtener_arista(u, acopio.id).flujo_actual
            for u in grafo.vecinos_entrada(acopio.id)
            if grafo.obtener_arista(u, acopio.id)
        )
        if flujo_entrante > 1e-6:
            costo_operacion_total += acopio.costo_operacion
            acopios_activos.append(acopio.id)

    ganancia = calcular_ganancia(grafo, costo_operacion_total)

    resultado = {
        "exito": True,
        "algoritmo": algoritmo,
        "ganancia": round(ganancia, 4),
        "costo_minimo": round(costo_total, 4),
        "flujos": flujos_optimos,
        "stocks": {},
        "num_rutas_activas": len(rutas_activas),
        "num_rutas_total": len(grafo.aristas),
        "rutas_activas": rutas_activas,
        "acopios_penalizados": acopios_penalizados,
        "merma_total_estimada": round(merma_total_estimada, 4),
        "costo_operacion_acopios": round(costo_operacion_total, 4),
        "acopios_activos": acopios_activos,
        "cadena_valida": True,
        "restriccion": "Origen → Acopio → Destino (obligatorio)",
    }

    if extra:
        resultado.update(extra)

    return resultado
