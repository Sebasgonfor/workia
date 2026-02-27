# Plan: Soporte Desktop y Tablet para Workia

## Estado Actual
- App 100% mobile-first, contenedor fijo de 512px (`max-w-lg`)
- Navegación bottom-tab con 5+5 tabs
- Modales tipo bottom-sheet deslizantes
- Grids de 2-3 columnas fijas
- Calendario con columnas de 76px fijas

## Breakpoints a usar
- **`md` (768px)** — Tablets
- **`lg` (1024px)** — Escritorio
- **`xl` (1280px)** — Pantallas grandes

---

## Paso 1: Layout raíz y contenedor global

**Archivo:** `src/app/layout.tsx`

- Quitar `max-w-lg` del `<main>` y reemplazar con un sistema responsive:
  - Mobile: sigue siendo full-width con padding
  - `md+`: el contenido se centra con `max-w-6xl` y se deja espacio para sidebar
- El `<body>` ya no limita a 512px

**Cambio concreto:**
```tsx
// Antes
<main className="mx-auto max-w-lg min-h-screen">{children}</main>

// Después — el contenedor ahora es flexible
<main className="min-h-screen">{children}</main>
```

El ancho máximo se controlará por cada componente de layout (AppShell + Sidebar).

---

## Paso 2: Navegación — Sidebar para desktop, BottomNav para mobile

**Archivos:** `src/components/bottom-nav.tsx`, nuevo `src/components/sidebar-nav.tsx`, `src/components/app-shell.tsx`

### 2a. Crear `SidebarNav` (nuevo componente)
- Visible solo en `md+` (`hidden md:flex flex-col`)
- Barra lateral fija izquierda, ancho ~240px
- Logo "Workia" arriba
- Las 10 tabs (mainTabs + moreTabs) como links verticales con icono + label
- Foto + nombre del usuario abajo
- Estilo glassmorphic similar al bottom-nav actual

### 2b. Modificar `BottomNav`
- Agregar `md:hidden` para ocultarlo en pantallas grandes
- Sin otros cambios — sigue funcionando igual en mobile

### 2c. Modificar `AppShell`
- Envolver children en un layout flex:
  - `md+`: `<SidebarNav />` a la izquierda + contenido a la derecha
  - Mobile: sin cambio (children + BottomNav abajo)
- El área de contenido en desktop tendrá `max-w-4xl mx-auto` para no estirarse demasiado

```tsx
// Estructura conceptual del AppShell
<div className="md:flex md:min-h-screen">
  <SidebarNav className="hidden md:flex" />
  <div className="flex-1 md:ml-60">
    <div className="mx-auto max-w-lg md:max-w-4xl">
      {children}
    </div>
    <BottomNav className="md:hidden" />
  </div>
</div>
```

---

## Paso 3: Sheet → Dialog en desktop

**Archivo:** `src/components/ui/sheet.tsx`

- En mobile (`< md`): sigue siendo bottom-sheet (sin cambios)
- En desktop (`md+`): se convierte en un dialog/modal centrado
  - Max-width: 480px, centrado vertical y horizontalmente
  - Border-radius completo (no solo top)
  - Sin handle bar superior
  - Animación: scale + fade en vez de slide-from-bottom
  - Quitar la lógica de virtual keyboard adjustment en desktop

**Implementación:** Usar un wrapper condicional basado en CSS (`md:` classes) para cambiar el posicionamiento de `absolute bottom-0 left-0 right-0` a `relative max-w-md mx-auto top-1/2 -translate-y-1/2`.

---

## Paso 4: Página de Login (/)

**Archivo:** `src/app/page.tsx`

- Mobile: sin cambios (stacked vertical)
- Desktop (`md+`): layout de dos columnas
  - Izquierda: hero + features (visual/branding)
  - Derecha: botón de Google sign-in centrado
  - `max-w-5xl mx-auto` con `md:grid md:grid-cols-2 md:gap-12`

---

## Paso 5: Página Inicio (/inicio)

**Archivo:** `src/app/inicio/page.tsx`

- Quick Stats: `grid-cols-2` → `md:grid-cols-4` (4 stats en línea)
- Secciones de Tareas, Materias, Notas: layout en `md+` de 2 columnas
  - `md:grid md:grid-cols-2 md:gap-6` para las secciones
  - Tareas a la izquierda, Materias + Notas a la derecha
- Subject cards: `grid-cols-2` → `md:grid-cols-3 lg:grid-cols-4`

---

## Paso 6: Página Tareas (/tareas)

**Archivo:** `src/app/tareas/page.tsx`

- Header con stats: expandir a una fila completa en desktop
- Task groups: en desktop usar un grid de 2 columnas para los grupos
  - O mantener lista single-column pero con max-width
- Task cards: más anchos, pueden mostrar más info inline en desktop
  - La fecha relativa + prioridad + tipo se ven todos en la misma fila

---

## Paso 7: Página Materias (/materias)

**Archivo:** `src/app/materias/page.tsx`

- Subject cards: layout en grid responsive
  - Mobile: lista vertical (actual)
  - `md+`: `grid grid-cols-2 gap-3` (2 columnas)
  - `lg+`: `grid-cols-3` (3 columnas)

---

## Paso 7b: Página Clase / Apuntes (/materias/[id]/[classId])

**Archivo:** `src/app/materias/[id]/[classId]/page.tsx`, `src/components/dynamic-board-tab.tsx`

Esta es una de las páginas con más contenido y la que más se beneficia del espacio horizontal. Actualmente todo está en una sola columna estrecha.

### Tab "Apuntes" — Entry Cards en grid

- **Mobile:** lista vertical (`space-y-2.5`, una columna) — sin cambios
- **`md+`:** grid de 2 columnas para las entry cards
  - `md:grid md:grid-cols-2 md:gap-3`
  - Cada card (notas, recursos) se muestra en la misma estructura pero ocupa media pantalla
  - Los botones de "Flashcards" y "Quiz" dentro de cada card se mantienen inline
  - Cards de tipo `notes` con contenido largo pueden expandir su `line-clamp` de 4 a 6 líneas
- **`lg+`:** se puede considerar 3 columnas si hay muchas entradas
  - `lg:grid-cols-3`

### Tab "Apuntes" — Tasks de la clase

- Las task cards vinculadas a la clase (`classTasks`) pasan de stacked a grid 2 cols en desktop
  - `md:grid md:grid-cols-2 md:gap-2`

### Tab "Tablero" — Contenido dinámico AI

- **Mobile:** una sola columna con el contenido del tablero
- **`md+`:** el contenido del tablero dinámico (MarkdownMath) puede ocupar más ancho
  - El `p-4 rounded-2xl` actual se mantiene pero respira más
  - El action bar sticky del fondo se reposiciona: en vez de `fixed bottom-...`, se convierte en un panel lateral o un bar superior sticky
  - Los botones de Cámara/Galería/Importar se ponen en fila horizontal con más espacio

### Tab "Documentos"

- Los documentos de clase se ponen en grid de 2-3 columnas en desktop

### Reader View (cuando haces click en una nota)

- **Mobile:** se abre un Sheet (bottom slide) — sin cambios
- **`md+`:** se abre como un panel lateral derecho (side panel) o como un dialog más ancho (max-w-2xl)
  - Esto permite leer las notas con más espacio y el contenido Markdown/KaTeX se renderiza mejor

### Filtros

- Los filter chips (Todo, Apuntes, Tareas, Recursos) se mantienen en una fila, pero con más padding en desktop

---

## Paso 8: Página Notas (/notas)

**Archivo:** `src/app/notas/page.tsx`

- Subject list: grid responsive similar a materias
  - `md:grid md:grid-cols-2 md:gap-3`
- El header sticky se expande al ancho completo

---

## Paso 9: Página Flashcards (/flashcards)

**Archivo:** `src/app/flashcards/page.tsx`

- List view: decks en grid
  - `md:grid md:grid-cols-2 md:gap-3`
- Study view: la flashcard 3D se centra con más espacio
  - Max-width del card: `max-w-md` en desktop (se mantiene proporcional)
  - Rating buttons: se pueden ampliar con más espacio

---

## Paso 10: Página Calendario (/calendario)

**Archivo:** `src/app/calendario/page.tsx`

- Este es el cambio más impactante: el grid semanal se expande
- Mobile: DAY_COL_W = 76px (actual, scrollable)
- `md+`: Las columnas de día se expanden para llenar el ancho disponible
  - Usar `flex-1` en vez de width fijo para cada columna de día
  - Hora column se mantiene fija
  - Los slots muestran más información (nombre completo + sala)
  - Textos más grandes en desktop (`md:text-xs` en vez de `text-[9px]`)

---

## Paso 11: Página Horario (/horario)

**Archivo:** `src/app/horario/page.tsx`

- Day tabs: se expanden con más espacio entre tabs
- Slots list: grid de 2 columnas en desktop
  - `md:grid md:grid-cols-2 md:gap-3`

---

## Paso 12: Página Perfil (/perfil)

**Archivo:** `src/app/perfil/page.tsx`

- Stats grid: `grid-cols-2` → `md:grid-cols-4`
- Las opciones (tema, notificaciones, cerrar sesión) en una sola columna centrada

---

## Paso 13: Página Quiz (/quiz)

**Archivo:** `src/app/quiz/page.tsx`

- Quiz cards/options: se expanden con más padding
- Opciones de respuesta: grid de 2 columnas en desktop en vez de stacked

---

## Paso 14: CSS Global y ajustes finales

**Archivo:** `src/app/globals.css`

- Agregar scroll bar styling para desktop (actualmente oculto)
- Hover states para desktop:
  - Cards: `hover:border-primary/30` o `hover:shadow-sm`
  - Buttons: `hover:opacity-90` como complemento a `active:scale`
- Cursor pointer para elementos interactivos en desktop
- Quitar `-webkit-tap-highlight-color: transparent` solo en desktop (o dejarlo)

**Archivo:** `tailwind.config.ts`
- No necesita cambios — los breakpoints `md`, `lg`, `xl` ya están disponibles por defecto en Tailwind

---

## Resumen de archivos a modificar

| # | Archivo | Tipo de cambio |
|---|---------|---------------|
| 1 | `src/app/layout.tsx` | Quitar max-w-lg del main |
| 2 | `src/components/sidebar-nav.tsx` | **NUEVO** — Sidebar para desktop |
| 3 | `src/components/bottom-nav.tsx` | Agregar `md:hidden` |
| 4 | `src/components/app-shell.tsx` | Layout flex con sidebar |
| 5 | `src/components/ui/sheet.tsx` | Dialog centrado en desktop |
| 6 | `src/app/page.tsx` | Login 2 columnas |
| 7 | `src/app/inicio/page.tsx` | Grids responsivos |
| 8 | `src/app/tareas/page.tsx` | Layout expandido |
| 9 | `src/app/materias/page.tsx` | Grid de subjects |
| 9b | `src/app/materias/[id]/[classId]/page.tsx` | Entry cards grid, reader panel |
| 9c | `src/components/dynamic-board-tab.tsx` | Tablero layout desktop |
| 10 | `src/app/notas/page.tsx` | Grid responsivo |
| 11 | `src/app/flashcards/page.tsx` | Decks grid + study centered |
| 12 | `src/app/calendario/page.tsx` | Columnas flexibles |
| 13 | `src/app/horario/page.tsx` | Grid de 2 columnas |
| 14 | `src/app/perfil/page.tsx` | Stats expandidos |
| 15 | `src/app/quiz/page.tsx` | Layout expandido |
| 16 | `src/app/globals.css` | Hover states, scrollbar |

## Orden de implementación recomendado

1. **Infraestructura** (Pasos 1-3): Layout, Sidebar, Sheet — establece la base
2. **Login** (Paso 4): Primera vista que ve el usuario
3. **Páginas principales** (Pasos 5-8): Inicio, Tareas, Materias, Notas
4. **Páginas secundarias** (Pasos 9-13): Flashcards, Calendario, Horario, Perfil, Quiz
5. **Pulido** (Paso 14): Hover states, scrollbar, detalles finales

## Principios de diseño

- **No romper mobile**: Todos los cambios usan breakpoints `md:`, `lg:`, etc. El diseño mobile actual NO se toca.
- **Aprovechamiento del espacio**: En desktop, los grids se expanden, los modales se centran, y la navegación se mueve a la izquierda.
- **Consistencia visual**: Mismos colores, border radius, y design tokens. Solo cambia la disposición espacial.
- **Progressive enhancement**: Mobile-first se mantiene. Desktop es un "upgrade" visual.
