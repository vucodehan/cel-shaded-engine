"""Map data for the motion-graphics map module: python mapdata.py <natural-earth-geojson-folder>

Reads Natural Earth (public domain) GeoJSON layers, clips them to the Bible lands, simplifies them and writes
_kit/src/mg/geo-data.ts (regenerate, never edit by hand). Two levels of detail:
  M  ne_50m land + coastline over lon -12..64, lat 10..48 (Spain to Persia, the Black Sea to Nubia and Sheba)
  H  ne_10m land + coastline over lon 31.5..38, lat 28..34.6 (Egypt's delta, Sinai, Canaan, Phoenicia, Damascus)
plus ne_10m lakes (natural only: reservoirs such as Nasser are modern) and named ne_10m rivers.
Download the layers from https://github.com/nvkelso/natural-earth-vector/tree/master/geojson:
ne_50m_land, ne_50m_coastline, ne_10m_land, ne_10m_coastline, ne_10m_lakes, ne_10m_rivers_lake_centerlines.
Coordinates are written as flat [lon, lat, lon, lat, ...] arrays with 3 decimals (about 100 m).
"""
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "_kit" / "src" / "mg" / "geo-data.ts"
BOX_M = (-12.0, 10.0, 64.0, 48.0)
BOX_H = (31.5, 28.0, 38.0, 34.6)
TOL_M, TOL_H = 0.02, 0.0035
RIVERS = {  # Natural Earth name -> label
    "Nile": "Nile", "White Nile": "Nile", "Blue Nile": "Blue Nile", "Abay": "Blue Nile", "Atbara": "Atbara",
    "Damietta Branch": "Nile", "Rosetta Branch": "Nile", "Euphrates": "Euphrates", "Al Furat": "Euphrates",
    "Firat": "Euphrates", "Murat": "Euphrates", "Tigris": "Tigris", "Dicle": "Tigris", "Shatt al Arab": "Tigris",
    "Jordan": "Jordan", "Tiber": "Tiber", "Karkheh": "Karkheh", "Aras": "Aras", "Ceyhan": "Ceyhan",
    "Byk Menderes": "Maeander", "Büyük Menderes": "Maeander", "Maritsa": "Hebrus", "Haliacmon": "Haliacmon",
}
LAKE_KEEP = ("Lake", "Alkaline Lake")


def load(folder: Path, name: str):
    return json.loads((folder / f"{name}.geojson").read_text(encoding="utf-8"))["features"]


def rings_of(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return geom["coordinates"]
    return []


def lines_of(geom):
    if geom["type"] == "LineString":
        return [geom["coordinates"]]
    if geom["type"] == "MultiLineString":
        return geom["coordinates"]
    return []


def clip_ring(ring, box):
    """Sutherland-Hodgman clip of a closed ring against an axis-aligned box."""
    x0, y0, x1, y1 = box
    edges = [(lambda p: p[0] >= x0, lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))),
             (lambda p: p[0] <= x1, lambda a, b: (x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0]))),
             (lambda p: p[1] >= y0, lambda a, b: (a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0)),
             (lambda p: p[1] <= y1, lambda a, b: (a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1))]
    pts = [tuple(p[:2]) for p in ring]
    for inside, cross in edges:
        if not pts:
            break
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cross(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cross(prev, cur))
        pts = out
    return pts


def clip_line(line, box):
    """Split a polyline into the runs inside the box (crossing points interpolated)."""
    x0, y0, x1, y1 = box
    inside = lambda p: x0 <= p[0] <= x1 and y0 <= p[1] <= y1  # noqa: E731

    def edge(a, b):
        best = None
        for t in ((x0 - a[0]) / (b[0] - a[0]) if b[0] != a[0] else None, (x1 - a[0]) / (b[0] - a[0]) if b[0] != a[0] else None,
                  (y0 - a[1]) / (b[1] - a[1]) if b[1] != a[1] else None, (y1 - a[1]) / (b[1] - a[1]) if b[1] != a[1] else None):
            if t is not None and 0 <= t <= 1:
                p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
                if x0 - 1e-9 <= p[0] <= x1 + 1e-9 and y0 - 1e-9 <= p[1] <= y1 + 1e-9:
                    best = p if best is None else best
        return best or b

    runs, cur = [], []
    pts = [tuple(p[:2]) for p in line]
    for i, p in enumerate(pts):
        if inside(p):
            if not cur and i and not inside(pts[i - 1]):
                cur.append(edge(pts[i - 1], p))
            cur.append(p)
        elif cur:
            cur.append(edge(cur[-1], p))
            runs.append(cur)
            cur = []
    if cur:
        runs.append(cur)
    return [r for r in runs if len(r) > 1]


def simplify(pts, tol):
    """Douglas-Peucker (iterative)."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        n2 = dx * dx + dy * dy
        far, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if n2 == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / n2))
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > far:
                far, idx = d, i
        if far > tol * tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def area(pts):
    return abs(sum(pts[i - 1][0] * p[1] - p[0] * pts[i - 1][1] for i, p in enumerate(pts))) / 2


def flat(pts):
    return "[" + ",".join(f"{x:.3f},{y:.3f}".replace(".000", "") for x, y in pts) + "]"


def land(features, box, tol, min_area):
    out = []
    for f in features:
        for poly in rings_of(f["geometry"]):
            for ring in poly:
                c = clip_ring(ring, box)
                if len(c) >= 3 and area(c) >= min_area:
                    s = simplify(c + [c[0]], tol)[:-1]
                    if len(s) >= 3:
                        out.append(s)
    return out


def coast(features, box, tol, min_len):
    out = []
    for f in features:
        for line in lines_of(f["geometry"]):
            for run in clip_line(line, box):
                s = simplify(run, tol)
                length = sum(((s[i][0] - s[i - 1][0]) ** 2 + (s[i][1] - s[i - 1][1]) ** 2) ** 0.5 for i in range(1, len(s)))
                if len(s) > 1 and length >= min_len:
                    out.append(s)
    return out


def main(folder: Path):
    land_m = land(load(folder, "ne_50m_land"), BOX_M, TOL_M, 0.004)
    coast_m = coast(load(folder, "ne_50m_coastline"), BOX_M, TOL_M, 0.15)
    land_h = land(load(folder, "ne_10m_land"), BOX_H, TOL_H, 0.0004)
    coast_h = coast(load(folder, "ne_10m_coastline"), BOX_H, TOL_H, 0.02)
    lakes = []
    for f in load(folder, "ne_10m_lakes"):
        p = f["properties"]
        if p.get("featurecla") not in LAKE_KEEP:
            continue
        for poly in rings_of(f["geometry"]):
            ring = clip_ring(poly[0], BOX_M)
            if len(ring) >= 3 and area(ring) >= 0.003:
                lakes.append((p.get("name_en") or p.get("name") or "", simplify(ring + [ring[0]], TOL_H)[:-1]))
    rivers = []
    for f in load(folder, "ne_10m_rivers_lake_centerlines"):
        p = f["properties"]
        if str(p.get("featurecla", "")).startswith("Lake"):
            continue  # lake centerlines would draw a line across the Dead Sea and the Sea of Galilee
        name = p.get("name_en") or p.get("name") or ""
        label = RIVERS.get(name) or ("Halys" if name.startswith("Kiz") else None)
        if not label:
            continue
        for line in lines_of(f["geometry"]):
            for run in clip_line(line, BOX_M):
                s = simplify(run, 0.006 if label == "Jordan" else 0.012)
                if len(s) > 1:
                    rivers.append((label, s))
    n_pts = sum(len(r) for r in land_m + coast_m + land_h + coast_h) + sum(len(r) for _, r in lakes + rivers)
    lines = [
        "// Generated by _tools/mapdata.py from Natural Earth (public domain). Do not edit; re-run the script instead.",
        "// Flat arrays [lon, lat, lon, lat, ...]. M: ne_50m over the Bible lands; H: ne_10m over Egypt's delta to Damascus.",
        f"export const BOX_M = {list(BOX_M)} as const;",
        f"export const BOX_H = {list(BOX_H)} as const;",
        "export const LAND_M: number[][] = [\n" + ",\n".join(flat(r) for r in land_m) + "];",
        "export const COAST_M: number[][] = [\n" + ",\n".join(flat(r) for r in coast_m) + "];",
        "export const LAND_H: number[][] = [\n" + ",\n".join(flat(r) for r in land_h) + "];",
        "export const COAST_H: number[][] = [\n" + ",\n".join(flat(r) for r in coast_h) + "];",
        "export const LAKES: { name: string; pts: number[] }[] = [\n" + ",\n".join(f'{{ name: {json.dumps(n)}, pts: {flat(r)} }}' for n, r in lakes) + "];",
        "export const RIVERS: { name: string; pts: number[] }[] = [\n" + ",\n".join(f'{{ name: {json.dumps(n)}, pts: {flat(r)} }}' for n, r in rivers) + "];",
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUT}: land M {len(land_m)} rings, coast M {len(coast_m)}, land H {len(land_h)}, coast H {len(coast_h)}, "
          f"{len(lakes)} lakes, {len(rivers)} river runs, {n_pts} points, {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
