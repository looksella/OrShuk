// ============================================================
// apps/web/src/hooks/usar-escaner.ts
// ============================================================
// Un escaner de codigo de barras USB se comporta como un teclado:
// "teclea" los digitos muy rapido y termina con Enter. Esto lo
// distingue de una persona escribiendo, midiendo la velocidad
// entre pulsaciones.
//
// Sirve para la pantalla del POS (Semana 4) y tambien para el
// campo de codigo de barras del formulario de producto.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';

type Opciones = {
  // Se dispara cuando se detecta un codigo completo
  alEscanear: (codigo: string) => void;
  // Milisegundos maximos entre teclas para considerarlo escaner.
  // Una persona rara vez baja de 50 ms; un escaner ronda los 10.
  umbralMs?: number;
  // Largo minimo del codigo para tomarlo en serio
  largoMinimo?: number;
  activo?: boolean;
};

export function usarEscaner({
  alEscanear,
  umbralMs = 35,
  largoMinimo = 6,
  activo = true,
}: Opciones) {
  const buffer = useRef('');
  const ultimaTecla = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiar = useCallback(() => {
    buffer.current = '';
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
  }, []);

  useEffect(() => {
    if (!activo) return;

    function alPresionar(e: KeyboardEvent) {
      const objetivo = e.target as HTMLElement | null;

      // Si el usuario esta escribiendo en un campo de texto que
      // no es el buscador del POS, no interceptamos nada.
      const enCampo = objetivo?.tagName === 'INPUT'
        || objetivo?.tagName === 'TEXTAREA'
        || objetivo?.isContentEditable;
      const esBuscadorPos = objetivo?.getAttribute('data-escaner') === 'true';

      if (enCampo && !esBuscadorPos) return;

      const ahora = Date.now();
      const intervalo = ahora - ultimaTecla.current;
      ultimaTecla.current = ahora;

      // Enter cierra la lectura
      if (e.key === 'Enter') {
        const codigo = buffer.current.trim();
        limpiar();
        if (codigo.length >= largoMinimo) {
          e.preventDefault();
          alEscanear(codigo);
        }
        return;
      }

      // Solo caracteres imprimibles de un digito
      if (e.key.length !== 1) return;

      // Pausa larga = empezo una lectura nueva
      if (intervalo > umbralMs && buffer.current.length > 0) {
        buffer.current = '';
      }

      buffer.current += e.key;

      // Red de seguridad: algunos escaneres no mandan Enter.
      // Si pasa el umbral sin mas teclas, se procesa lo acumulado.
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        const codigo = buffer.current.trim();
        limpiar();
        if (codigo.length >= largoMinimo) alEscanear(codigo);
      }, umbralMs * 4);
    }

    window.addEventListener('keydown', alPresionar);
    return () => {
      window.removeEventListener('keydown', alPresionar);
      limpiar();
    };
  }, [activo, alEscanear, umbralMs, largoMinimo, limpiar]);

  return { limpiar };
}

// ------------------------------------------------------------
// Ejemplo de uso en la pantalla del POS
// ------------------------------------------------------------
//
//   const [items, setItems] = useState([]);
//
//   usarEscaner({
//     alEscanear: async (codigo) => {
//       const encontrados = await buscarProductos(codigo);
//       if (encontrados.length === 1) {
//         agregarAlCarrito(encontrados[0]);
//         reproducirBip();
//       } else {
//         mostrarAviso(`Codigo ${codigo} no registrado`);
//       }
//     },
//   });
//
// En el input del buscador, poner data-escaner="true" para que
// el hook siga funcionando aunque el campo tenga el foco.
