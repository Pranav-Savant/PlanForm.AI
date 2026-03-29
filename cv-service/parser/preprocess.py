import cv2
import numpy as np
from parser.graph_utils import build_wall_graph, detect_graph_openings


# ══════════════════════════════════════════════════════════════════════════════
# BASIC HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def is_orthogonal(x1, y1, x2, y2, tolerance=10):
    return abs(x1 - x2) < tolerance or abs(y1 - y2) < tolerance


def line_length(x1, y1, x2, y2):
    return np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)


def snap_to_axis(x1, y1, x2, y2):
    if abs(x1 - x2) < abs(y1 - y2):
        x = int((x1 + x2) / 2)
        return x, y1, x, y2
    else:
        y = int((y1 + y2) / 2)
        return x1, y, x2, y


def normalize_line(x1, y1, x2, y2):
    if abs(y1 - y2) < abs(x1 - x2):   # horizontal
        if x1 > x2:
            return x2, y2, x1, y1
    else:                               # vertical
        if y1 > y2:
            return x2, y2, x1, y1
    return x1, y1, x2, y2


# ══════════════════════════════════════════════════════════════════════════════
# WALL THICKNESS ESTIMATION
# ══════════════════════════════════════════════════════════════════════════════

def estimate_wall_thickness(thresh):
    """
    Estimate the dominant wall-line thickness (in pixels) by measuring dark-pixel
    run-lengths across a grid of horizontal and vertical scan-lines.
    Returns the median run length for runs in the plausible wall-thickness range.
    """
    h, w = thresh.shape
    runs = []

    step_y = max(1, h // 30)
    step_x = max(1, w // 30)

    for y in range(h // 5, 4 * h // 5, step_y):
        row = thresh[y, :]
        in_run, start = False, 0
        for x in range(w):
            if row[x] > 128 and not in_run:
                in_run, start = True, x
            elif row[x] <= 128 and in_run:
                run_len = x - start
                if 3 <= run_len <= 30:
                    runs.append(run_len)
                in_run = False

    for x in range(w // 5, 4 * w // 5, step_x):
        col = thresh[:, x]
        in_run, start = False, 0
        for y in range(h):
            if col[y] > 128 and not in_run:
                in_run, start = True, y
            elif col[y] <= 128 and in_run:
                run_len = y - start
                if 3 <= run_len <= 30:
                    runs.append(run_len)
                in_run = False

    return int(np.median(runs)) if runs else 8


# ══════════════════════════════════════════════════════════════════════════════
# THICK / THIN LAYER SEPARATION
# ══════════════════════════════════════════════════════════════════════════════

def separate_thick_thin(thresh, wall_thickness=8):
    """
    Split the binary image into two complementary layers:

    thick_layer — survives morphological erosion → actual wall bodies.
    thin_layer  — removed by erosion → door arcs, window lines, annotations.
    """
    erosion_r = max(2, wall_thickness // 2 - 1)
    kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (erosion_r * 2 + 1, erosion_r * 2 + 1)
    )

    eroded      = cv2.erode(thresh, kernel, iterations=1)
    thick_layer = cv2.dilate(eroded, kernel, iterations=1)

    thin_layer = cv2.subtract(thresh, thick_layer)
    thin_layer = cv2.morphologyEx(
        thin_layer, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)
    )

    return thick_layer, thin_layer


# ══════════════════════════════════════════════════════════════════════════════
# LINE-ON-THICK-LAYER FILTER  (replaces near_contour)
# ══════════════════════════════════════════════════════════════════════════════

def line_on_thick_layer(x1, y1, x2, y2, thick_layer, sample_ratio=0.45):
    """
    Return True if at least `sample_ratio` fraction of evenly-spaced sample
    points along the segment (x1,y1)→(x2,y2) lie on the thick wall layer.

    Why this is better than near_contour
    ──────────────────────────────────────────────────────────────────────────
    near_contour relied on cv2.CHAIN_APPROX_SIMPLE contour storage which only
    keeps corner/endpoint vertices.  A long straight outer wall therefore has
    NO contour points along its middle, causing the segment to fail the
    proximity test and be silently dropped.

    Sampling directly on thick_layer avoids this entirely: if the Hough line
    lies on a wall body pixel it passes; if it's a noise artefact in empty
    space it fails.
    """
    n_samples = max(12, int(line_length(x1, y1, x2, y2) / 6))
    hits = 0
    h, w = thick_layer.shape
    for i in range(n_samples):
        t = i / max(n_samples - 1, 1)
        px = int(round(x1 + t * (x2 - x1)))
        py = int(round(y1 + t * (y2 - y1)))
        if 0 <= py < h and 0 <= px < w:
            if thick_layer[py, px] > 128:
                hits += 1
    return (hits / n_samples) >= sample_ratio


def dedupe_symbol_candidates(candidates, center_tol=18, size_tol=12):
    """
    Keep strongest non-overlapping symbol candidates by center/size proximity.
    """
    if not candidates:
        return []

    def _size(item):
        if "radius" in item:
            return float(item["radius"])
        if all(k in item for k in ("x1", "y1", "x2", "y2")):
            return float(max(abs(item["x2"] - item["x1"]), abs(item["y2"] - item["y1"])))
        return 0.0

    ordered = sorted(candidates, key=lambda c: c.get("score", 0.0), reverse=True)
    kept = []
    for cand in ordered:
        cx = float(cand.get("cx", (cand.get("x1", 0) + cand.get("x2", 0)) / 2))
        cy = float(cand.get("cy", (cand.get("y1", 0) + cand.get("y2", 0)) / 2))
        sz = _size(cand)

        duplicate = False
        for ex in kept:
            ex_cx = float(ex.get("cx", (ex.get("x1", 0) + ex.get("x2", 0)) / 2))
            ex_cy = float(ex.get("cy", (ex.get("y1", 0) + ex.get("y2", 0)) / 2))
            ex_sz = _size(ex)
            if abs(cx - ex_cx) <= center_tol and abs(cy - ex_cy) <= center_tol and abs(sz - ex_sz) <= size_tol:
                duplicate = True
                break

        if not duplicate:
            kept.append(cand)

    return kept


def filter_symbols_near_openings(symbols, openings, kind="door", margin=30):
    """
    Drop detached symbol candidates by requiring proximity to at least one wall gap.
    """
    if not symbols or not openings:
        return []

    filtered = []
    for sym in symbols:
        sx = float(sym.get("cx", (sym.get("x1", 0) + sym.get("x2", 0)) / 2))
        sy = float(sym.get("cy", (sym.get("y1", 0) + sym.get("y2", 0)) / 2))

        keep = False
        for op in openings:
            ocx = (op["x1"] + op["x2"]) / 2
            ocy = (op["y1"] + op["y2"]) / 2
            dist = np.hypot(sx - ocx, sy - ocy)

            span = max(
                abs(op["x2"] - op["x1"]),
                abs(op["y2"] - op["y1"]),
                float(op.get("gap", 0))
            )

            if kind == "door":
                radius = float(sym.get("radius", span * 0.5))
                limit = max(radius + margin, span * 0.9 + margin * 0.4)
            else:
                limit = max(span * 0.8 + margin * 0.3, margin)

            if dist <= limit:
                keep = True
                break

        if keep:
            filtered.append(sym)

    return filtered


def dedupe_opening_entries(entries, center_tol=18):
    """
    De-duplicate opening-like records by centroid proximity and type.
    """
    kept = []
    for item in entries:
        cx = float(item.get("cx", (item.get("x1", 0) + item.get("x2", 0)) / 2))
        cy = float(item.get("cy", (item.get("y1", 0) + item.get("y2", 0)) / 2))
        item_type = item.get("type", "")

        duplicate = False
        for ex in kept:
            ex_cx = float(ex.get("cx", (ex.get("x1", 0) + ex.get("x2", 0)) / 2))
            ex_cy = float(ex.get("cy", (ex.get("y1", 0) + ex.get("y2", 0)) / 2))
            if item_type == ex.get("type", "") and abs(cx - ex_cx) <= center_tol and abs(cy - ex_cy) <= center_tol:
                duplicate = True
                break

        if not duplicate:
            kept.append(item)

    return kept


def merge_door_gap_and_arc_entries(doors_data, match_margin=56):
    """
    Merge door-gap entries with nearby arc-symbol entries so one physical door
    is represented once.
    """
    if not doors_data:
        return []

    gap_doors = []
    arc_doors = []
    other = []

    for door in doors_data:
        has_arc = all(k in door for k in ("cx", "cy", "radius"))
        has_gap = all(k in door for k in ("x1", "y1", "x2", "y2")) and (
            door.get("orientation") in ("horizontal", "vertical")
        )

        if has_arc:
            arc_doors.append(door)
        elif has_gap:
            gap_doors.append(door)
        else:
            other.append(door)

    def _overlap_len(a1, a2, b1, b2):
        lo = max(a1, b1)
        hi = min(a2, b2)
        return max(0.0, hi - lo)

    # Collapse duplicate gap-doors that come from top/bottom (or left/right)
    # edges of the same thick wall opening.
    deduped_gap_doors = []
    for cand in gap_doors:
        duplicate = False
        c_or = cand.get("orientation")
        for kept in deduped_gap_doors:
            if kept.get("orientation") != c_or:
                continue

            if c_or == "horizontal":
                dy = abs(cand["y1"] - kept["y1"])
                ov = _overlap_len(cand["x1"], cand["x2"], kept["x1"], kept["x2"])
                min_len = min(abs(cand["x2"] - cand["x1"]), abs(kept["x2"] - kept["x1"]))
                if dy <= 10 and min_len > 0 and ov >= 0.85 * min_len:
                    duplicate = True
                    break
            elif c_or == "vertical":
                dx = abs(cand["x1"] - kept["x1"])
                ov = _overlap_len(cand["y1"], cand["y2"], kept["y1"], kept["y2"])
                min_len = min(abs(cand["y2"] - cand["y1"]), abs(kept["y2"] - kept["y1"]))
                if dx <= 10 and min_len > 0 and ov >= 0.85 * min_len:
                    duplicate = True
                    break

        if not duplicate:
            deduped_gap_doors.append(cand)

    gap_doors = deduped_gap_doors

    merged = []
    used_arcs = set()

    for gap in gap_doors:
        gcx = (gap["x1"] + gap["x2"]) / 2
        gcy = (gap["y1"] + gap["y2"]) / 2

        best_idx = None
        best_dist = None
        for idx, arc in enumerate(arc_doors):
            if idx in used_arcs:
                continue

            dist = np.hypot(float(arc["cx"]) - gcx, float(arc["cy"]) - gcy)
            limit = max(match_margin, float(arc.get("radius", 0)) * 1.6 + 6)
            if dist > limit:
                continue

            if best_dist is None or dist < best_dist:
                best_dist = dist
                best_idx = idx

        if best_idx is not None:
            arc = arc_doors[best_idx]
            used_arcs.add(best_idx)
            # Keep gap geometry (for opening width/orientation) while preserving
            # arc metadata for downstream rendering/debugging.
            merged.append({
                **gap,
                "type": "door",
                "cx": int(arc["cx"]),
                "cy": int(arc["cy"]),
                "radius": int(arc["radius"]),
                "dominant_quadrant": int(arc.get("dominant_quadrant", 0)),
            })
        else:
            merged.append({**gap, "type": "door"})

    for idx, arc in enumerate(arc_doors):
        if idx not in used_arcs:
            merged.append({**arc, "type": "door"})

    for item in other:
        merged.append({**item, "type": "door"})

    return dedupe_opening_entries(merged, center_tol=24)


def opening_window_stroke_support(op, thin_layer, wall_thickness=8):
    """
    Estimate how strongly a raw opening overlaps a thin straight window marker.
    Returns support in [0, 1].
    """
    if thin_layer is None:
        return 0.0

    h, w = thin_layer.shape
    x1, y1, x2, y2 = int(op["x1"]), int(op["y1"]), int(op["x2"]), int(op["y2"])

    if abs(y1 - y2) <= abs(x1 - x2):
        xa, xb = sorted((x1, x2))
        if xb - xa < 6:
            return 0.0

        base_y = int(round((y1 + y2) / 2))
        span = max(4, int(wall_thickness * 1.2))
        best = 0.0
        for dy in range(-span, span + 1):
            yy = base_y + dy
            if yy < 0 or yy >= h:
                continue
            row = thin_layer[yy, max(0, xa):min(w, xb + 1)]
            if row.size == 0:
                continue
            best = max(best, float(np.mean(row > 128)))
        return best

    ya, yb = sorted((y1, y2))
    if yb - ya < 6:
        return 0.0

    base_x = int(round((x1 + x2) / 2))
    span = max(4, int(wall_thickness * 1.2))
    best = 0.0
    for dx in range(-span, span + 1):
        xx = base_x + dx
        if xx < 0 or xx >= w:
            continue
        col = thin_layer[max(0, ya):min(h, yb + 1), xx]
        if col.size == 0:
            continue
        best = max(best, float(np.mean(col > 128)))
    return best


def opening_near_outer_band(op, image_width, image_height, border_margin=110):
    """
    Return True when an opening lies close to the outer image boundary.
    """
    if not image_width or not image_height:
        return False

    x1, y1, x2, y2 = int(op["x1"]), int(op["y1"]), int(op["x2"]), int(op["y2"])
    min_x, max_x = min(x1, x2), max(x1, x2)
    min_y, max_y = min(y1, y2), max(y1, y2)

    near_left = min_x <= border_margin
    near_right = max_x >= image_width - border_margin
    near_top = min_y <= border_margin
    near_bottom = max_y >= image_height - border_margin

    orientation = op.get("orientation", "")
    if orientation == "horizontal":
        return near_top or near_bottom
    if orientation == "vertical":
        return near_left or near_right
    return near_left or near_right or near_top or near_bottom


# ══════════════════════════════════════════════════════════════════════════════
# DUPLICATE MERGING
# ══════════════════════════════════════════════════════════════════════════════

def remove_duplicate_lines(lines, tolerance=10, gap_threshold=10):
    """
    Merge collinear, overlapping or closely-spaced parallel line segments.
    gap_threshold controls the maximum gap between two segments that will still
    be merged; keep it small (<= 8) to preserve real door/window openings.
    """
    filtered = []

    for line in lines:
        x1, y1, x2, y2 = normalize_line(*line)
        merged = False

        for i, (fx1, fy1, fx2, fy2) in enumerate(filtered):
            fx1, fy1, fx2, fy2 = normalize_line(fx1, fy1, fx2, fy2)

            # Horizontal merge
            if abs(y1 - y2) < tolerance and abs(fy1 - fy2) < tolerance:
                if abs(y1 - fy1) < tolerance:
                    if not (x2 < fx1 - gap_threshold or x1 > fx2 + gap_threshold):
                        new_x1 = min(x1, fx1)
                        new_x2 = max(x2, fx2)
                        new_y  = int((y1 + fy1) / 2)
                        filtered[i] = (new_x1, new_y, new_x2, new_y)
                        merged = True
                        break

            # Vertical merge
            elif abs(x1 - x2) < tolerance and abs(fx1 - fx2) < tolerance:
                if abs(x1 - fx1) < tolerance:
                    if not (y2 < fy1 - gap_threshold or y1 > fy2 + gap_threshold):
                        new_y1 = min(y1, fy1)
                        new_y2 = max(y2, fy2)
                        new_x  = int((x1 + fx1) / 2)
                        filtered[i] = (new_x, new_y1, new_x, new_y2)
                        merged = True
                        break

        if not merged:
            filtered.append((x1, y1, x2, y2))

    return filtered


# ══════════════════════════════════════════════════════════════════════════════
# INTERSECTION FIXING
# ══════════════════════════════════════════════════════════════════════════════

def connect_wall_intersections(lines, snap_threshold=12):
    """
    Close small broken gaps at wall T- and L-junctions so that intersections
    are correctly connected in the graph.
    """
    updated = lines[:]

    for i in range(len(updated)):
        x1, y1, x2, y2 = normalize_line(*updated[i])

        for j in range(len(updated)):
            if i == j:
                continue

            a1, b1, a2, b2 = normalize_line(*updated[j])

            # Horizontal wall + vertical wall
            if abs(y1 - y2) < snap_threshold and abs(a1 - a2) < snap_threshold:
                hy  = y1
                hx1, hx2 = x1, x2
                vx, vy1, vy2 = a1, b1, b2

                if hx1 - snap_threshold <= vx <= hx2 + snap_threshold:
                    if abs(vy1 - hy) < snap_threshold:
                        updated[j] = (vx, hy, vx, vy2)
                    elif abs(vy2 - hy) < snap_threshold:
                        updated[j] = (vx, vy1, vx, hy)

            # Vertical wall + horizontal wall
            elif abs(x1 - x2) < snap_threshold and abs(b1 - b2) < snap_threshold:
                vx, vy1, vy2 = x1, y1, y2
                hy, hx1, hx2 = b1, a1, a2

                if vy1 - snap_threshold <= hy <= vy2 + snap_threshold:
                    if abs(hx1 - vx) < snap_threshold:
                        updated[j] = (vx, hy, hx2, hy)
                    elif abs(hx2 - vx) < snap_threshold:
                        updated[j] = (hx1, hy, vx, hy)

    return updated


# ══════════════════════════════════════════════════════════════════════════════
# STRUCTURE FILTER (kept for backwards-compat; not used in main pipeline)
# ══════════════════════════════════════════════════════════════════════════════

def near_contour(line, contours, tolerance=35):
    """
    Legacy helper — kept for external callers.
    Note: near_contour misses long straight walls because CHAIN_APPROX_SIMPLE
    contours store only endpoints; use line_on_thick_layer instead.
    """
    x1, y1, x2, y2 = line
    check_points = [
        (x1, y1), (x2, y2),
        (int((x1 + x2) / 2), int((y1 + y2) / 2)),       # midpoint
        (int(x1 * 0.75 + x2 * 0.25), int(y1 * 0.75 + y2 * 0.25)),  # q1
        (int(x1 * 0.25 + x2 * 0.75), int(y1 * 0.25 + y2 * 0.75)),  # q3
    ]
    for cnt in contours:
        for point in cnt:
            px, py = point[0]
            for cx, cy in check_points:
                if abs(cx - px) < tolerance and abs(cy - py) < tolerance:
                    return True
    return False


def classify_wall_type(x1, y1, x2, y2, width, height, margin=35):
    if (
        min(x1, x2) < margin or max(x1, x2) > width - margin or
        min(y1, y2) < margin or max(y1, y2) > height - margin
    ):
        return "outer_wall"
    return "inner_wall"


# ══════════════════════════════════════════════════════════════════════════════
# DOOR DETECTION  (quarter-circle arc)
# ══════════════════════════════════════════════════════════════════════════════

def detect_doors(gray, thin_layer=None, min_radius=15, max_radius=80):
    """
    Detect door symbols from arc-like connected components in the thin layer.
    """
    if thin_layer is None:
        _, source = cv2.threshold(gray, 210, 255, cv2.THRESH_BINARY_INV)
    else:
        source = thin_layer.copy()

    source = cv2.morphologyEx(source, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        source, connectivity=8
    )
    if num_labels <= 1:
        return []

    doors = []
    min_bbox = max(12, int(0.9 * min_radius))
    max_bbox = int(2.2 * max_radius)

    for label in range(1, num_labels):
        area = int(stats[label, cv2.CC_STAT_AREA])
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        bw = int(stats[label, cv2.CC_STAT_WIDTH])
        bh = int(stats[label, cv2.CC_STAT_HEIGHT])

        if area < 120 or area > 4500:
            continue
        if min(bw, bh) < min_bbox:
            continue
        if max(bw, bh) > max_bbox:
            continue

        aspect = max(bw, bh) / max(1, min(bw, bh))
        if aspect > 1.45:
            continue

        fill = area / float(max(1, bw * bh))
        # Thin arc components are sparse inside their bounding square.
        if not (0.025 <= fill <= 0.22):
            continue

        cx = x + bw / 2.0
        cy = y + bh / 2.0

        ys, xs = np.where(labels == label)
        if len(xs) < 30:
            continue

        quadrant_hits = np.zeros(4, dtype=int)
        for px, py in zip(xs, ys):
            q = (1 if py < cy else 0) * 2 + (1 if px < cx else 0)
            quadrant_hits[q] += 1

        dominant_ratio = float(quadrant_hits.max()) / len(xs)
        if dominant_ratio < 0.36:
            continue

        radius = max(bw, bh) / 2.0
        if radius < min_radius or radius > max_radius:
            continue

        aspect_score = 1.0 - min(abs(aspect - 1.0), 0.45) / 0.45
        fill_score = 1.0 - min(abs(fill - 0.09), 0.09) / 0.09
        score = 0.9 * dominant_ratio + 0.6 * aspect_score + 0.5 * fill_score

        doors.append({
            "type": "door",
            "cx": int(round(cx)),
            "cy": int(round(cy)),
            "radius": int(round(radius)),
            "dominant_quadrant": int(quadrant_hits.argmax()),
            "x1": int(x),
            "y1": int(y),
            "x2": int(x + bw),
            "y2": int(y + bh),
            "score": float(score),
        })

    return dedupe_symbol_candidates(doors, center_tol=20, size_tol=12)


# ══════════════════════════════════════════════════════════════════════════════
# WINDOW DETECTION  (thin parallel line pairs)
# ══════════════════════════════════════════════════════════════════════════════

def detect_windows(thin_layer,
                   align_tol=8,
                   pair_dist_min=4,
                   pair_dist_max=24,
                   min_len=15):
    """
    Detect window symbols from the thin_layer (door arcs + window lines).
    """
    windows = []

    clean = cv2.morphologyEx(
        thin_layer, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1
    )

    # 1) Hollow-box contours (best match for typical window symbols)
    contours, hierarchy = cv2.findContours(clean, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is not None:
        hier = hierarchy[0]
        for idx, cnt in enumerate(contours):
            child_idx = hier[idx][2]
            if child_idx < 0:
                continue

            x, y, w, h = cv2.boundingRect(cnt)
            if max(w, h) < max(min_len, 14):
                continue
            if min(w, h) < 5:
                continue

            aspect = max(w, h) / max(1, min(w, h))
            if aspect < 1.6:
                continue

            outer_area = cv2.contourArea(cnt)
            inner_area = cv2.contourArea(contours[child_idx])
            box_area = float(w * h)
            ring_area = max(outer_area - inner_area, 1.0)
            ring_fill = ring_area / box_area

            if outer_area < 0.35 * box_area:
                continue
            if ring_fill > 0.45:
                continue

            orientation = "horizontal" if w >= h else "vertical"
            windows.append({
                "type": "window",
                "orientation": orientation,
                "x1": int(x),
                "y1": int(y),
                "x2": int(x + w),
                "y2": int(y + h),
                "cx": int(x + w / 2),
                "cy": int(y + h / 2),
                "score": float(outer_area / box_area),
            })

    # 2) Fallback: parallel thin-line pairs (for partially broken boxes)
    # Only run when contour-based detection found nothing; this avoids
    # promoting arbitrary interior thin lines to windows.
    thin_lines = None
    if len(windows) == 0:
        thin_lines = cv2.HoughLinesP(
            clean,
            rho=1,
            theta=np.pi / 180,
            threshold=8,
            minLineLength=min_len,
            maxLineGap=10,
        )

    if thin_lines is not None:
        h_lines, v_lines = [], []
        for line in thin_lines:
            x1, y1, x2, y2 = normalize_line(*line[0])
            if abs(y1 - y2) < align_tol:
                h_lines.append((x1, y1, x2, y2))
            elif abs(x1 - x2) < align_tol:
                v_lines.append((x1, y1, x2, y2))

        h_lines = remove_duplicate_lines(h_lines, tolerance=4, gap_threshold=4)
        v_lines = remove_duplicate_lines(v_lines, tolerance=4, gap_threshold=4)

        for i in range(len(h_lines)):
            for j in range(i + 1, len(h_lines)):
                x1a, y1a, x2a, _ = h_lines[i]
                x1b, y1b, x2b, _ = h_lines[j]

                dy = abs(y1a - y1b)
                if not (pair_dist_min <= dy <= pair_dist_max):
                    continue

                ox1 = max(x1a, x1b)
                ox2 = min(x2a, x2b)
                overlap = ox2 - ox1
                if overlap < min_len:
                    continue

                shorter = min(x2a - x1a, x2b - x1b)
                if overlap < 0.65 * shorter:
                    continue

                windows.append({
                    "type": "window",
                    "orientation": "horizontal",
                    "x1": int(ox1),
                    "y1": int(min(y1a, y1b)),
                    "x2": int(ox2),
                    "y2": int(max(y1a, y1b)),
                    "cx": int((ox1 + ox2) / 2),
                    "cy": int((y1a + y1b) / 2),
                    "score": float(overlap),
                })

        for i in range(len(v_lines)):
            for j in range(i + 1, len(v_lines)):
                x1a, y1a, _, y2a = v_lines[i]
                x1b, y1b, _, y2b = v_lines[j]

                dx = abs(x1a - x1b)
                if not (pair_dist_min <= dx <= pair_dist_max):
                    continue

                oy1 = max(y1a, y1b)
                oy2 = min(y2a, y2b)
                overlap = oy2 - oy1
                if overlap < min_len:
                    continue

                shorter = min(y2a - y1a, y2b - y1b)
                if overlap < 0.65 * shorter:
                    continue

                windows.append({
                    "type": "window",
                    "orientation": "vertical",
                    "x1": int(min(x1a, x1b)),
                    "y1": int(oy1),
                    "x2": int(max(x1a, x1b)),
                    "y2": int(oy2),
                    "cx": int((x1a + x1b) / 2),
                    "cy": int((oy1 + oy2) / 2),
                    "score": float(overlap),
                })

    return dedupe_symbol_candidates(windows, center_tol=16, size_tol=14)


# ══════════════════════════════════════════════════════════════════════════════
# OPENING CLASSIFICATION
# ══════════════════════════════════════════════════════════════════════════════

def classify_openings(raw_openings, doors, windows,
                       door_radius_margin=35,
                       window_margin=28,
                       thin_layer=None,
                       wall_thickness=8,
                       image_width=None,
                       image_height=None,
                       outer_band_margin=110):
    """
    Assign a semantic type to each raw wall gap:
      'door'    — gap centroid is within (radius + margin) of a detected door arc.
      'window'  — gap centroid is within margin px of a detected window line-pair.
      'opening' — wall passage with no door or window symbol.
    Priority: door > window > opening.
    """
    classified = []

    for op in raw_openings:
        cx = (op["x1"] + op["x2"]) / 2
        cy = (op["y1"] + op["y2"]) / 2
        gap = max(float(op.get("gap", 0)), abs(op["x2"] - op["x1"]), abs(op["y2"] - op["y1"]))

        best_door_score = None
        for door in doors:
            dist = np.hypot(float(door["cx"]) - cx, float(door["cy"]) - cy)
            norm = max(float(door.get("radius", gap * 0.5)) + door_radius_margin, gap * 0.65 + 12)
            score = dist / max(norm, 1.0)
            if best_door_score is None or score < best_door_score:
                best_door_score = score

        best_window_score = None
        for win in windows:
            wc_x = float(win.get("cx", (win["x1"] + win["x2"]) / 2))
            wc_y = float(win.get("cy", (win["y1"] + win["y2"]) / 2))
            dist = np.hypot(wc_x - cx, wc_y - cy)
            norm = max(window_margin, gap * 0.55 + 10)
            score = dist / max(norm, 1.0)
            if best_window_score is None or score < best_window_score:
                best_window_score = score

        stroke_support = opening_window_stroke_support(
            op, thin_layer, wall_thickness=wall_thickness
        )
        near_outer_band = opening_near_outer_band(
            op, image_width, image_height, border_margin=outer_band_margin
        )

        label = "opening"
        if best_door_score is not None and best_door_score < 0.90:
            if (
                best_window_score is None
                or best_door_score <= best_window_score + 0.08
            ) and stroke_support < 0.34:
                label = "door"
        if (
            label == "opening"
            and best_window_score is not None
            and best_window_score < 0.92
            and (near_outer_band or best_window_score < 0.72)
        ):
            label = "window"
        if label == "opening" and near_outer_band and stroke_support >= 0.40 and gap >= 26:
            label = "window"
        if (
            label == "opening"
            and near_outer_band
            and 72 <= gap <= 130
            and (best_door_score is None or best_door_score > 0.95)
        ):
            label = "window"

        classified.append({**op, "type": label})

    return classified


# ══════════════════════════════════════════════════════════════════════════════
# RAW OPENING DETECTION  (wall gaps)
# ══════════════════════════════════════════════════════════════════════════════

def detect_raw_openings(segments, min_gap=20, max_gap=130, align_tol=8):
    """
    Find all gaps between collinear wall segments.
    Returns un-classified opening dicts (x1/y1/x2/y2 + orientation + gap size).
    """
    openings = []
    horizontals, verticals = [], []

    for seg in segments:
        x1, y1, x2, y2 = normalize_line(
            seg["x1"], seg["y1"], seg["x2"], seg["y2"]
        )
        if abs(y1 - y2) < align_tol:
            horizontals.append((x1, y1, x2, y2))
        elif abs(x1 - x2) < align_tol:
            verticals.append((x1, y1, x2, y2))

    # ── Horizontal gaps ───────────────────────────────────────────────────────
    for i in range(len(horizontals)):
        for j in range(i + 1, len(horizontals)):
            x1a, y1a, x2a, _ = horizontals[i]
            x1b, y1b, x2b, _ = horizontals[j]

            if abs(y1a - y1b) >= align_tol:
                continue

            if x2a < x1b:
                lx2, ly, rx1 = x2a, y1a, x1b
            elif x2b < x1a:
                lx2, ly, rx1 = x2b, y1b, x1a
            else:
                continue  # overlapping

            gap = rx1 - lx2
            if min_gap <= gap <= max_gap:
                openings.append({
                    "orientation": "horizontal",
                    "x1": int(lx2), "y1": int(ly),
                    "x2": int(rx1), "y2": int(ly),
                    "gap": int(gap)
                })

    # ── Vertical gaps ─────────────────────────────────────────────────────────
    for i in range(len(verticals)):
        for j in range(i + 1, len(verticals)):
            x1a, y1a, _, y2a = verticals[i]
            x1b, y1b, _, y2b = verticals[j]

            if abs(x1a - x1b) >= align_tol:
                continue

            if y2a < y1b:
                ty2, tx, by1 = y2a, x1a, y1b
            elif y2b < y1a:
                ty2, tx, by1 = y2b, x1b, y1a
            else:
                continue

            gap = by1 - ty2
            if min_gap <= gap <= max_gap:
                openings.append({
                    "orientation": "vertical",
                    "x1": int(tx), "y1": int(ty2),
                    "x2": int(tx), "y2": int(by1),
                    "gap": int(gap)
                })

    return openings


# ══════════════════════════════════════════════════════════════════════════════
# MAIN PROCESSOR
# ══════════════════════════════════════════════════════════════════════════════

def process_floorplan(image_path):
    image = cv2.imread(image_path)

    if image is None:
        return {
            "walls": 0, "rooms": 0,
            "openings": 0, "doors": 0, "windows": 0,
            "wallSegments": [], "roomPolygons": [],
            "openingsData": [], "doorsData": [], "windowsData": [],
            "graph": {"nodes": [], "edges": []},
            "imageWidth": 0, "imageHeight": 0
        }

    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # ── 1. Binary threshold (dark lines on white background) ─────────────────
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=1)

    # ── 2. Estimate wall thickness ────────────────────────────────────────────
    wall_thickness = estimate_wall_thickness(thresh)

    # ── 3. Separate thick (walls) from thin (arcs / window lines) ────────────
    thick_layer, thin_layer = separate_thick_thin(thresh, wall_thickness)

    # ── 4. Hough line detection on thick layer ────────────────────────────────
    #    Lower threshold (50 vs 80) and shorter minLineLength (30 vs 40) lets
    #    us catch outer walls and shorter interior segments that the tighter
    #    settings silently dropped.
    lines = cv2.HoughLinesP(
        thick_layer,
        rho=1,
        theta=np.pi / 180,
        threshold=45,        # ↓ was 50 — catches short stubs flanking doors
        minLineLength=16,    # ↓ was 30 — catches short wall stubs next to door openings
        maxLineGap=8         # bridges tiny scan-line gaps
    )

    raw_segments = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]

            if not is_orthogonal(x1, y1, x2, y2, tolerance=12):
                continue
            if line_length(x1, y1, x2, y2) < 16:
                continue

            x1, y1, x2, y2 = snap_to_axis(x1, y1, x2, y2)

            # ── NEW: sample the thick_layer directly instead of near_contour ──
            # near_contour failed for long outer walls because CHAIN_APPROX_SIMPLE
            # contours only store corner points — the middle of a straight wall
            # had NO nearby contour vertices and was dropped.  Sampling thick_layer
            # pixels directly is both faster and correct for all wall lengths.
            # Use a slightly lower sample_ratio (0.38) to avoid dropping short stubs
            # that are partly covered by the door gap itself.
            if not line_on_thick_layer(x1, y1, x2, y2, thick_layer, sample_ratio=0.38):
                continue

            raw_segments.append((x1, y1, x2, y2))

    # ── 5. Wall segment cleanup pipeline ─────────────────────────────────────
    filtered = remove_duplicate_lines(raw_segments, tolerance=10, gap_threshold=8)
    filtered = connect_wall_intersections(filtered, snap_threshold=12)
    filtered = [normalize_line(*l) for l in filtered if line_length(*l) > 14]
    filtered = remove_duplicate_lines(filtered, tolerance=8, gap_threshold=6)
    filtered = sorted(filtered, key=lambda l: line_length(*l), reverse=True)

    outer_margin = max(40, int(min(width, height) * 0.07))
    wall_segments = []
    for x1, y1, x2, y2 in filtered:
        wall_segments.append({
            "x1":      int(x1), "y1": int(y1),
            "x2":      int(x2), "y2": int(y2),
            "wallType": classify_wall_type(x1, y1, x2, y2, width, height, margin=outer_margin)
        })

    # ── 6. Build wall graph ───────────────────────────────────────────────────
    graph = build_wall_graph(wall_segments)

    # ── 7. Detect all raw wall gaps ──────────────────────────────────────────
    scale = max(width, height) / 1024.0
    raw_openings = detect_raw_openings(
        wall_segments,
        min_gap=int(18 * scale),
        max_gap=int(130 * scale),
        align_tol=8
    )

    # ── 8. Symbol detection (doors/windows) on thin layer ─────────────────────
    doors = detect_doors(
        gray,
        thin_layer=thin_layer,
        min_radius=max(10, int(12 * scale)),
        max_radius=max(22, int(85 * scale))
    )
    windows = detect_windows(
        thin_layer,
        min_len=max(12, int(14 * scale))
    )

    # Door arc detector is already strict; keep its candidates to avoid dropping
    # valid symbols when a wall-gap segment was fragmented by raster artifacts.
    windows = filter_symbols_near_openings(
        windows, raw_openings, kind="window", margin=max(16, int(28 * scale))
    )

    # ── 9. Classify gaps → door / window / opening ───────────────────────────
    classified = classify_openings(
        raw_openings, doors, windows,
        door_radius_margin=int(35 * scale),
        window_margin=int(28 * scale),
        thin_layer=thin_layer,
        wall_thickness=wall_thickness,
        image_width=width,
        image_height=height,
        outer_band_margin=max(92, int(120 * scale)),
    )

    doors_data   = [op for op in classified if op["type"] == "door"]
    windows_data = [op for op in classified if op["type"] == "window"]
    plain_openings = [op for op in classified if op["type"] == "opening"]

    # Append any directly-detected windows that weren't matched to a gap.
    for win in windows:
        already = any(
            abs(win["cx"] - int((op["x1"] + op["x2"]) / 2)) < 30 and
            abs(win["cy"] - int((op["y1"] + op["y2"]) / 2)) < 30
            for op in windows_data
        )
        if not already:
            windows_data.append({**win, "type": "window"})

    # Append any directly-detected door arcs that weren't matched to a gap.
    for door in doors:
        already = any(
            abs(door["cx"] - int((op["x1"] + op["x2"]) / 2)) < 32 and
            abs(door["cy"] - int((op["y1"] + op["y2"]) / 2)) < 32
            for op in doors_data
        )
        if not already:
            doors_data.append({**door, "type": "door"})

    doors_data = merge_door_gap_and_arc_entries(
        doors_data, match_margin=max(44, int(56 * scale))
    )
    doors_data = dedupe_opening_entries(doors_data, center_tol=20)
    windows_data = dedupe_opening_entries(windows_data, center_tol=18)

    # ── 11. Room polygon extraction ───────────────────────────────────────────
    room_polygons = []
    all_contours, _ = cv2.findContours(
        thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    for cnt in all_contours:
        area = cv2.contourArea(cnt)
        if area > 8000:
            approx  = cv2.approxPolyDP(cnt, 5, True)
            polygon = [{"x": int(pt[0][0]), "y": int(pt[0][1])} for pt in approx]
            room_polygons.append(polygon)

    return {
        "walls":        len(wall_segments),
        "rooms":        len(room_polygons),
        "openings":     len(plain_openings),
        "doors":        len(doors_data),
        "windows":      len(windows_data),
        "wallSegments": wall_segments,
        "roomPolygons": room_polygons,
        "openingsData": plain_openings,
        "doorsData":    doors_data,
        "windowsData":  windows_data,
        "graph":        graph,
        "imageWidth":   width,
        "imageHeight":  height
    }