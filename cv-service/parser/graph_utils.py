import math


def distance(x1, y1, x2, y2):
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)


def normalize_line(x1, y1, x2, y2):
    # Horizontal
    if abs(y1 - y2) < abs(x1 - x2):
        if x1 > x2:
            return x2, y2, x1, y1
    # Vertical
    else:
        if y1 > y2:
            return x2, y2, x1, y1
    return x1, y1, x2, y2


def snap_point_to_existing(point, existing_points, threshold=12):
    px, py = point
    for ex, ey in existing_points:
        if distance(px, py, ex, ey) <= threshold:
            return (ex, ey)
    return point


def build_wall_graph(wall_segments, snap_threshold=12):
    """
    Convert wall segments into graph nodes (endpoints / intersections)
    and graph edges (wall connections).

    Every edge now carries a stable, zero-padded wall_id string (e.g. "W-01")
    so that the frontend label and the structural classifier can reference
    the same wall unambiguously.
    """
    nodes    = []
    node_map = {}
    edges    = []

    def get_or_create_node(x, y):
        snapped = snap_point_to_existing((x, y), nodes, threshold=snap_threshold)
        if snapped in node_map:
            return node_map[snapped]
        node_id = len(nodes) + 1
        nodes.append(snapped)
        node_map[snapped] = node_id
        return node_id

    for idx, wall in enumerate(wall_segments):
        x1, y1, x2, y2 = normalize_line(
            wall["x1"], wall["y1"], wall["x2"], wall["y2"]
        )
        n1 = get_or_create_node(x1, y1)
        n2 = get_or_create_node(x2, y2)

        # ── Indexed wall ID ──────────────────────────────────────────────────
        # 1-based, zero-padded to 2 digits so labels sort correctly up to 99.
        # Increase padding (e.g. :03d) for larger floor plans.
        wall_id = f"W-{idx + 1:02d}"

        edges.append({
            "from":     n1,
            "to":       n2,
            "type":     "wall",
            "wallType": wall.get("wallType", "inner_wall"),
            "wall_id":  wall_id,          # ← new stable index
            "x1": x1, "y1": y1,
            "x2": x2, "y2": y2,
        })

    graph_nodes = [
        {"id": i + 1, "x": pt[0], "y": pt[1]}
        for i, pt in enumerate(nodes)
    ]
    return {"nodes": graph_nodes, "edges": edges}


def _size_hint(gap):
    """
    Rough size classification for a wall gap.
      narrow  → very small passage or measurement artefact
      door    → typical interior door width
      window  → typical window span
      wide    → wide opening / double door
    """
    if gap < 25:
        return "narrow"
    elif gap < 55:
        return "door"
    elif gap < 100:
        return "window"
    else:
        return "wide"


def detect_graph_openings(graph,
                           min_gap=20,
                           max_gap=130,
                           align_tol=8,
                           noise_guard=10):
    """
    Detect likely openings (doors, windows, passages) from aligned wall-segment gaps.

    Each detected opening now includes:
      - wall_id_left  / wall_id_top    — the ID of the wall segment on the left / top side
      - wall_id_right / wall_id_bottom — the ID of the wall segment on the right / bottom side

    This lets downstream code trace which walls bound each opening.

    Key improvements:
    ──────────────────────────────────────────────────────────────────────
    1. Tighter `align_tol` (8 px) — reduces false matches between nearly-parallel
       walls that happen to be close but are NOT on the same wall line.
    2. `noise_guard` — gaps smaller than this (px) are silently dropped.
    3. Correct directional gap formula — gap = right.x1 − left.x2 (or bottom.y1 − top.y2).
    4. `size_hint` field for downstream door-vs-window disambiguation.
    5. Expanded default `max_gap` to 130 px for wider window openings.
    """
    openings = []
    edges    = graph["edges"]

    horizontal_edges = [e for e in edges if abs(e["y1"] - e["y2"]) < align_tol]
    vertical_edges   = [e for e in edges if abs(e["x1"] - e["x2"]) < align_tol]

    # ── Horizontal aligned gaps ───────────────────────────────────────────────
    for i in range(len(horizontal_edges)):
        for j in range(i + 1, len(horizontal_edges)):
            e1 = horizontal_edges[i]
            e2 = horizontal_edges[j]

            if abs(e1["y1"] - e2["y1"]) >= align_tol:
                continue

            if e1["x2"] <= e2["x1"]:
                left, right = e1, e2
            elif e2["x2"] <= e1["x1"]:
                left, right = e2, e1
            else:
                continue  # overlapping — no physical gap

            gap = right["x1"] - left["x2"]

            if gap < noise_guard:
                continue
            if gap < min_gap or gap > max_gap:
                continue

            openings.append({
                "type":          "door_or_window",
                "size_hint":     _size_hint(gap),
                "orientation":   "horizontal",
                "x1":            int(left["x2"]),
                "y1":            int(left["y2"]),
                "x2":            int(right["x1"]),
                "y2":            int(right["y1"]),
                "gap":           int(gap),
                # ── Wall references ──────────────────────────────────────
                "wall_id_left":  left.get("wall_id"),
                "wall_id_right": right.get("wall_id"),
            })

    # ── Vertical aligned gaps ─────────────────────────────────────────────────
    for i in range(len(vertical_edges)):
        for j in range(i + 1, len(vertical_edges)):
            e1 = vertical_edges[i]
            e2 = vertical_edges[j]

            if abs(e1["x1"] - e2["x1"]) >= align_tol:
                continue

            if e1["y2"] <= e2["y1"]:
                top, bottom = e1, e2
            elif e2["y2"] <= e1["y1"]:
                top, bottom = e2, e1
            else:
                continue

            gap = bottom["y1"] - top["y2"]

            if gap < noise_guard:
                continue
            if gap < min_gap or gap > max_gap:
                continue

            openings.append({
                "type":           "door_or_window",
                "size_hint":      _size_hint(gap),
                "orientation":    "vertical",
                "x1":             int(top["x2"]),
                "y1":             int(top["y2"]),
                "x2":             int(bottom["x1"]),
                "y2":             int(bottom["y1"]),
                "gap":            int(gap),
                # ── Wall references ───────────────────────────────────────
                "wall_id_top":    top.get("wall_id"),
                "wall_id_bottom": bottom.get("wall_id"),
            })

    return openings