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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

# ── CORS (permite peticiones desde el frontend React en :3000) ────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
