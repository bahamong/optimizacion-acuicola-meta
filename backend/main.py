# Archivo: backend/main.py
"""
Punto de entrada del servidor FastAPI — Acuícola Real del Meta.

Ejecutar:
  cd proyecto/backend
  pip install -r requirements.txt
  python main.py
  # o con auto-reload:
  uvicorn main:app --reload --host 127.0.0.1 --port 8000

Documentación interactiva disponible en:
  http://127.0.0.1:8000/docs
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.rutas import router
from utils.logger import get_logger

logger = get_logger(__name__)

app = FastAPI(
    title="Acuícola Real del Meta — Optimizador Logístico",
    description=(
        "API REST para optimización de la red de distribución de pescado. "
        "Usa Algoritmo Genético + Gradiente + Dijkstra + Flujo Máximo."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# allow_origin_regex cubre localhost/127.0.0.1 en CUALQUIER puerto (3000, 5173…)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Manejador global de errores ───────────────────────────────────────────────
# Garantiza que las excepciones no controladas devuelvan un JSON 500 *con*
# cabeceras CORS (el navegador las necesita; sin ellas axios reporta
# erróneamente "Network Error" en lugar del error real).
@app.exception_handler(Exception)
async def excepcion_global(request: Request, exc: Exception):
    logger.error(f"Error no controlado en {request.url.path}: {exc}", exc_info=True)
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Error interno: {exc}"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        },
    )


# ── Incluir todas las rutas de la API ─────────────────────────────────────────
app.include_router(router)


@app.on_event("startup")
async def startup():
    """Al arrancar: cargar la red por defecto."""
    logger.info("Iniciando servidor Acuícola Real del Meta (Supabase)...")
    try:
        from api.rutas import cargar_red_defecto
        cargar_red_defecto()
        logger.info("Red por defecto cargada automáticamente al inicio.")
    except Exception as e:
        logger.warning(f"No se pudo pre-cargar la red: {e}")


if __name__ == "__main__":
    import uvicorn
    from config import HOST, PORT, DEBUG

    logger.info(f"Servidor disponible en http://{HOST}:{PORT}/docs")
    uvicorn.run("main:app", host=HOST, port=PORT, reload=DEBUG)
