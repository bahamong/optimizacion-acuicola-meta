# Archivo: backend/utils/ia_analista.py
"""
Análisis narrativo de escenarios de sensibilidad usando Google Gemini.
"""
import json

import config
from utils.logger import get_logger

logger = get_logger(__name__)


def analizar_escenario_con_ia(resultado_escenario: dict) -> str:
    """
    Envía el resultado de un escenario a Google Gemini y retorna una
    interpretación gerencial en español.

    Retorna un string explicativo (nunca lanza) si no hay API key
    configurada o si la llamada falla.
    """
    if not config.GOOGLE_API_KEY:
        return "Análisis de IA no disponible (GOOGLE_API_KEY no configurado)."

    try:
        import google.generativeai as genai

        genai.configure(api_key=config.GOOGLE_API_KEY)
        model = genai.GenerativeModel(config.GOOGLE_AI_MODEL)

        # Resumen ejecutivo: no se envía el grafo completo a la IA.
        resumen = {
            "nombre_escenario": resultado_escenario.get("nombre", ""),
            "ganancia_base": resultado_escenario.get("ganancia_base", 0),
            "ganancia_escenario": resultado_escenario.get("ganancia_escenario", 0),
            "impacto_absoluto": resultado_escenario.get("impacto_absoluto", 0),
            "impacto_porcentual": resultado_escenario.get("impacto_porcentual", 0),
            "evaluacion": resultado_escenario.get("evaluacion", ""),
            "cambios_aplicados": resultado_escenario.get("cambios_aplicados", []),
            "rutas_activas": resultado_escenario.get("resultado_optimizacion", {})
            .get("grafo", {})
            .get("num_rutas_activas", 0),
        }

        prompt = f"""Eres un consultor logístico experto en distribución de alimentos en Colombia.
Analiza el siguiente resultado de un escenario What-If de la empresa Acuícola Real del Meta,
que distribuye pescado desde estaciones piscícolas a supermercados a través de centros logísticos.

DATOS DEL ESCENARIO:
{json.dumps(resumen, ensure_ascii=False, indent=2)}

Proporciona en español, en máximo 3 párrafos cortos:
1. Qué pasó (qué condición se aplicó y cuál fue el impacto en ganancia).
2. Por qué ocurrió (qué restricción logística lo causó).
3. Qué debería hacer la empresa (recomendación concreta y accionable).

Usa números exactos del resumen. Sé directo y ejecutivo. No uses markdown ni listas."""

        response = model.generate_content(prompt)
        return response.text.strip()

    except Exception as e:
        logger.error(f"Error en análisis IA: {e}")
        return f"Error en análisis de IA: {str(e)}"
