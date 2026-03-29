# SPEC 06: Knowledge Graph Visualization

## Goal
Visual graph showing how concepts across all subjects and classes connect. Nodes colored by mastery level. Interactive exploration.

## Implementation Approach
Use HTML Canvas with a simple force-directed layout (no external library needed). Concepts extracted from notes are nodes; relationships are edges.

## New Files

### API Route: `src/app/api/knowledge-graph/extract/route.ts`
- Input: `{ entries: Array<{ content: string, subjectId: string, classId: string }>, subjectName: string }`
- Output: `{ nodes: GraphNode[], edges: GraphEdge[] }`
- Gemini extracts concepts and their relationships from multiple entries

### Component: `src/components/analytics/knowledge-graph.tsx`
- Canvas-based visualization
- Force-directed layout (simple spring simulation)
- Nodes: circles colored by mastery (red → yellow → green)
- Edges: lines with labels showing relationship type
- Touch/click to select a node → shows concept details
- Pinch to zoom, drag to pan
- Filter by subject (color-coded)

### Page integration
- Available from Mastery Dashboard (`/dominio`)
- "Ver Mapa de Conocimiento" button
- Opens as full-screen overlay

### Types: Add to `src/types/index.ts`
```typescript
export interface GraphNode {
  id: string;
  label: string;
  subjectId: string;
  subjectColor: string;
  mastery: number;         // 0-100
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;          // node id
  target: string;          // node id
  label: string;           // relationship type
  strength: number;        // 0-1
}
```

## Canvas Rendering
- Simple force simulation: repulsion between all nodes, attraction on edges
- Node size based on concept importance (number of connections)
- Edge thickness based on strength
- Color gradient: mastery 0→red, 50→yellow, 100→green
- Selected node highlights connected nodes and dims others
- Legend showing subject colors
