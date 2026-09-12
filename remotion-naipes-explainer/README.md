# Naipes Explainer (Remotion)

Video explicativo del script `naipes.py` (juego de naipes con ganancias
aleatorias), animado con [Remotion](https://www.remotion.dev/), basado en el
guion de `Explicacion_con_Python.pdf`.

## Estructura

- `src/data/code.ts` — el código fuente exacto que se muestra en pantalla.
- `src/data/script.ts` — las 9 secciones del guion (narración, líneas de
  código resaltadas por sección, y qué partes de la carta/resultado se
  revelan en cada una).
- `src/components/CodeBlock.tsx` — panel de código con resaltado de sintaxis
  simple y highlight animado de las líneas activas.
- `src/components/PlayingCard.tsx` — la carta animada + panel de ganancias
  acumuladas (color, pinta, valor, total).
- `src/components/Scene.tsx` — layout de cada escena (código + carta +
  subtítulo).
- `src/components/DemoScene.tsx` — escena final: "terminal" simulando 3
  ejecuciones en vivo del script.
- `src/NaipesExplainer.tsx` / `src/Root.tsx` — composición principal.

## Cómo agregar el audio real de narración

1. Genera o graba un `.mp3` por sección (puedes usar el texto exacto de
   `narration` en `src/data/script.ts` como guion de grabación).
2. Guárdalo en `public/audio/` con el nombre indicado en `audioFile` de esa
   sección (ej. `public/audio/01-import.mp3`).
3. Agrega el `id` de la sección al set `AVAILABLE_AUDIO_IDS` en
   `src/components/Scene.tsx`.
4. Listo: `calculateMetadata` en `src/Root.tsx` detecta el archivo, mide su
   duración real y re-sincroniza automáticamente la duración de esa escena
   (y del video completo). Mientras un id no esté en ese set, la escena usa
   una duración estimada por conteo de palabras, sin audio.

## Uso

```bash
npm install
npm start          # abre Remotion Studio (previsualización + timeline)
npm run build       # renderiza out/naipes-explainer.mp4
```

## Pendiente para el video final

- [ ] Generar/subir los 9 audios de narración (ver arriba).
- [ ] Revisar el timing de cada escena una vez esté el audio real.
- [ ] (Opcional) Reemplazar el naipe de ejemplo fijo (`EXAMPLE_CARD` en
      `script.ts`) si quieres que coincida con una corrida específica.
