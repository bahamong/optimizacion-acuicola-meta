# Contexto y requerimientos iniciales del proyecto de optimización

## Proyecto: Optimización de la red logística de **Acuícola Real del Meta**

Este documento recopila y organiza la idea inicial del proyecto, los requerimientos exigidos por el enunciado del profesor y las decisiones de diseño propuestas para empezar el desarrollo del software de optimización. La intención es tener una base clara antes de programar, formular el modelo matemático y construir la interfaz.

---

## 1. Propósito del documento

El propósito de este documento es dejar definido, de forma ordenada, qué se quiere construir, qué problema se busca resolver y qué condiciones debe cumplir el proyecto. También sirve como guía para tomar decisiones técnicas, matemáticas y visuales durante el desarrollo.

El proyecto no debe centrarse únicamente en una interfaz atractiva. La prioridad principal debe ser la lógica de optimización, la formulación matemática, la interpretación de restricciones y la aplicación correcta de algoritmos. La interfaz visual debe apoyar la comprensión de la red logística, pero no debe convertirse en el elemento central del trabajo.

---

## 2. Contexto general del problema

La empresa **Acuícola Real del Meta** ha aumentado su operación y necesita coordinar la distribución nacional de toneladas de pescado desde centros de producción hasta supermercados. El producto es perecedero, por lo tanto, la red logística debe ser eficiente en costos, cumplir la demanda de los clientes y conservar la calidad del producto durante el transporte y almacenamiento.

El sistema se puede entender como una red jerárquica con tres tipos de nodos:

1. **Estaciones de producción u orígenes**  
   Son los puntos donde se produce o se dispone inicialmente el pescado. Cada estación tiene una oferta máxima disponible.

2. **Centros de acopio o nodos de tránsito**  
   Son ciudades o instalaciones intermedias donde el producto puede almacenarse, redistribuirse o evaluarse antes de llegar a los supermercados. Cada centro de acopio tiene una capacidad limitada.

3. **Supermercados o destinos finales**  
   Son los puntos de venta que deben recibir una demanda específica. El modelo debe intentar cumplir exactamente la cantidad solicitada por cada supermercado.

El problema consiste en determinar cómo debe moverse el producto dentro de la red para minimizar costos, evitar cuellos de botella, responder a cambios externos y mantener condiciones de calidad.

---

## 3. Problema a resolver

El problema principal es decidir la mejor forma de transportar pescado desde las estaciones de producción hasta los supermercados, pasando por centros de acopio cuando sea necesario, bajo condiciones reales de operación.

El sistema debe responder preguntas como:

- ¿Qué rutas deben utilizarse para transportar el producto con menor costo total?
- ¿Qué estaciones deben abastecer a cada centro de acopio?
- ¿Qué centros de acopio deben atender a cada supermercado?
- ¿Qué ocurre si sube el costo del combustible?
- ¿Qué pasa si se cierra una vía principal?
- ¿Cómo se afecta la ganancia si un centro de acopio presenta pérdida de calidad?
- ¿Dónde aparecen cuellos de botella por capacidad limitada?
- ¿Qué rutas o nodos tienen mayor impacto sobre la empresa?

---

## 4. Idea central propuesta

La idea del proyecto es desarrollar una aplicación en Python que permita cargar una red logística, visualizarla de forma geográfica y aplicar métodos de optimización para encontrar rutas, asignaciones y flujos eficientes.

La lógica debe combinar dos enfoques:

1. **Algoritmo genético**  
   Se usará para las decisiones de mayor impacto, principalmente aquellas que son combinatorias, difíciles de resolver por ensayo manual o que afectan considerablemente los costos de la empresa.

2. **Método de gradiente**  
   Se usará para ajustes finos sobre variables continuas, como redistribución de cantidades, proporciones de flujo o mejora local de una solución ya propuesta por el algoritmo genético.

Además, el proyecto debe incorporar herramientas de teoría de grafos:

- Búsqueda de rutas óptimas.
- Detección de cuellos de botella.
- Análisis de flujo máximo.
- Evaluación de escenarios tipo *What-if*.

---

## 5. Enfoque híbrido de optimización

La propuesta no debe presentar el algoritmo genético y el gradiente como métodos aislados, sino como partes de una estrategia híbrida.

### 5.1 Uso del algoritmo genético

El algoritmo genético será el componente principal para tomar decisiones grandes o estructurales. Se recomienda usarlo para decisiones como:

- Selección de rutas principales.
- Activación o desactivación de aristas importantes.
- Asignación de estaciones a centros de acopio.
- Asignación de centros de acopio a supermercados.
- Priorización de nodos de alto impacto.
- Búsqueda de soluciones cuando existen cierres de vías o fallos de calidad.
- Comparación de múltiples combinaciones posibles de transporte.

Este método es adecuado porque la red puede tener muchas combinaciones posibles. Si existen 6 estaciones, 10 centros de acopio y 25 a 30 supermercados, probar manualmente todas las opciones sería ineficiente.

### 5.2 Uso del método de gradiente

El método de gradiente se usará como una etapa de mejora local. No debe ser presentado como el único método para resolver todo el problema, porque la red logística tiene decisiones discretas y restricciones de capacidad que no siempre se ajustan bien a un gradiente clásico.

Su uso recomendado es:

- Ajustar cantidades de flujo sobre rutas ya seleccionadas.
- Mejorar una solución generada por el algoritmo genético.
- Reducir costos marginales redistribuyendo toneladas entre rutas disponibles.
- Optimizar variables continuas después de fijar la estructura de la red.
- Aplicar gradiente proyectado para respetar límites de capacidad y no negatividad.

La idea es que el algoritmo genético encuentre una buena estructura general, y luego el gradiente refine esa solución.

### 5.3 Flujo propuesto del algoritmo híbrido

El flujo lógico del sistema puede organizarse así:

1. Cargar nodos, rutas, capacidades, costos y demandas.
2. Construir el grafo dirigido ponderado.
3. Calcular rutas base mediante algoritmos de grafos.
4. Identificar rutas y nodos críticos por costo, demanda, capacidad o riesgo.
5. Ejecutar algoritmo genético sobre las decisiones de mayor impacto.
6. Evaluar cada individuo con una función de aptitud basada en costo, demanda, calidad, capacidad y penalizaciones.
7. Reparar soluciones inválidas que violen restricciones críticas.
8. Seleccionar las mejores soluciones.
9. Aplicar gradiente o ajuste local sobre los flujos continuos de la mejor solución.
10. Calcular indicadores finales: costo total, ganancia proyectada, rutas usadas, cuellos de botella y pérdidas.
11. Mostrar resultados en la interfaz.
12. Permitir análisis de sensibilidad modificando variables en tiempo real.

---

## 6. Modelo de red como grafo

El sistema debe representarse como un **grafo dirigido ponderado**:

\[
G = (V, E)
\]

Donde:

- \(V\) es el conjunto de vértices o nodos.
- \(E\) es el conjunto de aristas o rutas dirigidas.

### 6.1 Tipos de nodos

Se propone dividir el conjunto de nodos así:

- \(O\): conjunto de estaciones de producción.
- \(A\): conjunto de centros de acopio.
- \(S\): conjunto de supermercados.

Por lo tanto:

\[
V = O \cup A \cup S
\]

### 6.2 Tipos de aristas

Las rutas pueden clasificarse de la siguiente forma:

- Rutas desde estaciones hacia centros de acopio: \((i,j)\), con \(i \in O\), \(j \in A\).
- Rutas desde centros de acopio hacia supermercados: \((j,k)\), con \(j \in A\), \(k \in S\).
- Rutas directas desde estaciones hacia supermercados, si el caso lo permite: \((i,k)\), con \(i \in O\), \(k \in S\).
- Rutas entre centros de acopio, si se desea permitir redistribución interna: \((j,l)\), con \(j,l \in A\).

Cada arista debe tener un peso dinámico asociado al costo de transporte.

---

## 7. Parámetros principales del modelo

Los parámetros son datos conocidos que se cargan antes de ejecutar la optimización.

| Parámetro | Descripción |
|---|---|
| \(oferta_i\) | Cantidad máxima disponible en la estación de producción \(i\). |
| \(demanda_k\) | Cantidad exacta solicitada por el supermercado \(k\). |
| \(capacidad_j\) | Capacidad máxima de almacenamiento del centro de acopio \(j\). |
| \(capacidad_{ij}\) | Capacidad máxima de transporte de la ruta \((i,j)\). |
| \(distancia_{ij}\) | Distancia entre el nodo \(i\) y el nodo \(j\). |
| \(costoKm_{ij}\) | Costo por kilómetro de la ruta \((i,j)\). |
| \(costoTon_{ij}\) | Costo por tonelada transportada en la ruta \((i,j)\). |
| \(merma_j\) | Porcentaje de pérdida del producto en el centro de acopio \(j\). |
| \(calidad_j\) | Indicador de calidad del centro de acopio \(j\). |
| \(penalizacion_j\) | Costo adicional si el nodo \(j\) presenta falla de calidad. |
| \(precioVenta_k\) | Precio de venta por tonelada en el supermercado \(k\). |
| \(costoOperacion_j\) | Costo operativo del centro de acopio \(j\). |
| \(combustible_{ij}\) | Factor asociado al costo de combustible en la ruta \((i,j)\). |

---

## 8. Variables de decisión

Las variables de decisión representan lo que el modelo debe calcular.

| Variable | Descripción |
|---|---|
| \(x_{ij}\) | Toneladas enviadas desde el nodo \(i\) hasta el nodo \(j\). |
| \(y_{ij}\) | Variable binaria que indica si la ruta \((i,j)\) se usa o no. |
| \(stock_j\) | Cantidad que queda almacenada temporalmente en el centro de acopio \(j\). |
| \(perdida_j\) | Cantidad perdida por merma o fallo de calidad en el centro de acopio \(j\). |
| \(desvio_{ij}\) | Variable que representa flujo desviado por cierre o falla de una ruta. |

---

## 9. Función objetivo propuesta

La función objetivo debe minimizar el costo total de transporte y operación, incorporando penalizaciones por fallos de calidad, cierres de rutas, mermas y uso de rutas costosas.

Una forma general de expresarla es:

\[
\min Z =
\sum_{(i,j) \in E} costo_{ij}x_{ij}
+ \sum_{j \in A} costoOperacion_j
+ \sum_{j \in A} penalizacion_j perdida_j
+ \sum_{(i,j) \in E} costoDesvio_{ij} desvio_{ij}
\]

Donde el costo de una ruta puede calcularse como:

\[
costo_{ij} = distancia_{ij} \cdot costoKm_{ij} \cdot combustible_{ij}
\]

También puede incorporarse una función de utilidad o ganancia proyectada:

\[
Ganancia = Ingresos - Costos
\]

Con:

\[
Ingresos = \sum_{k \in S} precioVenta_k \cdot demanda_k
\]

El sistema puede mostrar tanto el costo mínimo como la ganancia proyectada.

---

## 10. Restricciones principales

### 10.1 Restricción de oferta

Una estación no puede enviar más producto del que tiene disponible.

\[
\sum_{j:(i,j) \in E} x_{ij} \leq oferta_i \quad \forall i \in O
\]

### 10.2 Restricción de demanda exacta

Cada supermercado debe recibir exactamente lo solicitado.

\[
\sum_{i:(i,k) \in E} x_{ik} = demanda_k \quad \forall k \in S
\]

Si se desea permitir incumplimiento en escenarios extremos, puede agregarse una variable de déficit con penalización alta. Sin embargo, para el modelo base se debe conservar la demanda exacta, porque el enunciado exige cumplimiento de demanda.

### 10.3 Balance de flujo en centros de acopio

Todo lo que entra a un centro de acopio debe salir, almacenarse o perderse por merma.

\[
\sum_{i:(i,j) \in E} x_{ij}
= 
\sum_{k:(j,k) \in E} x_{jk} + stock_j + perdida_j
\quad \forall j \in A
\]

### 10.4 Capacidad de centros de acopio

Un centro de acopio no puede almacenar ni procesar más de su capacidad.

\[
\sum_{i:(i,j) \in E} x_{ij} \leq capacidad_j \quad \forall j \in A
\]

### 10.5 Capacidad de aristas o rutas

Cada ruta tiene un límite máximo de transporte.

\[
x_{ij} \leq capacidad_{ij} y_{ij} \quad \forall (i,j) \in E
\]

Esta restricción conecta el flujo con el uso de la ruta. Si \(y_{ij}=0\), entonces no puede circular producto por esa ruta.

### 10.6 Restricción de calidad

Si un centro de acopio falla una evaluación de calidad, el flujo puede detenerse o desviarse. Se puede modelar con un parámetro \(calidad_j\), donde:

- \(calidad_j = 1\): el nodo está habilitado.
- \(calidad_j = 0\): el nodo presenta fallo de calidad.

Una restricción posible es:

\[
\sum_{i:(i,j) \in E} x_{ij} \leq capacidad_j \cdot calidad_j
\quad \forall j \in A
\]

Si \(calidad_j=0\), el nodo no recibe flujo. Otra alternativa es permitir flujo con penalización alta, según el escenario definido.

### 10.7 No negatividad

\[
x_{ij} \geq 0, \quad stock_j \geq 0, \quad perdida_j \geq 0
\]

### 10.8 Variables binarias

\[
y_{ij} \in \{0,1\}
\]

---

## 11. Algoritmos de teoría de grafos que debe incluir el sistema

### 11.1 Ruta óptima

El sistema debe calcular rutas óptimas entre nodos de la red. Para esto se pueden usar:

- **Dijkstra**, si todos los pesos de las rutas son no negativos.
- **Bellman-Ford**, si se desea permitir pesos modificados con penalizaciones o condiciones especiales.

La ruta óptima no debe entenderse únicamente como la ruta más corta en distancia. El peso de la ruta debe representar un costo logístico, por ejemplo:

\[
peso_{ij} = distancia_{ij} \cdot costoKm_{ij} \cdot combustible_{ij} + penalizaciones
\]

### 11.2 Flujo máximo

El sistema debe calcular la capacidad máxima de transporte entre zonas de origen y destino. Esto permite identificar si la red puede satisfacer toda la demanda.

Se puede usar un algoritmo de flujo máximo como:

- Ford-Fulkerson.
- Edmonds-Karp.

### 11.3 Cuellos de botella

Un cuello de botella aparece cuando una ruta, centro de acopio o capacidad limita el flujo total de la red. El sistema debe reportar:

- Ruta con mayor porcentaje de uso respecto a su capacidad.
- Centro de acopio más saturado.
- Supermercados en riesgo de incumplimiento.
- Aristas críticas que, si se cierran, aumentan demasiado el costo.

---

## 12. Diseño del algoritmo genético

### 12.1 Representación del cromosoma

Cada individuo del algoritmo genético puede representar una posible configuración de la red. Una forma práctica es dividir el cromosoma en bloques:

1. **Bloque de rutas activas**  
   Indica qué rutas se usan y cuáles no.

2. **Bloque de asignación origen-acopio**  
   Indica qué estaciones abastecen a qué centros de acopio.

3. **Bloque de asignación acopio-supermercado**  
   Indica qué centros de acopio abastecen a cada supermercado.

4. **Bloque de flujos aproximados**  
   Indica cantidades iniciales de toneladas asignadas a cada ruta.

Ejemplo conceptual:

```text
Individuo = [rutas_activas | asignaciones_origen_acopio | asignaciones_acopio_destino | flujos]
```

### 12.2 Función de aptitud

La función de aptitud debe evaluar qué tan buena es una solución. Debe premiar costos bajos y penalizar incumplimientos.

Componentes recomendados:

- Costo total de transporte.
- Costo operativo de centros de acopio.
- Penalización por superar capacidades.
- Penalización por no cumplir demanda.
- Penalización por usar nodos con baja calidad.
- Penalización por congestión o cuello de botella.
- Penalización por rutas cerradas o de alto riesgo.

Una estructura posible es:

\[
Fitness = CostoTotal + P_1ViolacionDemanda + P_2ViolacionCapacidad + P_3FallaCalidad + P_4Congestion
\]

Como se busca minimizar, el mejor individuo será el que tenga menor valor de fitness.

### 12.3 Operadores genéticos

El algoritmo puede usar:

- **Selección por torneo**: compara varios individuos y escoge los mejores.
- **Cruce**: combina partes de dos soluciones para crear una nueva.
- **Mutación**: cambia rutas, asignaciones o flujos para explorar nuevas soluciones.
- **Elitismo**: conserva las mejores soluciones de una generación a otra.
- **Reparación de individuos**: corrige soluciones que violan restricciones antes de evaluarlas o después de mutarlas.

### 12.4 Reparación de soluciones

Debido a que el problema tiene restricciones fuertes, algunas soluciones generadas por cruce o mutación pueden ser inválidas. Por eso se recomienda implementar una función de reparación que:

- Reduzca flujos que superan capacidades.
- Reasigne demanda faltante a rutas disponibles.
- Elimine rutas cerradas.
- Evite nodos con falla crítica de calidad.
- Ajuste flujos negativos o inconsistentes.

---

## 13. Diseño del método de gradiente

El método de gradiente debe aplicarse después de obtener una buena solución estructural con el algoritmo genético.

### 13.1 Variables sobre las que puede actuar

El gradiente puede actuar sobre variables continuas como:

- Cantidad enviada por ruta.
- Porcentaje de demanda atendida por cada acopio.
- Redistribución de toneladas entre rutas disponibles.
- Ajuste del flujo para reducir costos marginales.

### 13.2 Función a minimizar

Puede usarse una función de costo continua derivada de la solución genética:

\[
f(x) = \sum_{(i,j) \in E'} costo_{ij}x_{ij} + penalizaciones
\]

Donde \(E'\) es el subconjunto de rutas seleccionadas por el algoritmo genético.

### 13.3 Gradiente proyectado

Como existen restricciones, el gradiente no puede mover la solución libremente. Cada ajuste debe proyectarse al conjunto factible:

- No permitir flujos negativos.
- No superar capacidad de rutas.
- No superar capacidad de acopios.
- Mantener demanda exacta.

La lógica sería:

```text
1. Tomar solución del algoritmo genético.
2. Calcular el costo actual.
3. Calcular dirección de mejora mediante gradiente.
4. Ajustar flujos en pequeña magnitud.
5. Proyectar la solución para respetar restricciones.
6. Repetir hasta que el costo no mejore significativamente.
```

---

## 14. Datos que debe permitir cargar el sistema

La aplicación debe permitir carga dinámica de datos. Como mínimo, debe poder leer o editar:

### 14.1 Datos de nodos

| Campo | Descripción |
|---|---|
| id_nodo | Identificador único del nodo. |
| nombre | Nombre de estación, acopio o supermercado. |
| tipo | Origen, acopio o supermercado. |
| municipio | Municipio donde se ubica. |
| departamento | Departamento donde se ubica. |
| latitud | Coordenada geográfica. |
| longitud | Coordenada geográfica. |
| oferta | Solo para estaciones. |
| demanda | Solo para supermercados. |
| capacidad | Solo para centros de acopio. |
| calidad | Estado o indicador de calidad. |

### 14.2 Datos de rutas

| Campo | Descripción |
|---|---|
| origen | Nodo inicial de la ruta. |
| destino | Nodo final de la ruta. |
| distancia_km | Distancia aproximada. |
| costo_km | Costo por kilómetro. |
| costo_tonelada | Costo por tonelada. |
| capacidad | Capacidad máxima de transporte. |
| activa | Indica si la ruta está disponible. |
| riesgo | Nivel de riesgo logístico o de cierre. |

### 14.3 Datos de escenarios

| Campo | Descripción |
|---|---|
| nombre_escenario | Nombre del escenario de análisis. |
| incremento_combustible | Porcentaje de aumento de combustible. |
| rutas_cerradas | Lista de aristas eliminadas temporalmente. |
| nodos_falla_calidad | Centros de acopio afectados. |
| variacion_demanda | Aumento o reducción de demanda. |
| observacion | Descripción del caso evaluado. |

---

## 15. Requerimientos funcionales

### RF-01. Carga dinámica de datos

El sistema debe permitir cargar nodos, rutas, costos, capacidades y demandas desde archivos o formularios.

### RF-02. Visualización de la red logística

El sistema debe mostrar la red como un grafo geográfico, ubicando los nodos sobre el mapa según sus coordenadas.

### RF-03. Cálculo de ruta óptima

El sistema debe calcular rutas óptimas entre nodos seleccionados usando pesos relacionados con costo logístico.

### RF-04. Optimización mediante algoritmo genético

El sistema debe generar y evaluar múltiples configuraciones de red mediante algoritmo genético.

### RF-05. Ajuste mediante gradiente

El sistema debe mejorar la solución obtenida por el algoritmo genético mediante un ajuste local de flujos continuos.

### RF-06. Verificación de restricciones

El sistema debe validar que las soluciones respeten oferta, demanda, capacidades, calidad y disponibilidad de rutas.

### RF-07. Análisis de cuellos de botella

El sistema debe identificar rutas o nodos que estén saturados o que limiten el flujo total.

### RF-08. Análisis de sensibilidad

El sistema debe permitir modificar variables y observar cómo cambian costos, ganancias, rutas y cuellos de botella.

### RF-09. Reporte de resultados

El sistema debe generar resultados interpretables, incluyendo:

- Ruta óptima.
- Costo total.
- Ganancia proyectada.
- Rutas usadas.
- Rutas saturadas.
- Centros de acopio críticos.
- Comparación entre escenario base y escenarios modificados.

### RF-10. Visualización diferenciada por algoritmo

El sistema debe distinguir visualmente qué rutas fueron seleccionadas o mejoradas por cada enfoque:

- GA: algoritmo genético.
- GD: método de gradiente.
- Rutas saturadas o críticas.

---

## 16. Requerimientos no funcionales

### RNF-01. Claridad matemática

El proyecto debe documentar claramente variables, parámetros, restricciones, función objetivo y criterios de evaluación.

### RNF-02. Interpretabilidad

El usuario debe poder entender por qué una ruta fue seleccionada y qué factores influyeron en el resultado.

### RNF-03. Interfaz limpia

La interfaz debe ser visualmente clara, sin sobrecargar al usuario con elementos innecesarios del mapa.

### RNF-04. Modularidad

El código debe estar separado por responsabilidades:

- Carga de datos.
- Construcción del grafo.
- Modelo matemático.
- Algoritmo genético.
- Gradiente.
- Análisis de sensibilidad.
- Visualización.

### RNF-05. Escalabilidad académica

El sistema debe permitir trabajar con diferentes cantidades de supermercados, rutas y centros de acopio sin reescribir toda la lógica.

### RNF-06. Trazabilidad

El sistema debe mostrar el proceso de cálculo o al menos los indicadores necesarios para justificar el resultado en el informe.

---

## 17. Requerimientos visuales de la interfaz

La parte visual debe representar geográficamente la red, pero sin mostrar demasiados elementos del mapa.

### 17.1 Lo que se desea visualizar

- Departamento o zona geográfica general.
- Nodos pequeños sobre el mapa.
- Rutas entre nodos.
- Diferenciación entre estaciones, acopios y supermercados.
- Rutas seleccionadas por el algoritmo.
- Cuellos de botella.
- Panel lateral con análisis de sensibilidad.
- Panel de resultados.

### 17.2 Lo que no se desea visualizar

No se desea un mapa cargado con:

- Calles detalladas.
- Ríos.
- Tiendas.
- Hoteles.
- Restaurantes.
- Nombres excesivos.
- Marcadores comerciales.
- Información urbana innecesaria.

### 17.3 Estilo visual deseado

La interfaz debe parecerse a una herramienta de análisis logístico, no a un mapa turístico. Se recomienda:

- Mapa oscuro o gris neutro.
- Pocos colores, usados con intención.
- Nodos circulares pequeños.
- Líneas suaves para rutas.
- Paneles laterales semitransparentes.
- Leyenda clara.
- Indicadores de GA, GD y cuellos de botella.
- Diseño limpio, serio y técnico.

### 17.4 Opciones para el mapa

Para evitar exceso de información visual, se puede usar una de estas estrategias:

1. **Mapa con estilo personalizado**  
   Usar una API de mapas que permita ocultar puntos de interés, carreteras secundarias, comercios, hoteles, ríos y etiquetas innecesarias.

2. **Mapa base simplificado**  
   Usar únicamente contornos departamentales o municipales y ubicar los nodos encima.

3. **Grafo georreferenciado sin mapa detallado**  
   Dibujar los nodos con latitud y longitud sobre un fondo geográfico simple, sin necesidad de mostrar una cartografía completa.

La opción más recomendable para el proyecto es una visualización geográfica simplificada: suficiente para entender dónde está cada nodo, pero sin distraer al usuario de la optimización.

---

## 18. Escenarios mínimos de análisis de sensibilidad

El enunciado exige analizar al menos tres escenarios críticos. Se proponen los siguientes:

### Escenario 1. Aumento del combustible en rutas del Meta

**Pregunta:** ¿Qué sucede si el costo del combustible sube un 15% en las rutas del Meta?

Variables afectadas:

- \(combustible_{ij}\)
- \(costo_{ij}\)
- Costo total de transporte
- Ganancia proyectada

Resultados esperados:

- Incremento del costo total.
- Posible cambio de rutas óptimas.
- Mayor uso de rutas alternativas si son más económicas.
- Identificación de rutas altamente sensibles al combustible.

### Escenario 2. Cierre de una vía principal

**Pregunta:** ¿Cómo afecta el cierre de una vía principal a la ganancia total?

Variables afectadas:

- Disponibilidad de aristas.
- Rutas alternativas.
- Capacidad residual de la red.
- Tiempo o costo de desvío.

Resultados esperados:

- Recalcular rutas sin la arista cerrada.
- Comparar costo antes y después.
- Detectar si la demanda aún puede cumplirse.
- Identificar nuevos cuellos de botella.

### Escenario 3. Pérdida de calidad en un centro de acopio

**Pregunta:** ¿Cuál es el impacto de una pérdida masiva de calidad en un centro de acopio específico?

Variables afectadas:

- \(calidad_j\)
- \(capacidad_j\)
- \(penalizacion_j\)
- \(perdida_j\)

Resultados esperados:

- Detener o penalizar el flujo por ese nodo.
- Redirigir producto hacia otros centros.
- Medir aumento de costos.
- Medir posible pérdida de ganancia.
- Identificar si la red depende excesivamente de ese acopio.

---

## 19. Indicadores que debe mostrar el sistema

El sistema debe mostrar indicadores claros para interpretar los resultados.

| Indicador | Descripción |
|---|---|
| Costo total de transporte | Suma de costos logísticos de las rutas usadas. |
| Ganancia proyectada | Ingresos estimados menos costos totales. |
| Porcentaje de demanda cumplida | Medida de cumplimiento de supermercados. |
| Rutas activas | Rutas seleccionadas por la optimización. |
| Ruta óptima | Mejor camino según costo logístico. |
| Nodo más crítico | Nodo que más afecta el resultado. |
| Ruta más saturada | Arista con mayor uso respecto a su capacidad. |
| Pérdida por calidad | Costo o toneladas afectadas por fallos de calidad. |
| Impacto del escenario | Diferencia entre escenario base y escenario modificado. |

---

## 20. Estructura técnica sugerida del proyecto

Una estructura inicial en Python podría ser:

```text
proyecto_optimizacion/
│
├── data/
│   ├── nodos.csv
│   ├── rutas.csv
│   └── escenarios.csv
│
├── src/
│   ├── main.py
│   ├── data_loader.py
│   ├── graph_builder.py
│   ├── mathematical_model.py
│   ├── genetic_algorithm.py
│   ├── gradient_optimizer.py
│   ├── graph_algorithms.py
│   ├── sensitivity_analysis.py
│   ├── visualization.py
│   └── report_generator.py
│
├── app/
│   ├── interface.py
│   └── map_view.py
│
├── reports/
│   └── resultados.md
│
└── README.md
```

### 20.1 Responsabilidad de cada módulo

| Módulo | Responsabilidad |
|---|---|
| data_loader.py | Cargar nodos, rutas y escenarios. |
| graph_builder.py | Construir el grafo dirigido ponderado. |
| mathematical_model.py | Definir variables, costos y restricciones. |
| genetic_algorithm.py | Ejecutar el algoritmo genético. |
| gradient_optimizer.py | Ajustar flujos mediante gradiente. |
| graph_algorithms.py | Calcular rutas óptimas y flujo máximo. |
| sensitivity_analysis.py | Ejecutar escenarios What-if. |
| visualization.py | Dibujar grafo, rutas, nodos y resultados. |
| report_generator.py | Generar tablas y resumen de resultados. |
| interface.py | Gestionar la interacción con el usuario. |

---

## 21. Librerías posibles para Python

El proyecto puede apoyarse en librerías como:

| Librería | Uso posible |
|---|---|
| pandas | Carga y manipulación de datos. |
| numpy | Cálculo numérico. |
| networkx | Construcción de grafos, rutas y flujo máximo. |
| scipy.optimize | Métodos de optimización y gradiente. |
| matplotlib o plotly | Visualización de resultados. |
| folium, ipyleaflet, pydeck o maplibre | Visualización geográfica. |
| streamlit, dash o PySide/PyQt | Interfaz de usuario. |

La selección final depende del tipo de aplicación que se quiera entregar: web simple, escritorio o prototipo interactivo.

---

## 22. Recomendación de alcance inicial

Para evitar que el proyecto se vuelva demasiado grande, se recomienda construir primero una versión mínima funcional con:

1. 6 estaciones.
2. 10 centros de acopio.
3. 25 supermercados.
4. Rutas cargadas desde archivo.
5. Costo calculado por distancia, tonelada y combustible.
6. Algoritmo de ruta óptima.
7. Algoritmo genético funcional.
8. Ajuste simple con gradiente.
9. Visualización geográfica simplificada.
10. Tres escenarios de sensibilidad.
11. Reporte comparativo de resultados.

Cuando esta versión funcione, se pueden agregar mejoras visuales o más indicadores.

---

## 23. Prioridad del desarrollo

La prioridad debe ser la siguiente:

1. Formular correctamente el modelo matemático.
2. Definir datos de entrada realistas.
3. Construir el grafo dirigido ponderado.
4. Implementar restricciones.
5. Implementar ruta óptima y flujo máximo.
6. Implementar algoritmo genético.
7. Implementar ajuste por gradiente.
8. Implementar análisis de sensibilidad.
9. Construir visualización geográfica simple.
10. Mejorar diseño visual.
11. Generar reporte de resultados.

---

## 24. Riesgos del proyecto

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Dar más importancia a la interfaz que a la matemática | Alto | Priorizar modelo, restricciones y algoritmos. |
| Usar gradiente de forma incorrecta | Alto | Aplicarlo solo a variables continuas y como mejora local. |
| Generar soluciones inválidas en el algoritmo genético | Alto | Implementar penalizaciones y reparación de individuos. |
| Mapa demasiado cargado visualmente | Medio | Usar estilo geográfico simplificado. |
| Datos poco realistas | Alto | Construir datos coherentes con capacidades, demandas y costos. |
| No justificar resultados | Alto | Mostrar indicadores, restricciones activas y comparación de escenarios. |
| No cumplir demanda exacta | Alto | Validar demanda después de cada solución. |

---

## 25. Resultado esperado del proyecto

Al finalizar, se espera tener un software que permita:

- Cargar una red logística de Acuícola Real del Meta.
- Visualizar nodos y rutas de forma geográfica y limpia.
- Calcular rutas óptimas.
- Determinar costos y ganancias proyectadas.
- Optimizar decisiones importantes mediante algoritmo genético.
- Ajustar flujos mediante método de gradiente.
- Identificar cuellos de botella.
- Evaluar escenarios críticos.
- Generar resultados comprensibles para el informe final.

---

## 26. Ideas pendientes por definir

Antes de iniciar completamente la programación, conviene definir:

1. Qué municipios exactos serán estaciones de producción.
2. Qué ciudades serán centros de acopio.
3. Cuántos supermercados se usarán exactamente.
4. Si habrá rutas directas estación-supermercado o todo pasará por acopios.
5. Cómo se calculará el precio de venta por tonelada.
6. Qué porcentaje de merma se asumirá en cada acopio.
7. Cómo se medirá la calidad del producto.
8. Qué ruta será considerada vía principal para el escenario de cierre.
9. Qué interfaz se usará: web, escritorio o notebook interactivo.
10. Qué librería de mapas se usará para lograr una visualización limpia.

---

## 27. Conclusión inicial

El proyecto debe presentarse como una solución de optimización logística basada en programación lineal, teoría de grafos y algoritmos híbridos. La parte más importante será demostrar que el modelo respeta restricciones reales: oferta, demanda, capacidad, calidad, costos y flujo.

La interfaz debe ser sencilla y geográfica, mostrando nodos y rutas sobre una base visual limpia. No es necesario mostrar calles, ríos o lugares comerciales. El mapa debe funcionar como apoyo visual para entender la red, no como el centro del proyecto.

El enfoque recomendado es usar el algoritmo genético para encontrar configuraciones logísticas de alto impacto y luego usar el gradiente para ajustar cantidades de flujo dentro de la estructura seleccionada. De esta manera, el proyecto puede justificar tanto la parte matemática como la parte algorítmica exigida.
