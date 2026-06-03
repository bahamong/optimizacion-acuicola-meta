// Archivo: frontend/src/components/Sidebar.jsx
import { useState, useEffect } from "react";
import {
  FaDatabase,
  FaMapMarkedAlt,
  FaFish,
  FaExclamation,
} from "react-icons/fa";

const ITEMS = [
  { id: "datos", icono: FaDatabase, label: "Datos de la Red" },
  { id: "mapa", icono: FaMapMarkedAlt, label: "Visualización y Evaluación" },
];

const LS_KEY = "sidebar-colapsada";

export default function Sidebar({ vistaActual, onCambiar, sincronizado }) {
  const [colapsada, setColapsada] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, String(colapsada));
    } catch {
      /* ignore */
    }
  }, [colapsada]);

  return (
    <nav
      className={`
        flex flex-col flex-shrink-0 min-h-screen bg-indigo-950
        shadow-[2px_0_10px_rgba(0,0,0,0.2)] transition-[width] duration-200
        ${colapsada ? "w-[60px]" : "w-[210px]"}
      `}
    >
      {/* Logo / Toggle — el ícono del pescado ES el botón que abre/cierra */}
      <div
        className={`
          flex items-center border-b border-white/10 relative
          ${colapsada ? "justify-center px-0 py-5" : "gap-3 px-4 py-5"}
        `}
      >
        <button
          onClick={() => setColapsada((c) => !c)}
          title={colapsada ? "Expandir menú" : "Contraer menú"}
          className="flex items-center gap-3 focus:outline-none group"
        >
          <FaFish className="text-[1.8rem] text-indigo-300 flex-shrink-0 group-hover:text-indigo-100 transition-colors" />
          {!colapsada && (
            <div className="text-left">
              <p className="text-[0.95rem] font-extrabold text-white leading-tight">
                Acuícola
              </p>
              <p className="text-[0.68rem] text-white/50">Real del Meta</p>
            </div>
          )}
        </button>
      </div>

      {/* Menú de navegación */}
      <ul className="list-none p-0 py-3 flex-1">
        {ITEMS.map((item) => {
          const Icono = item.icono;
          return (
            <li key={item.id}>
              <button
                className={`
                  w-full flex items-center border-none text-[0.85rem] font-medium
                  cursor-pointer text-left transition-all duration-150 relative
                  ${colapsada ? "justify-center px-0 py-3" : "gap-3 px-4 py-3"}
                  ${
                    vistaActual === item.id
                      ? "bg-indigo-500/25 text-indigo-300 border-l-[3px] border-indigo-500 font-bold"
                      : "bg-transparent text-white/60 hover:bg-white/[0.08] hover:text-white"
                  }
                `}
                onClick={() => onCambiar(item.id)}
                title={colapsada ? item.label : undefined}
              >
                <Icono className="text-[1.1rem] flex-shrink-0" />
                {!colapsada && <span className="flex-1">{item.label}</span>}
                {item.id === "mapa" && !sincronizado && (
                  <span
                    className="bg-red-500 text-white rounded-full w-[18px] h-[18px] flex items-center justify-center text-[0.7rem] font-extrabold flex-shrink-0"
                    title="Aplica los datos primero"
                  >
                    <FaExclamation />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      {!colapsada && (
        <div className="px-4 py-3 border-t border-white/10 text-[0.68rem] text-white/30 leading-relaxed">
          <p>Optimización Logística</p>
          <p>Optimización por Grafos</p>
        </div>
      )}
    </nav>
  );
}
