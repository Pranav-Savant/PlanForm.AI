import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Billboard } from "@react-three/drei";

// 2D pixel → 3D world-unit scale factor
const SCALE = 0.02;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getBounds(wallSegments, roomPolygons) {
  const xs = [];
  const ys = [];

  wallSegments.forEach((w) => {
    xs.push(w.x1, w.x2);
    ys.push(w.y1, w.y2);
  });

  roomPolygons.forEach((room) => {
    room.forEach((pt) => {
      xs.push(pt.x);
      ys.push(pt.y);
    });
  });

  if (xs.length === 0 || ys.length === 0) return { centerX: 0, centerY: 0 };

  return {
    centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
    centerY: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

function inferOpeningOrientation(opening) {
  if (
    opening?.orientation === "horizontal" ||
    opening?.orientation === "vertical"
  ) {
    return opening.orientation;
  }

  const hasCoords =
    Number.isFinite(opening?.x1) &&
    Number.isFinite(opening?.y1) &&
    Number.isFinite(opening?.x2) &&
    Number.isFinite(opening?.y2);

  if (!hasCoords) return "horizontal";

  const dx = Math.abs(opening.x2 - opening.x1);
  const dy = Math.abs(opening.y2 - opening.y1);
  return dx >= dy ? "horizontal" : "vertical";
}

function dedupeWallSegmentsForView(wallSegments) {
  if (!Array.isArray(wallSegments) || wallSegments.length === 0) return [];

  const normalized = wallSegments
    .map((seg) => {
      const hasCoords =
        Number.isFinite(seg?.x1) &&
        Number.isFinite(seg?.y1) &&
        Number.isFinite(seg?.x2) &&
        Number.isFinite(seg?.y2);

      if (!hasCoords) return null;

      let { x1, y1, x2, y2 } = seg;
      const horizontal = Math.abs(y1 - y2) <= Math.abs(x1 - x2);
      if (horizontal && x1 > x2) {
        [x1, x2] = [x2, x1];
        [y1, y2] = [y2, y1];
      }
      if (!horizontal && y1 > y2) {
        [x1, x2] = [x2, x1];
        [y1, y2] = [y2, y1];
      }

      const length = horizontal ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
      return {
        raw: seg,
        x1,
        y1,
        x2,
        y2,
        orientation: horizontal ? "h" : "v",
        length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const overlapLen = (a1, a2, b1, b2) =>
    Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

  const isLikelyDuplicate = (a, b) => {
    if (a.orientation !== b.orientation) return false;
    if (a.orientation === "h") {
      const dy = Math.abs(a.y1 - b.y1);
      const overlap = overlapLen(a.x1, a.x2, b.x1, b.x2);
      const minLen = Math.min(a.length, b.length);
      return dy <= 10 && minLen <= 90 && overlap >= 0.85 * minLen;
    }
    const dx = Math.abs(a.x1 - b.x1);
    const overlap = overlapLen(a.y1, a.y2, b.y1, b.y2);
    const minLen = Math.min(a.length, b.length);
    return dx <= 10 && minLen <= 90 && overlap >= 0.85 * minLen;
  };

  const kept = [];
  for (const cand of normalized) {
    if (!kept.some((prev) => isLikelyDuplicate(cand, prev))) kept.push(cand);
  }

  return kept.map((k) => k.raw);
}

function synthesizeDoorFromArc(opening, wallSegments, openingCandidates = []) {
  const hasArcData =
    Number.isFinite(opening?.cx) &&
    Number.isFinite(opening?.cy) &&
    Number.isFinite(opening?.radius);

  if (!hasArcData || !Array.isArray(wallSegments) || wallSegments.length === 0)
    return null;

  const cx = opening.cx;
  const cy = opening.cy;
  const arcBoxW =
    Number.isFinite(opening?.x1) && Number.isFinite(opening?.x2)
      ? Math.abs(opening.x2 - opening.x1)
      : 0;
  const arcBoxH =
    Number.isFinite(opening?.y1) && Number.isFinite(opening?.y2)
      ? Math.abs(opening.y2 - opening.y1)
      : 0;
  const spanPx = Math.max(opening.radius * 2.0, arcBoxW, arcBoxH, 26);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  const nearestWallAxis = (orientation, tx, ty) => {
    let best = null;
    for (const seg of wallSegments) {
      const hasCoords =
        Number.isFinite(seg?.x1) &&
        Number.isFinite(seg?.y1) &&
        Number.isFinite(seg?.x2) &&
        Number.isFinite(seg?.y2);
      if (!hasCoords) continue;
      const isHorizontal =
        Math.abs(seg.y1 - seg.y2) <= Math.abs(seg.x1 - seg.x2);
      if (orientation === "horizontal" && !isHorizontal) continue;
      if (orientation === "vertical" && isHorizontal) continue;
      if (orientation === "horizontal") {
        const px = clamp(
          tx,
          Math.min(seg.x1, seg.x2),
          Math.max(seg.x1, seg.x2),
        );
        const py = (seg.y1 + seg.y2) / 2;
        const dist = Math.hypot(tx - px, ty - py);
        if (!best || dist < best.dist) best = { dist, x: px, y: py };
      } else {
        const py = clamp(
          ty,
          Math.min(seg.y1, seg.y2),
          Math.max(seg.y1, seg.y2),
        );
        const px = (seg.x1 + seg.x2) / 2;
        const dist = Math.hypot(tx - px, ty - py);
        if (!best || dist < best.dist) best = { dist, x: px, y: py };
      }
    }
    return best;
  };

  if (Array.isArray(openingCandidates) && openingCandidates.length > 0) {
    let bestOpening = null;
    let bestScore = null;
    for (const cand of openingCandidates) {
      const hasCandCoords =
        Number.isFinite(cand?.x1) &&
        Number.isFinite(cand?.y1) &&
        Number.isFinite(cand?.x2) &&
        Number.isFinite(cand?.y2);
      if (!hasCandCoords) continue;
      const cOrientation = inferOpeningOrientation(cand);
      if (cOrientation !== "horizontal" && cOrientation !== "vertical")
        continue;
      const ccx = (cand.x1 + cand.x2) / 2;
      const ccy = (cand.y1 + cand.y2) / 2;
      const cSpan = Math.max(
        Math.abs(cand.x2 - cand.x1),
        Math.abs(cand.y2 - cand.y1),
      );
      const dist = Math.hypot(cx - ccx, cy - ccy);
      const score = dist + Math.abs(cSpan - spanPx) * 0.45;
      if (bestScore === null || score < bestScore) {
        bestScore = score;
        bestOpening = {
          orientation: cOrientation,
          x1: cand.x1,
          y1: cand.y1,
          x2: cand.x2,
          y2: cand.y2,
          dist,
        };
      }
    }
    const maxOpeningSnap = Math.max(64, spanPx * 1.35);
    if (bestOpening && bestOpening.dist <= maxOpeningSnap) {
      const ccx = (bestOpening.x1 + bestOpening.x2) / 2;
      const ccy = (bestOpening.y1 + bestOpening.y2) / 2;
      const cSpan = Math.max(
        Math.abs(bestOpening.x2 - bestOpening.x1),
        Math.abs(bestOpening.y2 - bestOpening.y1),
      );
      const targetSpan = Math.max(cSpan, spanPx * 0.9, 30);
      const axis = nearestWallAxis(bestOpening.orientation, ccx, ccy);
      const useAxis = axis && axis.dist <= Math.max(20, opening.radius * 1.2);
      if (bestOpening.orientation === "horizontal") {
        const ax = useAxis ? axis.x : ccx;
        const ay = useAxis ? axis.y : ccy;
        return {
          type: "door",
          orientation: "horizontal",
          x1: Math.round(ax - targetSpan / 2),
          y1: Math.round(ay),
          x2: Math.round(ax + targetSpan / 2),
          y2: Math.round(ay),
        };
      }
      return {
        type: "door",
        orientation: "vertical",
        x1: Math.round(useAxis ? axis.x : ccx),
        y1: Math.round((useAxis ? axis.y : ccy) - targetSpan / 2),
        x2: Math.round(useAxis ? axis.x : ccx),
        y2: Math.round((useAxis ? axis.y : ccy) + targetSpan / 2),
      };
    }
  }

  let best = null;
  for (const seg of wallSegments) {
    const hasCoords =
      Number.isFinite(seg?.x1) &&
      Number.isFinite(seg?.y1) &&
      Number.isFinite(seg?.x2) &&
      Number.isFinite(seg?.y2);
    if (!hasCoords) continue;
    const isHorizontal = Math.abs(seg.y1 - seg.y2) <= Math.abs(seg.x1 - seg.x2);
    if (isHorizontal) {
      const projX = clamp(
        cx,
        Math.min(seg.x1, seg.x2),
        Math.max(seg.x1, seg.x2),
      );
      const yLine = (seg.y1 + seg.y2) / 2;
      const dist = Math.hypot(cx - projX, cy - yLine);
      if (!best || dist < best.dist)
        best = {
          dist,
          orientation: "horizontal",
          x1: projX - spanPx / 2,
          y1: yLine,
          x2: projX + spanPx / 2,
          y2: yLine,
        };
      continue;
    }
    const projY = clamp(cy, Math.min(seg.y1, seg.y2), Math.max(seg.y1, seg.y2));
    const xLine = (seg.x1 + seg.x2) / 2;
    const dist = Math.hypot(cx - xLine, cy - projY);
    if (!best || dist < best.dist)
      best = {
        dist,
        orientation: "vertical",
        x1: xLine,
        y1: projY - spanPx / 2,
        x2: xLine,
        y2: projY + spanPx / 2,
      };
  }

  if (!best || best.dist > Math.max(26, opening.radius * 2.4)) return null;

  return {
    type: "door",
    orientation: best.orientation,
    x1: Math.round(best.x1),
    y1: Math.round(best.y1),
    x2: Math.round(best.x2),
    y2: Math.round(best.y2),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WALL LABEL  — billboard card that always faces the camera
// ─────────────────────────────────────────────────────────────────────────────

function WallLabel({ wallId, wallType, spanM, x, y, z }) {
  // Skip labels for very short walls — they'd overlap badly
  if (parseFloat(spanM) < 0.5) return null;

  const isOuter = wallType === "outer_wall";
  const idColor = isOuter ? "#34d399" : "#94a3b8";

  return (
    <Billboard position={[x, y, z]} follow>
      {/* Dark card background */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[1.2, 0.55]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.85} />
      </mesh>

      {/* Colored top-edge accent bar */}
      <mesh position={[0, 0.235, 0]}>
        <planeGeometry args={[1.2, 0.045]} />
        <meshBasicMaterial color={idColor} transparent opacity={0.95} />
      </mesh>

      {/* Wall ID  —  e.g. "W-03" */}
      <Text
        position={[0, 0.07, 0.01]}
        fontSize={0.23}
        color={idColor}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
        letterSpacing={0.05}
        outlineWidth={0.014}
        outlineColor="#000000"
      >
        {wallId}
      </Text>

      {/* Span  —  e.g. "4.2m" */}
      <Text
        position={[0, -0.13, 0.01]}
        fontSize={0.135}
        color={idColor}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.06}
        outlineWidth={0.009}
        outlineColor="#000000"
      >
        {`${spanM}m`}
      </Text>
    </Billboard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WALL  — geometry + floating label
// ─────────────────────────────────────────────────────────────────────────────

function Wall({ segment, centerX, centerY, wallIndex }) {
  const { x1, y1, x2, y2, wallType, wall_id } = segment;

  const sx1 = (x1 - centerX) * SCALE;
  const sy1 = (y1 - centerY) * SCALE;
  const sx2 = (x2 - centerX) * SCALE;
  const sy2 = (y2 - centerY) * SCALE;

  const dx = sx2 - sx1;
  const dz = sy2 - sy1;

  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const midX = (sx1 + sx2) / 2;
  const midZ = (sy1 + sy2) / 2;

  const isOuter = wallType === "outer_wall";
  const wallHeight = isOuter ? 3.2 : 3.0;
  const wallColor = isOuter ? "#374151" : "#6b7280";
  const wallThick = isOuter ? 0.25 : 0.18;

  // Resolved ID — prefer backend wall_id, fall back to local 1-based index
  const resolvedId = wall_id ?? `W-${String(wallIndex + 1).padStart(2, "0")}`;

  // Span in metres
  const pixelLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const spanM = (pixelLength * SCALE).toFixed(1);

  // Label position: above the wall top, offset outward along the wall's normal
  // so the card doesn't clip through the geometry.
  const safeLen = length || 1;
  const nx = dz / safeLen; // wall normal X (perpendicular in XZ plane)
  const nz = -dx / safeLen; // wall normal Z
  const OFFSET = 0.75; // world units outward from wall face

  return (
    <group>
      {/* Geometry */}
      <mesh
        position={[midX, wallHeight / 2, midZ]}
        rotation={[0, -angle, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[length, wallHeight, wallThick]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Billboard label */}
      <WallLabel
        wallId={resolvedId}
        wallType={wallType}
        spanM={spanM}
        x={midX + nx * OFFSET}
        y={wallHeight + 0.5}
        z={midZ + nz * OFFSET}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOOR
// ─────────────────────────────────────────────────────────────────────────────

function DoorGap3D({ opening, centerX, centerY, wallSegments = [] }) {
  const hasGapCoords =
    Number.isFinite(opening?.x1) &&
    Number.isFinite(opening?.y1) &&
    Number.isFinite(opening?.x2) &&
    Number.isFinite(opening?.y2);
  if (!hasGapCoords) return null;

  const orientation = inferOpeningOrientation(opening);
  const sx1 = (opening.x1 - centerX) * SCALE;
  const sy1 = (opening.y1 - centerY) * SCALE;
  const sx2 = (opening.x2 - centerX) * SCALE;
  const sy2 = (opening.y2 - centerY) * SCALE;

  let midX = (sx1 + sx2) / 2;
  let midZ = (sy1 + sy2) / 2;
  const isH = orientation === "horizontal";
  const SNAP_RADIUS = 0.35;

  if (wallSegments.length > 0) {
    if (isH) {
      let bestDist = SNAP_RADIUS;
      for (const seg of wallSegments) {
        const segIsH = Math.abs(seg.y1 - seg.y2) <= Math.abs(seg.x1 - seg.x2);
        if (!segIsH) continue;
        const segCZ = ((seg.y1 + seg.y2) / 2 - centerY) * SCALE;
        const dist = Math.abs(segCZ - midZ);
        if (dist < bestDist) {
          bestDist = dist;
          midZ = segCZ;
        }
      }
    } else {
      let bestDist = SNAP_RADIUS;
      for (const seg of wallSegments) {
        const segIsV = Math.abs(seg.x1 - seg.x2) <= Math.abs(seg.y1 - seg.y2);
        if (!segIsV) continue;
        const segCX = ((seg.x1 + seg.x2) / 2 - centerX) * SCALE;
        const dist = Math.abs(segCX - midX);
        if (dist < bestDist) {
          bestDist = dist;
          midX = segCX;
        }
      }
    }
  }

  const rawSpan = isH ? Math.abs(sx2 - sx1) : Math.abs(sy2 - sy1);
  const gapSpan = Math.max(rawSpan, 0.42);
  const gapDepth = 0.26;
  const spanW = isH ? gapSpan : gapDepth;
  const spanD = isH ? gapDepth : gapSpan;

  return (
    <group position={[midX, 0, midZ]}>
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[spanW, 2.2, spanD]} />
        <meshStandardMaterial color="#92400e" transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, 2.8, 0]}>
        <boxGeometry args={[spanW, 0.4, spanD]} />
        <meshStandardMaterial color="#78350f" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function DoorArc3D({ opening, centerX, centerY }) {
  const hasArcData =
    Number.isFinite(opening?.cx) &&
    Number.isFinite(opening?.cy) &&
    Number.isFinite(opening?.radius);
  if (!hasArcData) return null;

  const x = (opening.cx - centerX) * SCALE;
  const z = (opening.cy - centerY) * SCALE;
  const radius = Math.max(opening.radius * SCALE, 0.35);
  const qStartMap = { 0: 0, 1: Math.PI / 2, 2: Math.PI, 3: (3 * Math.PI) / 2 };
  const yRot = qStartMap[opening.dominant_quadrant] ?? 0;
  const leafLength = Math.max(radius * 1.05, 0.45);

  return (
    <group position={[x, 0, z]} rotation={[0, yRot, 0]}>
      <mesh position={[leafLength / 2, 1.1, 0]}>
        <boxGeometry args={[leafLength, 2.2, 0.08]} />
        <meshStandardMaterial color="#92400e" transparent opacity={0.42} />
      </mesh>
      <mesh position={[leafLength / 2, 2.8, 0]}>
        <boxGeometry args={[leafLength, 0.4, 0.24]} />
        <meshStandardMaterial color="#78350f" transparent opacity={0.62} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.03, 12, 48, Math.PI / 2]} />
        <meshStandardMaterial color="#92400e" transparent opacity={0.9} />
      </mesh>
      <mesh position={[radius, 0.06, 0]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
    </group>
  );
}

function Door3D({
  opening,
  centerX,
  centerY,
  wallSegments,
  openingCandidates,
}) {
  const hasGapCoords =
    Number.isFinite(opening?.x1) &&
    Number.isFinite(opening?.y1) &&
    Number.isFinite(opening?.x2) &&
    Number.isFinite(opening?.y2);
  const hasArcData =
    Number.isFinite(opening?.cx) &&
    Number.isFinite(opening?.cy) &&
    Number.isFinite(opening?.radius);

  if (hasArcData && !opening?.orientation) {
    const snapped = synthesizeDoorFromArc(
      opening,
      wallSegments,
      openingCandidates,
    );
    if (snapped)
      return (
        <DoorGap3D
          opening={snapped}
          centerX={centerX}
          centerY={centerY}
          wallSegments={wallSegments}
        />
      );
    return <DoorArc3D opening={opening} centerX={centerX} centerY={centerY} />;
  }
  if (hasGapCoords)
    return (
      <DoorGap3D
        opening={opening}
        centerX={centerX}
        centerY={centerY}
        wallSegments={wallSegments}
      />
    );
  if (hasArcData)
    return <DoorArc3D opening={opening} centerX={centerX} centerY={centerY} />;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW
// ─────────────────────────────────────────────────────────────────────────────

function Window3D({ opening, centerX, centerY }) {
  const hasGapCoords =
    Number.isFinite(opening?.x1) &&
    Number.isFinite(opening?.y1) &&
    Number.isFinite(opening?.x2) &&
    Number.isFinite(opening?.y2);
  if (!hasGapCoords) return null;

  const orientation = inferOpeningOrientation(opening);
  const sx1 = (opening.x1 - centerX) * SCALE;
  const sy1 = (opening.y1 - centerY) * SCALE;
  const sx2 = (opening.x2 - centerX) * SCALE;
  const sy2 = (opening.y2 - centerY) * SCALE;
  const midX = (sx1 + sx2) / 2;
  const midZ = (sy1 + sy2) / 2;
  const isH = orientation === "horizontal";
  const gapSpan = Math.max(
    isH ? Math.abs(sx2 - sx1) : Math.abs(sy2 - sy1),
    0.3,
  );
  const spanW = isH ? gapSpan : 0.3;
  const spanD = isH ? 0.3 : gapSpan;

  return (
    <group position={[midX, 0, midZ]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[spanW, 0.35, spanD]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[spanW, 1.4, spanD]} />
        <meshStandardMaterial color="#93c5fd" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[spanW, 0.35, spanD]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM FLOOR
// ─────────────────────────────────────────────────────────────────────────────

function RoomFloor({ polygon, centerX, centerY }) {
  if (!polygon || polygon.length < 3) return null;
  const pts = polygon.map((p) => ({
    x: (p.x - centerX) * SCALE,
    y: (p.y - centerY) * SCALE,
  }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minZ = Math.min(...ys),
    maxZ = Math.max(...ys);
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[(minX + maxX) / 2, 0.01, (minZ + maxZ) / 2]}
      receiveShadow
    >
      <planeGeometry args={[maxX - minX, maxZ - minZ]} />
      <meshStandardMaterial color="#d1fae5" transparent opacity={0.6} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOOR BASE
// ─────────────────────────────────────────────────────────────────────────────

function FloorBase() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.02, 0]}
      receiveShadow
    >
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color="#e5e7eb" />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGEND
// ─────────────────────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { label: "Wall", color: "#94a3b8" },
  { label: "Door", color: "#f59e0b" },
  { label: "Window", color: "#38bdf8" },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function ModelViewer({
  wallSegments = [],
  roomPolygons = [],
  doorsData = [],
  windowsData = [],
  openingsData = [],
}) {
  const displayWallSegments = dedupeWallSegmentsForView(wallSegments);

  const openingCandidates = [
    ...doorsData.filter(
      (d) =>
        Number.isFinite(d?.x1) &&
        Number.isFinite(d?.x2) &&
        Number.isFinite(d?.y1) &&
        Number.isFinite(d?.y2),
    ),
    ...openingsData.filter(
      (o) =>
        Number.isFinite(o?.x1) &&
        Number.isFinite(o?.x2) &&
        Number.isFinite(o?.y1) &&
        Number.isFinite(o?.y2),
    ),
  ];

  const { centerX, centerY } = getBounds(displayWallSegments, roomPolygons);

  return (
    <div>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <span style={styles.icon}>🏗️</span>
          <div>
            <h2 style={styles.heading}>3D Structural Model</h2>
            <p style={styles.subheading}>
              Drag to orbit · Scroll to zoom · Each wall labelled with index
              &amp; span
            </p>
          </div>
        </div>

        {/* Legend row */}
        <div style={styles.legend}>
          {LEGEND_ITEMS.map(({ label, color }) => (
            <div key={label} style={styles.legendItem}>
              <span
                style={{
                  ...styles.legendDot,
                  background: color,
                  boxShadow: `0 0 6px ${color}55`,
                }}
              />
              <span style={styles.legendLabel}>{label}</span>
            </div>
          ))}
          <div style={styles.labelHint}>
            <span style={styles.labelHintBadge}>W-01</span>
            <span style={styles.legendLabel}>Wall Label Format</span>
          </div>
        </div>
      </div>

      {/* ── Warning ── */}
      {displayWallSegments.length === 0 && (
        <div style={styles.warning}>
          <span>⚠️</span> No walls detected — showing empty scene.
        </div>
      )}

      {/* ── 3D Canvas ── */}
      <div style={styles.canvasWrapper}>
        <Canvas shadows camera={{ position: [0, 18, 16], fov: 50 }}>
          <ambientLight intensity={0.85} />
          <directionalLight
            position={[10, 14, 8]}
            intensity={0.9}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <directionalLight position={[-8, 6, -6]} intensity={0.35} />

          <FloorBase />

          {roomPolygons.map((room, i) => (
            <RoomFloor
              key={i}
              polygon={room}
              centerX={centerX}
              centerY={centerY}
            />
          ))}

          {displayWallSegments.map((seg, i) => (
            <Wall
              key={i}
              segment={seg}
              centerX={centerX}
              centerY={centerY}
              wallIndex={i}
            />
          ))}

          {doorsData.map((door, i) => (
            <Door3D
              key={i}
              opening={door}
              centerX={centerX}
              centerY={centerY}
              wallSegments={displayWallSegments}
              openingCandidates={openingCandidates}
            />
          ))}

          {windowsData.map((win, i) => (
            <Window3D
              key={i}
              opening={win}
              centerX={centerX}
              centerY={centerY}
            />
          ))}

          <OrbitControls makeDefault />
        </Canvas>
      </div>

      {/* ── Wall Index Reference Table ── */}
      {displayWallSegments.length > 0 && (
        <div style={styles.indexTable}>
          <p style={styles.indexTitle}>📋 Wall Index Reference</p>
          <div style={styles.indexGrid}>
            {displayWallSegments.map((seg, i) => {
              const resolvedId =
                seg.wall_id ?? `W-${String(i + 1).padStart(2, "0")}`;
              const isOuter = seg.wallType === "outer_wall";
              const spanM = (
                Math.sqrt((seg.x2 - seg.x1) ** 2 + (seg.y2 - seg.y1) ** 2) *
                SCALE
              ).toFixed(1);
              return (
                <div key={i} style={styles.indexRow}>
                  <span
                    style={{
                      ...styles.indexId,
                      color: isOuter ? "#34d399" : "#94a3b8",
                      borderColor: isOuter ? "#34d39930" : "#94a3b830",
                    }}
                  >
                    {resolvedId}
                  </span>
                  <span style={styles.indexSpan}>{spanM} m</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Stats Bar ── */}
      <div style={styles.statsBar}>
        <Stat
          label="Walls"
          value={displayWallSegments.length}
          accent="#34d399"
          icon="🧱"
        />
        <Stat
          label="Doors"
          value={doorsData.length}
          accent="#f59e0b"
          icon="🚪"
        />
        <Stat
          label="Windows"
          value={windowsData.length}
          accent="#38bdf8"
          icon="🪟"
        />
      </div>
    </div>
  );
}

function Stat({ label, value, accent, icon }) {
  return (
    <div style={styles.statItem}>
      <span style={styles.statIcon}>{icon}</span>
      <span style={{ ...styles.statValue, color: accent }}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES  — dark theme matching ResultsPage
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  header: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "16px",
  },
  titleRow: { display: "flex", alignItems: "center", gap: "12px" },
  icon: { fontSize: "28px", lineHeight: 1 },
  heading: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
    background: "linear-gradient(90deg, #34d399, #38bdf8)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.01em",
  },
  subheading: {
    margin: "3px 0 0",
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 400,
    letterSpacing: "0.02em",
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "20px",
    padding: "4px 10px",
  },
  legendDot: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: "12px",
    color: "#cbd5e1",
    fontWeight: 500,
    letterSpacing: "0.02em",
  },
  labelHint: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "rgba(52,211,153,0.06)",
    border: "1px solid rgba(52,211,153,0.2)",
    borderRadius: "20px",
    padding: "4px 10px",
  },
  labelHintBadge: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#34d399",
    letterSpacing: "0.08em",
  },
  canvasWrapper: {
    width: "100%",
    height: "520px",
    borderRadius: "16px",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    boxShadow: "inset 0 2px 20px rgba(0,0,0,0.5)",
  },
  warning: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#fbbf24",
    background: "rgba(251,191,36,0.1)",
    border: "1px solid rgba(251,191,36,0.25)",
    padding: "10px 16px",
    borderRadius: "12px",
    marginBottom: "14px",
    fontWeight: 500,
    fontSize: "14px",
  },

  // Index reference table
  indexTable: {
    marginTop: "16px",
    padding: "14px 16px",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "14px",
  },
  indexTitle: {
    margin: "0 0 12px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  indexGrid: { display: "flex", flexWrap: "wrap", gap: "8px" },
  indexRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "8px",
    padding: "6px 12px",
    minWidth: "150px",
  },
  indexId: {
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    border: "1px solid transparent",
    borderRadius: "4px",
    padding: "1px 6px",
  },
  indexType: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    fontWeight: 600,
  },
  indexSpan: {
    fontSize: "12px",
    color: "#94a3b8",
    marginLeft: "auto",
    fontVariantNumeric: "tabular-nums",
  },

  statsBar: {
    display: "flex",
    gap: "12px",
    marginTop: "16px",
    padding: "14px 20px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "14px",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  statItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "3px",
    minWidth: "64px",
  },
  statIcon: { fontSize: "18px", lineHeight: 1, marginBottom: "2px" },
  statValue: {
    fontSize: "26px",
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.02em",
  },
  statLabel: {
    fontSize: "11px",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    fontWeight: 600,
  },
};

export default ModelViewer;
