# Proyecto Final: Optimización de la Red Logística "Acuícola Real del Meta"

## 1. Contexto General

El proyecto integra **programación lineal**, **teoría de grafos**, **algoritmos heurísticos** (genético y gradiente) y una **interfaz web minimalista geoespacial** para resolver un problema real de optimización de distribución logística de pescado a nivel nacional.

---

## 2. Requerimientos del Profesor

### 2.1 Descripción del Problema

Acuícola Real del Meta necesita optimizar la distribución nacional de toneladas de pescado desde centros de producción hasta puntos de venta final, considerando eficiencia de costos, demanda de clientes y calidad del producto.

### 2.2 Estructura de la Red

**Componentes de la red:**
- **Orígenes (6 Estaciones):** 3 en municipios del Meta, 3 en Cundinamarca. Cada una con capacidades de producción distintas (Oferta).
- **Tránsito (10 Ciudades):** Centros de acopio intermedios (Bogotá, Villavicencio, etc.) con capacidades de almacenamiento limitadas.
- **Destinos (25-30 Supermercados):** Ubicados dentro de ciudades, cada uno con demanda específica.

### 2.3 Requerimientos Matemáticos Específicos

#### Función Objetivo
Minimizar el costo total de transporte y operación.

```
Min Z = Σ(costo_ruta_ij × flujo_ij) + Σ(costo_almacenamiento_j × inventario_j)
```

#### Restricciones Mandatorias

1. **Equilibrio de Flujo (Balance):**
   - Todo lo que entra a un centro de acopio debe salir hacia supermercados o quedar en stock.
   - Fórmula: flujo_entrada_j = flujo_salida_j + inventario_j + merma_j
   - **Consideración de mermas:** Aplicar tasa de deterioro (%) según tiempo de almacenamiento.

2. **Capacidad de Aristas:**
   - Los camiones tienen límites de carga variables según ruta.
   - Restricción: flujo_ij ≤ capacidad_camión_ij

3. **Cumplimiento de Demanda:**
   - Los supermercados deben recibir la cantidad exacta solicitada.
   - Restricción: flujo_destino_k = demanda_k (cumplimiento exacto)
   - Opción: permitir penalización si no se cumple.

4. **Restricciones de Calidad:**
   - Si una evaluación de calidad falla en un nodo, el flujo se detiene o se desvía.
   - Implementación: condicional que penaliza o bloquea rutas según parámetro de calidad.
   - Tasa de fallo de calidad por centro de acopio.

5. **Capacidad de Producción (Oferta):**
   - Restricción: flujo_salida_i ≤ capacidad_producción_i

6. **Restricciones de No Negatividad:**
   - Todos los flujos ≥ 0.

### 2.4 Componente de Teoría de Grafos

**Modelado como Grafo Dirigido Ponderado G = (V, E):**

- **V (Vértices):** Estaciones (6) + Acopios (10) + Supermercados (25-30) = 41-46 nodos.
- **E (Aristas):** Rutas de transporte con pesos dinámicos (costo por tonelada/km).
- **Pesos dinámicos:** Pueden variar según:
  - Distancia (km)
  - Costo de combustible
  - Peajes
  - Tasa de deterioro en tiempo de tránsito

**Algoritmos de Grafos Requeridos:**
- Búsqueda de Ruta Óptima: Dijkstra o Bellman-Ford (para rutas de menor costo).
- Flujo Máximo: Algoritmo Ford-Fulkerson o Push-Relabel (para identificar cuellos de botella).
- Detección de Ruta Crítica: Análisis de aristas críticas que limitan el flujo total.

### 2.5 Análisis de Sensibilidad y Escenarios

El sistema debe permitir modificación de variables en tiempo real (análisis What-if):

**Escenarios críticos mínimos:**
1. Aumento del costo de combustible (+15% en rutas del Meta).
2. Cierre de una vía principal (arista eliminada de la red).
3. Pérdida masiva de calidad en un centro de acopio específico.

**Salida esperada:** Impacto en ganancia/pérdida total.

### 2.6 Entregables del Profesor

1. **Modelo Matemático Formal:** Documentación completa de variables, restricciones, función objetivo.
2. **Aplicación Informática (Python):**
   - Carga dinámica de datos (nodos, capacidades, costos).
   - Visualización de grafo de red.
   - Cálculo de rutas óptimas y proyecciones de pérdida/ganancia.
3. **Informe de Resultados:** Análisis de sensibilidad sobre 3+ escenarios críticos con descripción del proceso de desarrollo.

---

## 3. Propuesta de Solución del Estudiante

### 3.1 Estrategia Algorítmica Híbrida

**Objetivo:** Combinar exactitud matemática con heurísticas avanzadas para resolver el problema en tiempo razonable.

#### Componente 1: Algoritmo Genético (AG)
**Aplicación:** Variables y decisiones de mayor impacto empresarial.

**Uso específico:**
- **Optimización global de rutas:** Determinar conjunto óptimo de rutas activas en la red.
  - Cromosoma: vector binario (arista_activa_sí/no) para cada ruta.
- **Asignación de capacidades:** Cómo distribuir capacidad de camiones entre rutas competidoras.
  - Cromosoma: vector de enteros (capacidad_asignada_a_rutaᵢ).
- **Ubicación óptima de inventarios:** Qué cantidad almacenar en cada centro de acopio.
  - Cromosoma: vector de floats (inventario_nodo_j).

**Parámetros del AG:**
- Tamaño de población: 50-100 individuos.
- Generaciones: 100-500 (ajustable).
- Tasa de cruzamiento (crossover): 0.8-0.9.
- Tasa de mutación: 0.01-0.05.
- Selección: Torneo o ruleta proporcional.
- Función de fitness: (Ganancia Total - Penalización por Incumplimiento) × Factor de Calidad.

**Restricciones en AG:**
- Reparador de cromosomas: validar que soluciones cumplan restricciones hard (capacidad, demanda).
- Penalización: añadir castigo a fitness si restricción se viola.

#### Componente 2: Método de Gradiente
**Aplicación:** Ajuste fino de parámetros secundarios y suavización de soluciones.

**Uso específico:**
- **Optimización de tiempos de entrega:** Minimizar tiempo total en red dado conjunto de rutas (AG ya las seleccionó).
- **Ajuste de tasas de almacenamiento:** Determinar cantidad exacta a almacenar en cada nodo para minimizar merma sin exceder capacidad.
- **Optimización de tiempos de transporte:** Velocidades y horarios de camiones entre rutas fijas.

**Método:**
- Gradiente descendente o ascendente (según si es minimización o maximización).
- Paso de aprendizaje: adaptativo (comienza alto, disminuye).
- Criterio de parada: convergencia (delta < tolerancia) o iteraciones máximas.

**Función a optimizar:**
```
L(θ) = Costo_Total(θ) - Beneficio_Cumplimiento(θ)
θ = {tiempos, tasas de almacenamiento, velocidades}
```

### 3.2 Flujo de Ejecución

```
┌─────────────────────────────────────┐
│ 1. Cargar datos (nodos, aristas)    │
│    - Estaciones, acopios, tiendas   │
│    - Capacidades, demandas, costos  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 2. Construir grafo G = (V, E)       │
│    - Validar conectividad           │
│    - Detectar ciclos, cuellos       │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 3. ALGORITMO GENÉTICO (AG)          │
│    - Generar población inicial      │
│    - Evaluar fitness cada individuo │
│    - Cruzamiento + Mutación         │
│    - Seleccionar mejores → Solución │
│      de rutas y capacidades óptimas │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 4. MÉTODO DE GRADIENTE              │
│    - Recibir solución del AG        │
│    - Ajustar parámetros secundarios │
│    - Convergencia → Solución final  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 5. Validar restricciones            │
│    - Cumplimiento, capacidad, calidad
│    - Cálculo de mermas              │
│    - Penalizaciones si aplica       │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 6. Calcular métricas finales        │
│    - Costo total, ganancia          │
│    - Rutas críticas (Dijkstra)      │
│    - Cuellos de botella (Flujo Max) │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 7. ANÁLISIS DE SENSIBILIDAD         │
│    - Ejecutar escenarios What-if    │
│    - Variar parámetros y re-optimizar
│    - Comparar resultados            │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 8. Retornar resultados a interfaz   │
└─────────────────────────────────────┘
```

---

## 4. Componente de Interfaz: Minimalismo Geoespacial

### 4.1 Requisitos Visuales

**Objetivo:** Mostrar geografía + red lógica sin ruido visual.

### 4.2 Especificación Técnica

**Enfoque:**
- API de mapas: Google Maps (Mapbox como alternativa).
- Estilo minimalista: desactivar capas de calles, ríos, comercios, hoteles, etc.
- Solo mostrar: fondo geografía (relieve discreto) + nodos circulares.

**Parámetros de estilo (Google Maps):**
```javascript
mapOptions = {
  zoom: 6,
  center: { lat: 4.5709, lng: -74.2973 }, // Centro aprox. de Colombia
  mapTypeId: 'roadmap',
  styles: [
    {
      featureType: 'all',
      stylers: [
        { visibility: 'off' }
      ]
    },
    {
      featureType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#f0e6d2' } // Fondo neutral
      ]
    },
    {
      featureType: 'administrative',
      stylers: [
        { visibility: 'simplified' },
        { color: '#cccccc' }
      ]
    }
  ]
};
```

**Nodos en mapa:**
- Círculos de 8-15 px de radio.
- Colores según tipo:
  - **Rojo:** Estaciones de origen (6).
  - **Amarillo:** Centros de acopio (10).
  - **Verde:** Supermercados/destino (25-30).
- Hover/click: mostrar nombre, capacidad, demanda.

**Aristas en mapa:**
- Líneas conectando nodos.
- Grosor proporcional a flujo actual (más grueso = más toneladas).
- Color según estado:
  - **Verde:** Ruta activa y operativa.
  - **Naranja:** Ruta con restricción de capacidad.
  - **Rojo:** Ruta con problema de calidad.
- Hover: mostrar costo, distancia, flujo actual.

**Interactividad:**
- Selector de escenario (What-if).
- Deslizador para ajustar parámetro (ej. costo combustible +0% a +50%).
- Botón "Re-optimizar" → ejecuta AG + gradiente nuevamente.
- Panel lateral: mostrar métricas KPI en tiempo real.

### 4.3 Stack Técnico Frontend

- **Framework:** React o Vue.js (para reactividad).
- **Mapas:** Google Maps API o Mapbox GL JS.
- **Gráficos complementarios:** Chart.js o D3.js (para sensibilidad).
- **Estado:** Redux o Pinia (gestión de datos).
- **API Backend:** Llamadas REST a servidor Python.

---

## 5. Backend: Arquitectura de Cálculo

### 5.1 Tecnologías

**Lenguaje:** Python 3.9+

**Librerías clave:**
- **Optimización:** PuLP o CPLEX (programación lineal).
- **Algoritmos genéticos:** DEAP (Distributed Evolutionary Algorithms in Python).
- **Grafos:** NetworkX (Dijkstra, Ford-Fulkerson).
- **Numérico:** NumPy, SciPy (para gradiente).
- **API REST:** Flask o FastAPI.
- **Base de datos:** PostgreSQL o SQLite (almacenamiento de nodos, aristas, historial).

### 5.2 Estructura de Datos

**Clase principal: `GrafoRed`**
```python
class GrafoRed:
    def __init__(self):
        self.vertices = {}  # {id: Nodo}
        self.aristas = {}   # {(u, v): Arista}
        self.demanda = {}   # {nodo_id: cantidad}
        self.oferta = {}    # {nodo_id: cantidad}
    
    def agregar_nodo(self, id, tipo, lat, lng, capacidad):
        # tipo: 'origen', 'acopio', 'destino'
        pass
    
    def agregar_arista(self, u, v, costo, capacidad, distancia):
        pass
    
    def dijkstra(self, origen, destino):
        # Ruta de menor costo
        pass
    
    def flujo_maximo(self, origen, destino):
        # Cuello de botella
        pass
```

**Clase: `OptimizadorHibrido`**
```python
class OptimizadorHibrido:
    def __init__(self, grafo, parametros_ag, parametros_gradiente):
        self.grafo = grafo
        self.poblacion = None
        self.mejor_individuo = None
    
    def ejecutar_ag(self):
        # Algoritmo genético
        pass
    
    def ejecutar_gradiente(self, solucion_ag):
        # Método de gradiente sobre solución AG
        pass
    
    def validar_restricciones(self, solucion):
        # Verificar todas las restricciones
        pass
    
    def calcular_fitness(self, individuo):
        # Función de aptitud
        pass
```

**Clase: `AnalizadorSensibilidad`**
```python
class AnalizadorSensibilidad:
    def __init__(self, optimizador):
        self.optimizador = optimizador
    
    def escenario_costo_combustible(self, porcentaje_aumento):
        # Variar costo en rutas del Meta
        pass
    
    def escenario_cierre_via(self, arista_id):
        # Eliminar arista, re-optimizar
        pass
    
    def escenario_fallo_calidad(self, nodo_id, tasa_fallo):
        # Degradar calidad, penalizar flujo
        pass
```

### 5.3 Endpoints REST (FastAPI)

```
POST   /api/cargar_datos          → carga JSON con nodos y aristas
POST   /api/optimizar              → ejecuta AG + gradiente
GET    /api/resultados             → retorna solución actual
GET    /api/metricas               → costo, ganancia, KPIs
POST   /api/sensibilidad/:escenario → análisis What-if
GET    /api/grafo_json             → datos para visualizar en mapa
```

---

## 6. Variables de Decisión y Parámetros

### 6.1 Variables de Decisión Continuas

- **flujo_ij:** Toneladas de pescado en ruta i→j (continua, ≥ 0).
- **inventario_j:** Toneladas almacenadas en acopio j (continua, ≥ 0).
- **tiempo_ij:** Tiempo de tránsito en ruta i→j (continua, horas).
- **velocidad_ij:** Velocidad de desplazamiento en ruta i→j (continua, km/h).

### 6.2 Variables de Decisión Discretas/Binarias

- **ruta_activa_ij:** 1 si ruta i→j está activa, 0 si no (binaria) — **Para AG.**
- **calidad_j:** 1 si acopio j cumple calidad, 0 si falla (binaria/ternaria con tasa).
- **capacidad_camion_ij:** Número de camiones en ruta i→j (entera).

### 6.3 Parámetros del Problema

**Entrada (datos del cliente):**
- **demanda_k:** Toneladas solicitadas por supermercado k (escalar, ton/período).
- **oferta_i:** Toneladas disponibles en estación i (escalar, ton/período).
- **capacidad_acopio_j:** Volumen máximo en acopio j (escalar, ton).
- **capacidad_ruta_ij:** Máximo de carga en ruta i→j (escalar, ton).
- **costo_transporte_ij:** Costo por tonelada en ruta i→j (escalar, $/ton).
- **costo_almacenamiento_j:** Costo diario de mantener 1 ton en acopio j (escalar, $/ton/día).
- **distancia_ij:** Distancia ruta i→j (escalar, km).
- **tasa_deterioro_j:** Porcentaje de merma diaria en acopio j (escalar, 0-1).
- **tasa_calidad_j:** Probabilidad de que pescado en j supere control (escalar, 0-1).

**Configuración AG:**
- población_tamaño
- generaciones_max
- tasa_cruzamiento
- tasa_mutacion

**Configuración Gradiente:**
- paso_aprendizaje
- tolerancia_convergencia
- iteraciones_max

---

## 7. Restricciones Detalladas

### 7.1 Restricciones de Balance de Flujo (Nodos de Acopio)

Para cada acopio j:
```
Σ flujo_ij (entrada) = Σ flujo_jk (salida) + inventario_j(t) - inventario_j(t-1) + merma_j
merma_j = tasa_deterioro_j × inventario_j(t-1)
```

### 7.2 Restricciones de Capacidad

Para cada ruta i→j:
```
flujo_ij ≤ capacidad_ruta_ij
```

Para cada acopio j:
```
inventario_j ≤ capacidad_acopio_j
```

### 7.3 Restricciones de Demanda

Para cada destino (supermercado) k:
```
Σ flujo_jk (flujos entrantes a k) = demanda_k (con tolerancia o penalización)
```

### 7.4 Restricciones de Oferta

Para cada origen (estación) i:
```
Σ flujo_ij (flujos salientes de i) ≤ oferta_i
```

### 7.5 Restricciones de Calidad

Para cada acopio j con fallo de calidad:
```
Si calidad_j = 0:
  flujo_jk_salida = 0 para todos los k (bloqueo)
  O: flujo_jk_salida × (1 - penalizacion) con costo_penalizacion adicional
```

### 7.6 Restricciones de No Negatividad

```
flujo_ij ≥ 0
inventario_j ≥ 0
capacidad_asignada ≥ 0
```

---

## 8. Función Objetivo Integral

```
Maximizar: GANANCIA = INGRESO_TOTAL - COSTO_TOTAL

Donde:
  INGRESO_TOTAL = Σ(precio_supermercado_k × demanda_k)
  
  COSTO_TOTAL = 
    + Σ(costo_transporte_ij × flujo_ij)           [Transporte]
    + Σ(costo_almacenamiento_j × inventario_j)    [Almacenamiento]
    + Σ(merma_j × precio_pescado)                 [Pérdida por deterioro]
    + Σ(penalizacion_incumplimiento_k)            [Falta a demanda]
    + Σ(penalizacion_calidad)                     [Control de calidad fallido]
```

**Función alternativa (minimizar costo):**
```
Minimizar: COSTO_TOTAL - (INGRESOS × factor_retorno)
```

---

## 9. Análisis de Sensibilidad: Escenarios What-If

### Escenario 1: Aumento de Combustible (+15% en Meta)

**Variables modificadas:**
- costo_transporte_ij × 1.15 para todas las rutas en Meta.

**Preguntas a responder:**
- ¿Cuál es la nueva ganancia?
- ¿Cambian las rutas óptimas?
- ¿Afecta al cumplimiento de demanda?

### Escenario 2: Cierre de Vía Principal

**Variables modificadas:**
- Arista i→j se elimina (capacidad_ruta_ij = 0).

**Preguntas a responder:**
- ¿Existe ruta alternativa (redundancia)?
- ¿Cuál es el costo de redireccionamiento?
- ¿Qué nodos quedan desabastecidos?

### Escenario 3: Fallo de Calidad en Centro de Acopio

**Variables modificadas:**
- tasa_calidad_j = 0.2 (80% de rechazo) para un acopio específico.

**Preguntas a responder:**
- ¿Cómo se redirige el flujo?
- ¿Aumenta el costo significativamente?
- ¿Existe cuello de botella alternativo?

---

## 10. Plan de Desarrollo y Entregables

### Fase 1: Modelado Matemático (Semana 1-2)
- [ ] Documentar todas las variables, restricciones y función objetivo.
- [ ] Validar modelo con caso pequeño (3 orígenes, 2 acopios, 5 destinos).
- [ ] Archivo: `Modelo_Matematico_Formal.pdf` (LaTeX + diagramas).

### Fase 2: Implementación Backend (Semana 2-4)
- [ ] Clase `GrafoRed` con métodos de grafos (Dijkstra, Flujo Máximo).
- [ ] Clase `OptimizadorHibrido` con AG + Gradiente.
- [ ] Clase `AnalizadorSensibilidad`.
- [ ] API REST con FastAPI.
- [ ] Testing unitario de restricciones.

### Fase 3: Interfaz Frontend (Semana 4-5)
- [ ] Mapa minimalista con nodos y aristas.
- [ ] Paneles de KPI en tiempo real.
- [ ] Selector de escenarios What-if.
- [ ] Visualización de resultados AG + Gradiente.

### Fase 4: Validación y Sensibilidad (Semana 5-6)
- [ ] Ejecutar 3+ escenarios críticos.
- [ ] Documentar resultados y comparativas.
- [ ] Análisis de convergencia del AG y gradiente.

### Fase 5: Informe Final (Semana 6)
- [ ] Informe ejecutivo con resultados.
- [ ] Documentación de proceso de desarrollo.
- [ ] Manual de uso de aplicación.

---

## 11. Criterios de Éxito

1. **Correctitud matemática:** Todas las restricciones se cumplen en solución final.
2. **Convergencia AG:** Población mejora y estabiliza en 100-200 generaciones.
3. **Convergencia Gradiente:** Parámetros secundarios alcanzan óptimo local en <50 iteraciones.
4. **Tiempo de ejecución:** Solución completa en <5 segundos (interfaz responsiva).
5. **Interfaz clara:** Usuario identifica rápidamente nodos, aristas, métricas clave.
6. **Sensibilidad consistente:** Escenarios What-if muestran impacto proporcional a cambios.
7. **Documentación exhaustiva:** Código comentado, README, manual de usuario, modelo matemático formal.

---

## 12. Notas Técnicas y Consideraciones

### 12.1 Sobre el Algoritmo Genético

- **Ventaja:** Explora espacio global, ideal para combinatoria discreta (seleccionar rutas).
- **Riesgo:** Puede quedar en óptimo local; requiere múltiples ejecuciones.
- **Mitigación:** Elite preservation (guardar mejores), diversidad de población.

### 12.2 Sobre el Gradiente

- **Ventaja:** Rápido, preciso para ajuste fino de parámetros continuos.
- **Riesgo:** Requiere función diferenciable; puede diverger si paso es muy grande.
- **Mitigación:** Paso adaptativo, validación de restricciones post-actualización.

### 12.3 Interacción AG + Gradiente

- AG resuelve problema estructural (¿qué rutas usar?).
- Gradiente refina solución AG (¿cuánto enviar exactamente?).
- No es iterativo; es secuencial: AG → Gradiente → Validación → Resultado.

### 12.4 API de Mapas: Consideración de Costos

- **Google Maps:** Cobro por llamadas API (ajustable con cache en frontend).
- **Mapbox:** Modelo de suscripción más predecible.
- **Alternativa de desarrollo:** Usar OpenStreetMap con Leaflet (gratuito, pero menos pulido).

---

## 13. Referencias de Implementación

### Librerías Clave

```python
# Algoritmo Genético
from deap import base, creator, tools, algorithms

# Grafos
import networkx as nx

# Optimización lineal
import pulp

# Gradiente
from scipy.optimize import minimize

# API REST
from fastapi import FastAPI
from pydantic import BaseModel

# Base de datos
from sqlalchemy import create_engine
```

### Patrones de Código (Pseudocódigo AG)

```python
def genetico(poblacion, generaciones):
    for gen in range(generaciones):
        # Evaluar fitness
        fitness_vals = [evaluar_fitness(ind) for ind in poblacion]
        
        # Seleccionar padres
        padres = seleccionar_torneo(poblacion, fitness_vals, k=20)
        
        # Cruzamiento y mutación
        hijos = []
        for p1, p2 in zip(padres[::2], padres[1::2]):
            hijo1, hijo2 = cruzar(p1, p2)
            hijo1 = mutar(hijo1, tasa_mut=0.02)
            hijo2 = mutar(hijo2, tasa_mut=0.02)
            hijos.extend([hijo1, hijo2])
        
        # Reparación de restricciones
        hijos = [reparar(h) for h in hijos]
        
        # Reemplazo generacional (élite + nuevos)
        poblacion = sorted(poblacion + hijos, 
                          key=lambda x: evaluar_fitness(x), 
                          reverse=True)[:len(poblacion)]
    
    return poblacion[0]  # Mejor individuo
```

---

## 14. Próximos Pasos

1. **Confirmar estructura de datos reales** (nodos, capacidades, costos) con datos del cliente o simulados.
2. **Implementar clase `GrafoRed`** con métodos básicos de grafos.
3. **Prototipar AG** con población pequeña y función fitness simplificada.
4. **Integrar API REST** para comunicación frontend-backend.
5. **Diseñar y desarrollar interfaz minimalista** con React + Google Maps.
6. **Ejecutar pruebas de convergencia** y análisis de sensibilidad.
7. **Documentar proceso y resultados** en informe final.

---

**Documento generado:** Contexto completo del Proyecto de Optimización para Acuícola Real del Meta.
**Versión:** 1.0
**Fecha de actualización:** Actual
