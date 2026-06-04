import unittest

from algoritmos.optimizador_grafo import OptimizadorGrafo
from grafos.dijkstra import DijkstraCalculator
from grafos.generador_aristas import generar_aristas_automaticas
from models.grafo import GrafoRed
from models.nodo import Nodo, TipoNodo


class GrafoAutomaticoTest(unittest.TestCase):
    def _grafo_base(self):
        grafo = GrafoRed()
        for nodo in [
            Nodo("O1", TipoNodo.ORIGEN, "Origen 1", "", "", 4.0, -73.0, 100, oferta=100),
            Nodo("O2", TipoNodo.ORIGEN, "Origen 2", "", "", 4.2, -73.1, 100, oferta=100),
            Nodo("A1", TipoNodo.ACOPIO, "Acopio 1", "", "", 4.1, -73.05, 10),
            Nodo("D1", TipoNodo.DESTINO, "Destino 1", "", "", 4.12, -73.08, 100, demanda=30),
        ]:
            grafo.agregar_nodo(nodo)
        return grafo

    def test_genera_rutas_validas_y_respeta_bloqueo_manual(self):
        grafo = self._grafo_base()
        generar_aristas_automaticas(
            grafo,
            [{"id_origen": "O1", "id_destino": "A1", "estado": "bloqueada"}],
        )

        self.assertIsNone(grafo.obtener_arista("O1", "A1"))
        self.assertIsNotNone(grafo.obtener_arista("O2", "A1"))
        self.assertIsNotNone(grafo.obtener_arista("A1", "D1"))
        self.assertIsNone(grafo.obtener_arista("O1", "D1"))
        self.assertTrue(grafo.obtener_arista("O2", "A1").generada_automaticamente)

    def test_dijkstra_evalua_cadena_automatica_con_solo_destino(self):
        grafo = self._grafo_base()
        generar_aristas_automaticas(grafo, [])

        resultado = DijkstraCalculator(grafo).mejor_cadena_hacia_destino("D1")

        self.assertTrue(resultado["existe"])
        self.assertEqual(resultado["destino"], "D1")
        self.assertEqual(resultado["acopio_intermedio"], "A1")
        self.assertEqual(len(resultado["ruta"]), 3)
        self.assertGreater(resultado["distancia_total"], 0)
        self.assertGreater(resultado["aristas_generadas_automaticamente"], 0)

    def test_optimizador_respeta_capacidad_de_acopio(self):
        grafo = self._grafo_base()
        generar_aristas_automaticas(grafo, [])

        resultado = OptimizadorGrafo(grafo).ejecutar()
        flujo_entregado = sum(
            flujo
            for ruta, flujo in resultado["flujos"].items()
            if ruta.endswith("\u2192D1")
        )

        self.assertLessEqual(flujo_entregado, 10)
        self.assertEqual(resultado["modelo_capacidad_acopio"], "nodo partido: acopio__in -> acopio__out")


if __name__ == "__main__":
    unittest.main()
