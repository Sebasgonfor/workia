// Guion del video (basado en Explicacion_con_Python.pdf), dividido en las
// mismas 9 secciones del documento. Cada sección define:
//  - narration: el texto exacto que se debe grabar/generar como audio
//  - audioFile: ruta esperada dentro de public/audio (staticFile) — cuando
//    ese archivo exista, su duración real gobierna el timing de la escena;
//    si no existe todavía, se usa `estimateSeconds` como respaldo.
//  - highlightLines: líneas de code.ts (1-indexado) resaltadas en pantalla
//  - reveal: qué partes de la carta/resultado deben estar visibles al final
//    de esta escena (los reveals son acumulativos entre escenas).

export type Reveal = {
  card: boolean; // se muestra la carta (pinta + valor)
  color: boolean; // se muestra el color (Roja/Negra) y su ganancia
  pintaGain: boolean; // se suma la ganancia por pinta
  valueGain: boolean; // se suma la ganancia por valor
  total: boolean; // se muestra el total final resaltado
};

export type Section = {
  id: string;
  title: string;
  narration: string;
  audioFile: string;
  highlightLines: number[];
  reveal: Reveal;
};

// Estimación de respaldo: ~2.4 palabras/seg en español hablado a ritmo de
// tutorial, + 1.2s de aire al inicio y al final de cada escena.
export const estimateSeconds = (text: string): number => {
  const words = text.trim().split(/\s+/).length;
  return Math.max(3.5, words / 2.4 + 1.6);
};

const noReveal: Reveal = {
  card: false,
  color: false,
  pintaGain: false,
  valueGain: false,
  total: false,
};

export const SECTIONS: Section[] = [
  {
    id: 'import',
    title: 'Importación del módulo',
    narration:
      'Primero importamos el módulo random, que nos permite generar valores aleatorios. Lo vamos a usar para simular que se levanta un naipe al azar.',
    audioFile: 'audio/01-import.mp3',
    highlightLines: [1],
    reveal: {...noReveal},
  },
  {
    id: 'listas',
    title: 'Definición de las listas',
    narration:
      'Aquí definimos dos listas: una con las cuatro pintas de la baraja, y otra con los trece valores posibles de un naipe, desde el 2 hasta el As. Están escritos como texto porque después los vamos a comparar como cadenas.',
    audioFile: 'audio/02-listas.mp3',
    highlightLines: [3, 4],
    reveal: {...noReveal},
  },
  {
    id: 'elegir',
    title: 'Elegir pinta y valor al azar',
    narration:
      'Con random.choice() elegimos un elemento al azar de cada lista. Así obtenemos una pinta aleatoria y un valor aleatorio, simulando que se levantó un naipe.',
    audioFile: 'audio/03-elegir.mp3',
    highlightLines: [6, 7],
    reveal: {...noReveal, card: true},
  },
  {
    id: 'total-inicial',
    title: 'Inicializar el total',
    narration:
      'Creamos la variable total en cero, donde vamos a ir acumulando el dinero ganado según las reglas del juego.',
    audioFile: 'audio/04-total-inicial.mp3',
    highlightLines: [9],
    reveal: {...noReveal, card: true},
  },
  {
    id: 'color',
    title: 'Ganancia por color',
    narration:
      'Aquí preguntamos si la pinta es Diamante o Corazón, que son las pintas rojas de la baraja. Si es así, el color es "Roja" y se ganan $25,000. Si no, el naipe es negro —Pica o Trébol— y se ganan $5,000.',
    audioFile: 'audio/05-color.mp3',
    highlightLines: [14, 15, 16, 17, 18, 19, 20],
    reveal: {...noReveal, card: true, color: true},
  },
  {
    id: 'ganancia-pinta',
    title: 'Ganancia por pinta',
    narration:
      'Creamos un diccionario que asocia cada pinta con su ganancia correspondiente. Luego, usando la pinta que salió, buscamos directamente su valor en el diccionario y lo sumamos al total. Es una forma más corta de hacer varias comparaciones sin escribir muchos "if".',
    audioFile: 'audio/06-ganancia-pinta.mp3',
    highlightLines: [24, 25, 26, 27, 28, 29, 30, 31],
    reveal: {...noReveal, card: true, color: true, pintaGain: true},
  },
  {
    id: 'ganancia-valor',
    title: 'Ganancia por valor del naipe',
    narration:
      'Ahora revisamos el valor del naipe. Primero comprobamos si está entre 2 y 10 usando una lista generada con range(), y si es así, se suman $3,000. Luego, con una cadena de "elif", revisamos si es J, Q, K o As, cada uno con su ganancia distinta.',
    audioFile: 'audio/07-ganancia-valor.mp3',
    highlightLines: [33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43],
    reveal: {
      card: true,
      color: true,
      pintaGain: true,
      valueGain: true,
      total: false,
    },
  },
  {
    id: 'resultados',
    title: 'Mostrar resultados',
    narration:
      'Finalmente, imprimimos el naipe exacto que salió —su valor, pinta y color— y el total de dinero ganado. El :, dentro del f-string sirve para mostrar el número con separador de miles, para que se vea más claro, como $25,000 en vez de 25000.',
    audioFile: 'audio/08-resultados.mp3',
    highlightLines: [45, 46],
    reveal: {card: true, color: true, pintaGain: true, valueGain: true, total: true},
  },
  {
    id: 'demo',
    title: 'Demostración en vivo',
    narration:
      'Y ahora, para comprobar que el código funciona correctamente, lo vamos a ejecutar tres veces en directo y veremos que cada vez arroja un naipe distinto con su ganancia total calculada automáticamente.',
    audioFile: 'audio/09-demo.mp3',
    highlightLines: [],
    reveal: {card: true, color: true, pintaGain: true, valueGain: true, total: true},
  },
];

// Naipe de ejemplo usado en las escenas 3 a 8 para ilustrar el cálculo.
export const EXAMPLE_CARD = {
  pinta: 'Diamante' as const,
  valor: 'Q' as const,
  color: 'Roja' as const,
  colorGain: 25000,
  pintaGain: 4000,
  valueGain: 5000,
};

// Tres corridas distintas para la demo en vivo final.
export const DEMO_RUNS = [
  {pinta: 'Trebol', valor: '7', color: 'Negra', total: 5000 + 3000 + 3000},
  {pinta: 'Corazon', valor: 'As', color: 'Roja', total: 25000 + 5000 + 10000},
  {pinta: 'Pica', valor: 'K', color: 'Negra', total: 5000 + 2000 + 6000},
] as const;
