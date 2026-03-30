/**
 * classifyStructuralElements
 *
 * Converts raw wall segments (from parsedLayout) into a typed list of
 * structural elements.  Each element now carries a stable `wallId` string
 * (e.g. "W-03") so reports, labels, and trade-off panels can cross-reference
 * the same wall across the frontend and backend without ambiguity.
 *
 * wallId resolution priority:
 *   1. wall.wall_id  — set by graph_utils.build_wall_graph (most reliable)
 *   2. wall.wallId   — camelCase alias some parsers emit
 *   3. Fallback: "W-{1-based index, zero-padded to 2 digits}"
 *
 * elementType classification (span in metres):
 *   < 2.0  → partition_wall
 *   2.0–3.9 → load_bearing_wall
 *   4.0–5.9 → load_bearing_wall  (wide load-bearing)
 *   6.0–8.9 → long_span
 *   ≥ 9.0  → beam
 *
 * If the parser already stamped wall.elementType / wall.element_type that
 * value is always honoured and the span heuristic is skipped.
 */

// ── Span → elementType thresholds ──────────────────────────────────────────
const SPAN_THRESHOLDS = [
  { min: 9.0, type: "beam" },
  { min: 6.0, type: "long_span" },
  { min: 2.0, type: "load_bearing_wall" },
  { min: 0,   type: "partition_wall" },   // catch-all
];

/**
 * Derive elementType from span alone.
 * @param {number} span  metres
 * @returns {string}
 */
const spanToElementType = (span) => {
  for (const { min, type } of SPAN_THRESHOLDS) {
    if (span >= min) return type;
  }
  return "partition_wall";
};

export const classifyStructuralElements = (parsedLayout) => {
  const wallSegments = parsedLayout.wallSegments || [];

  const structuralElements = [];

  wallSegments.forEach((wall, idx) => {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const pixelLength = Math.sqrt(dx * dx + dy * dy);

    // Convert rough pixel length to metres (simple hackathon approximation)
    const span = +(pixelLength * 0.02).toFixed(2);

    // Honour an elementType the parser already set; otherwise derive from span.
    const elementType =
      wall.elementType ??
      wall.element_type ??
      spanToElementType(span);

    // ── Stable wall ID ───────────────────────────────────────────────────────
    const wallId =
      wall.wall_id ?? wall.wallId ?? `W-${String(idx + 1).padStart(2, "0")}`;

    structuralElements.push({
      wallId,
      elementType,
      span,
      source: wall,
    });
  });

  // ── Slabs ────────────────────────────────────────────────────────────────
  // One slab per floor in the layout; fall back to a single slab if the
  // parser does not expose floor count.
  const floorCount =
    parsedLayout.floors?.length ??
    parsedLayout.floorCount ??
    parsedLayout.floor_count ??
    1;

  for (let f = 0; f < floorCount; f++) {
    const floor = parsedLayout.floors?.[f];
    const slabSpan = floor?.span ?? floor?.slabSpan ?? floor?.slab_span ?? 5.5;

    structuralElements.push({
      wallId: `SLAB-${String(f + 1).padStart(2, "0")}`,
      elementType: "slab",
      span: slabSpan,
      source: floor ?? null,
    });
  }

  // ── Columns ──────────────────────────────────────────────────────────────
  // Emit one column per structural grid intersection (approx. every 4 walls).
  // Always emit at least 0 columns for small plans (≤ 4 walls).
  // Use parser-supplied columns when available.
  if (parsedLayout.columns?.length) {
    parsedLayout.columns.forEach((col, idx) => {
      structuralElements.push({
        wallId: col.column_id ?? col.columnId ?? `COL-${String(idx + 1).padStart(2, "0")}`,
        elementType: "column",
        span: col.height ?? 0,
        source: col,
      });
    });
  } else if (wallSegments.length > 4) {
    const columnCount = Math.floor(wallSegments.length / 4);
    for (let c = 0; c < columnCount; c++) {
      structuralElements.push({
        wallId: `COL-${String(c + 1).padStart(2, "0")}`,
        elementType: "column",
        span: 0,
        source: null,
      });
    }
  }

  return structuralElements;
};