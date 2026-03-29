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
 */
export const classifyStructuralElements = (parsedLayout) => {
  const wallSegments = parsedLayout.wallSegments || [];

  const structuralElements = [];

  wallSegments.forEach((wall, idx) => {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const pixelLength = Math.sqrt(dx * dx + dy * dy);

    // Convert rough pixel length to "metres" (simple hackathon approximation)
    const span = +(pixelLength * 0.02).toFixed(2);

    // Heuristic classification
    let elementType = "partition_wall";
    if (span >= 4) {
      elementType = "load_bearing_wall";
    }

    // ── Stable wall ID ───────────────────────────────────────────────────────
    // Prefer the backend-assigned ID from graph_utils; fall back to local index.
    const wallId =
      wall.wall_id ?? wall.wallId ?? `W-${String(idx + 1).padStart(2, "0")}`;

    structuralElements.push({
      wallId, // ← stable cross-reference key
      elementType,
      span,
      source: wall,
    });
  });

  // ── Slab — one per floor plan ────────────────────────────────────────────
  structuralElements.push({
    wallId: "SLAB-01",
    elementType: "slab",
    span: 5.5,
    source: null,
  });

  // ── Columns — added when wall count is high ──────────────────────────────
  if (wallSegments.length > 12) {
    structuralElements.push({
      wallId: "COL-01",
      elementType: "column",
      span: 0,
      source: null,
    });
  }

  return structuralElements;
};
