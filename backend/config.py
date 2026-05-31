import os
from dotenv import load_dotenv

load_dotenv()

DEBUG = os.getenv("DEBUG", "True") == "True"
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://lkqtrmhoksggnxxigomb.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcXRybWhva3NnZ254eGlnb21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ0MjYsImV4cCI6MjA5MTEwMDQyNn0.Csx_STf_l7MMQtFAhwSAvp_KXxctiZ27pojxZ0P_MkI")

# Algoritmo Genético
AG_POBLACION = int(os.getenv("AG_POBLACION", "60"))
AG_GENERACIONES = int(os.getenv("AG_GENERACIONES", "150"))
AG_TASA_MUTACION = float(os.getenv("AG_TASA_MUTACION", "0.05"))
AG_TASA_CRUZAMIENTO = float(os.getenv("AG_TASA_CRUZAMIENTO", "0.85"))

# Método de Gradiente
GRAD_TOLERANCIA = float(os.getenv("GRAD_TOLERANCIA", "1e-6"))
GRAD_ITERACIONES = int(os.getenv("GRAD_ITERACIONES", "300"))

# Penalizaciones
PENALIZACION_INCUMPLIMIENTO = float(os.getenv("PENALIZACION_INCUMPLIMIENTO", "1000.0"))
PENALIZACION_CALIDAD = float(os.getenv("PENALIZACION_CALIDAD", "500.0"))
PENALIZACION_CAPACIDAD = float(os.getenv("PENALIZACION_CAPACIDAD", "300.0"))

# Negocio
PRECIO_VENTA_TON = float(os.getenv("PRECIO_VENTA_TON", "250.0"))   # $/ton
COSTO_ALMACENAMIENTO = float(os.getenv("COSTO_ALMACENAMIENTO", "2.0"))  # $/ton/día
