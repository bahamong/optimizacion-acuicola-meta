# Archivo: backend/sensibilidad/escenarios.py
"""
Análisis de Sensibilidad — Escenarios What-If.

Implementa los 3 escenarios críticos exigidos:

  1. Aumento de combustible (+X % en rutas del Meta)
     → Modifica costo_transporte de aristas con origen/destino en Meta.
     → Re-optimiza y mide impacto en ganancia.

  2. Cierre de vía principal
     → Elimina una arista del grafo (estado='bloqueada').
     → Re-optimiza y mide pérdida de ganancia, rutas alternativas.

  3. Pérdida de calidad en un centro de acopio
     → Reduce tasa_calidad del acopio (aumento de mermas y penalizaciones).
     → Re-optimiza y mide impacto.

Cada escenario retorna un dict con:
  - ganancia_base / ganancia_escenario
  - impacto (diferencia y porcentaje)
  - descripción de cambios
"""

from typing import Optional, Tuple

from algoritmos.optimizador_grafo import OptimizadorGrafo
from algoritmos.validador import ValidadorRestricciones
from models.grafo import GrafoRed
from models.nodo import TipoNodo
from utils.logger import get_logger

logger = get_logger(__name__)


def _optimizar_grafo(grafo: GrafoRed) -> Tuple[float, dict]:
    """
    Ejecuta optimización por grafos (Flujo de Mínimo Costo) y retorna (ganancia, resultado).
    Función auxiliar usada por todos los escenarios.
    """
    opt = OptimizadorGrafo(grafo)
    resultado_grafo = opt.ejecutar()
    ganancia = resultado_grafo["ganancia"]

    return ganancia, {"grafo": resultado_grafo}


class AnalizadorSensibilidad:
    """
    Ejecuta análisis What-If sobre la red logística.

    Toma una ganancia base (resultado de la optimización original)
    y compara con el resultado tras aplicar perturbaciones.
    """

    def __init__(self, grafo_base: GrafoRed, ganancia_base: float) -> None:
        self.grafo_base = grafo_base
        self.ganancia_base = ganancia_base

    def _resumen_impacto(
        self, ganancia_escenario: float, descripcion: str, cambios: dict
    ) -> dict:
        impacto_abs = ganancia_escenario - self.ganancia_base
        impacto_pct = (
            (impacto_abs / abs(self.ganancia_base) * 100)
            if self.ganancia_base != 0
            else 0.0
        )
        return {
            "descripcion": descripcion,
            "ganancia_base": round(self.ganancia_base, 2),
            "ganancia_escenario": round(ganancia_escenario, 2),
            "impacto_absoluto": round(impacto_abs, 2),
            "impacto_porcentual": round(impacto_pct, 2),
            "evaluacion": "NEGATIVO" if impacto_abs < 0 else "POSITIVO",
            "cambios_aplicados": cambios,
        }

    # ── Escenario 1: Aumento de combustible ───────────────────────────────────

    def escenario_combustible(self, porcentaje_aumento: float = 15.0) -> dict:
        """
        Escenario 1: Aumento del costo de combustible en rutas del Meta.

        Afecta a todas las aristas cuyo nodo origen o destino pertenece a
        municipios del departamento del Meta (identificados por 'Meta' en municipio/departamento).

        Args:
            porcentaje_aumento: % de aumento en el costo (ej: 15.0 → +15%)
        """
        grafo_mod = self.grafo_base.copia()
        factor = 1.0 + porcentaje_aumento / 100.0
        rutas_afectadas = []

        for (u, v), arista in grafo_mod.aristas.items():
            nodo_u = grafo_mod.obtener_nodo(u)
            nodo_v = grafo_mod.obtener_nodo(v)
            en_meta = any(
                "meta" in (n.departamento.lower() if n else "")
                or "meta" in (n.municipio.lower() if n else "")
                for n in [nodo_u, nodo_v]
                if n
            )
            if en_meta:
                costo_anterior = arista.costo_transporte
                arista.costo_transporte = round(costo_anterior * factor, 4)
                grafo_mod._nx[u][v]["weight"] = arista.costo_transporte
                rutas_afectadas.append({
                    "ruta": f"{u}→{v}",
                    "costo_anterior": costo_anterior,
                    "costo_nuevo": arista.costo_transporte,
                })

        logger.info(f"Escenario combustible +{porcentaje_aumento}%: {len(rutas_afectadas)} rutas afectadas")
        ganancia_esc, resultado = _optimizar_grafo(grafo_mod)

        return {
            **self._resumen_impacto(
                ganancia_esc,
                f"Aumento de combustible +{porcentaje_aumento}% en rutas del Meta",
                {"rutas_afectadas": rutas_afectadas, "factor": factor},
            ),
            "resultado_optimizacion": resultado,
        }

    # ── Escenario 2: Cierre de vía ────────────────────────────────────────────

    def escenario_via_cerrada(
        self, id_origen: str, id_destino: str
    ) -> dict:
        """
        Escenario 2: Cierre de una vía principal (arista eliminada).

        La arista id_origen → id_destino se bloquea y el flujo debe
        redirigirse por rutas alternativas.

        Args:
            id_origen:  ID del nodo de inicio de la arista a bloquear.
            id_destino: ID del nodo de destino de la arista a bloquear.
        """
        grafo_mod = self.grafo_base.copia()
        clave = (id_origen, id_destino)

        arista_bloqueada = grafo_mod.aristas.get(clave)
        if arista_bloqueada is None:
            return {
                "error": f"La arista {id_origen}→{id_destino} no existe en el grafo",
                "ganancia_base": self.ganancia_base,
            }

        info_arista = {
            "ruta": f"{id_origen}→{id_destino}",
            "costo_transporte": arista_bloqueada.costo_transporte,
            "capacidad": arista_bloqueada.capacidad,
            "distancia": arista_bloqueada.distancia,
        }

        # Bloquear la arista
        arista_bloqueada.estado = "bloqueada"
        del grafo_mod.aristas[clave]
        if grafo_mod._nx.has_edge(id_origen, id_destino):
            grafo_mod._nx.remove_edge(id_origen, id_destino)

        # Verificar si el grafo sigue siendo conexo
        sigue_conexo = grafo_mod.validar_conectividad()

        logger.info(
            f"Escenario vía cerrada: {id_origen}→{id_destino}, conexo={sigue_conexo}"
        )
        ganancia_esc, resultado = _optimizar_grafo(grafo_mod)

        # Validar si la demanda aún puede cumplirse
        validador = ValidadorRestricciones(grafo_mod)
        flujos_dict = {
            (a.id_origen, a.id_destino): a.flujo_actual
            for a in grafo_mod.aristas.values()
        }
        stock_dict = {
            a.id: resultado["grafo"].get("stocks", {}).get(a.id, 0.0)
            for a in grafo_mod.obtener_nodos_por_tipo(TipoNodo.ACOPIO)
        }
        validacion = validador.validar_completo(flujos_dict, stock_dict)

        return {
            **self._resumen_impacto(
                ganancia_esc,
                f"Cierre de la vía {id_origen}→{id_destino}",
                {
                    "arista_bloqueada": info_arista,
                    "grafo_sigue_conexo": sigue_conexo,
                    "deficit_total": validacion["deficit_total"],
                },
            ),
            "validacion": validacion,
            "resultado_optimizacion": resultado,
        }

    # ── Escenario 3: Fallo de calidad ─────────────────────────────────────────

    def escenario_fallo_calidad(
        self, id_acopio: str, tasa_calidad_nueva: float = 0.2
    ) -> dict:
        """
        Escenario 3: Pérdida masiva de calidad en un centro de acopio.

        Reduce la tasa_calidad del acopio indicado, aumentando penalizaciones
        y la tasa de merma, lo que eleva costos y puede redirigir flujos.

        Args:
            id_acopio:          ID del centro de acopio afectado.
            tasa_calidad_nueva: Nueva tasa de calidad [0, 1] (ej: 0.2 → 80% rechazo).
        """
        grafo_mod = self.grafo_base.copia()

        nodo_acopio = grafo_mod.obtener_nodo(id_acopio)
        if nodo_acopio is None or nodo_acopio.tipo != TipoNodo.ACOPIO:
            return {
                "error": f"Nodo '{id_acopio}' no existe o no es un centro de acopio",
                "ganancia_base": self.ganancia_base,
            }

        calidad_anterior = nodo_acopio.tasa_calidad
        merma_anterior = nodo_acopio.tasa_merma

        # Aplicar degradación: baja calidad → mayor merma (3× la tasa original)
        nodo_acopio.tasa_calidad = tasa_calidad_nueva
        nodo_acopio.tasa_merma = min(merma_anterior * 3.0, 0.5)

        logger.info(
            f"Escenario calidad: {id_acopio} calidad {calidad_anterior}→{tasa_calidad_nueva}, "
            f"merma {merma_anterior:.3f}→{nodo_acopio.tasa_merma:.3f}"
        )
        ganancia_esc, resultado = _optimizar_grafo(grafo_mod)

        return {
            **self._resumen_impacto(
                ganancia_esc,
                f"Fallo de calidad en {nodo_acopio.nombre} (tasa calidad={tasa_calidad_nueva})",
                {
                    "acopio": id_acopio,
                    "nombre_acopio": nodo_acopio.nombre,
                    "calidad_anterior": calidad_anterior,
                    "calidad_nueva": tasa_calidad_nueva,
                    "merma_anterior": merma_anterior,
                    "merma_nueva": nodo_acopio.tasa_merma,
                },
            ),
            "resultado_optimizacion": resultado,
        }

    def ejecutar_todos(self) -> dict:
        """Ejecuta los 3 escenarios y retorna el comparativo completo."""
        logger.info("Ejecutando análisis completo de 3 escenarios...")

        # Identificar la arista de mayor flujo para Escenario 2
        arista_critica = max(
            self.grafo_base.aristas.values(),
            key=lambda a: a.flujo_actual,
            default=None,
        )
        if arista_critica is None:
            # Si no hay flujos, tomar la primera arista de mayor capacidad
            arista_critica = max(
                self.grafo_base.aristas.values(),
                key=lambda a: a.capacidad,
                default=list(self.grafo_base.aristas.values())[0],
            )

        # Identificar el acopio más saturado para Escenario 3
        acopio_critico = min(
            self.grafo_base.obtener_nodos_por_tipo(TipoNodo.ACOPIO),
            key=lambda n: n.tasa_calidad,
        )

        return {
            "escenario_1_combustible": self.escenario_combustible(15.0),
            "escenario_2_via_cerrada": self.escenario_via_cerrada(
                arista_critica.id_origen, arista_critica.id_destino
            ),
            "escenario_3_calidad": self.escenario_fallo_calidad(
                acopio_critico.id, tasa_calidad_nueva=0.2
            ),
        }
