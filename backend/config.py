# Archivo: backend/config.py

import os
from pathlib import Path
from dotenv import load_dotenv

# Ruta exacta del archivo .env dentro de backend
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)

DEBUG = os.getenv("DEBUG", "True").lower() == "true"
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL:
    raise RuntimeError("Falta SUPABASE_URL en backend/.env")

if not SUPABASE_KEY:
    raise RuntimeError("Falta SUPABASE_KEY en backend/.env")

# Penalizaciones
PENALIZACION_INCUMPLIMIENTO = float(os.getenv("PENALIZACION_INCUMPLIMIENTO", "1000.0"))
PENALIZACION_CALIDAD = float(os.getenv("PENALIZACION_CALIDAD", "500.0"))
PENALIZACION_CAPACIDAD = float(os.getenv("PENALIZACION_CAPACIDAD", "300.0"))

# Negocio
PRECIO_VENTA_TON = float(os.getenv("PRECIO_VENTA_TON", "250.0"))
COSTO_ALMACENAMIENTO = float(os.getenv("COSTO_ALMACENAMIENTO", "2.0"))