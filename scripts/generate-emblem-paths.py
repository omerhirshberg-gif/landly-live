"""Builds the Landly emblem's star and arrow from exact geometry and rewrites
lib/brand/emblemPaths.ts. The arch keeps its traced contour (read from the
current emblemPaths.ts) and is passed through unchanged.

The construction constants below were fitted once to the official app icon's
trace (sub-unit residuals), then fixed: the star's two triangles share one
centre, its bands one width, and the arrow's head is equilateral.

    python3 -m pip install numpy shapely
    python3 scripts/generate-emblem-paths.py
"""
import math, re, sys
from pathlib import Path
import numpy as np
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

# ── Construction (viewBox units, 526 x 512, y down) ──────────────────────
VIEW_W, VIEW_H = 526, 512
# Star of David: two equilateral triangles about one centre, each drawn as a
# ring of constant band width (the inner triangle is the outer one inset by BAND).
CX, CY, R, BAND = 225.7, 260.5, 253.7, 41.6
# Arrow: an equilateral head (side HEAD) on a shaft of half-width SHAFT_W that
# runs straight down the axis from the head's base, then sweeps into two
# G1-joined cubic Béziers, ending vertical on the baseline and tapering to TAIL_W.
TIP = (519.67, 6.08)
AXIS_DEG = -50.537          # base -> tip, from +x, y down
HEAD = 214.27
SHAFT_W = 43.13
STRAIGHT = 179.368          # straight shaft length below the head's base
MID = (191.924, 340.452)    # where the two Béziers meet
MID_DEG = math.degrees(2.966)
H1 = (34.812, 59.287)       # handle lengths, first Bézier (start, end)
H2 = (68.374, 85.063)       # handle lengths, second Bézier (start, end)
TAIL_X = 56.891
TAIL_W = 40.809
BASELINE = 504.5
# White clearance between the star and the arrow / arch that cross it.
GAP = 20.0

COLORS = {'light': '#035bc4', 'dark': '#013ba9'}

# ── Helpers ──────────────────────────────────────────────────────────────
def fmt(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s

def pt(p):
    return f'{fmt(p[0])} {fmt(p[1])}'

def ring_path(coords):
    cs = list(coords)[:-1]
    return 'M' + pt(cs[0]) + ''.join('L' + pt(c) for c in cs[1:]) + 'Z'

def poly_path(g, tol=0.01):
    g = g.simplify(tol, preserve_topology=True)
    polys = [g] if g.geom_type == 'Polygon' else list(g.geoms)
    out = ''
    for p in polys:
        p = Polygon(p.exterior.coords, [i.coords for i in p.interiors])
        out += ring_path(p.exterior.coords) + ''.join(ring_path(i.coords) for i in p.interiors)
    return out

def tri(r, up):
    s = -1 if up else 1
    return [(CX + r * math.sin(math.radians(a)), CY + s * r * math.cos(math.radians(a))) for a in (0, 120, 240)]

# ── Arrow ────────────────────────────────────────────────────────────────
a = np.array([math.cos(math.radians(AXIS_DEG)), math.sin(math.radians(AXIS_DEG))])
n = np.array([-a[1], a[0]])                       # toward the right barb
tip = np.array(TIP)
base = tip - HEAD * math.sqrt(3) / 2 * a
barb_l, barb_r = base - n * HEAD / 2, base + n * HEAD / 2
J = base - STRAIGHT * a
M = np.array(MID)
tM = np.array([math.cos(math.radians(MID_DEG)), math.sin(math.radians(MID_DEG))])
E = np.array([TAIL_X, BASELINE])
tE = np.array([0.0, 1.0])
BEZ = [np.array([J, J - H1[0] * a, M - H1[1] * tM, M]), np.array([M, M + H2[0] * tM, E - H2[1] * tE, E])]

def bez(P, t):
    t = np.asarray(t, float)[..., None]
    return (1 - t) ** 3 * P[0] + 3 * (1 - t) ** 2 * t * P[1] + 3 * (1 - t) * t ** 2 * P[2] + t ** 3 * P[3]

def dbez(P, t):
    t = np.asarray(t, float)[..., None]
    return 3 * (1 - t) ** 2 * (P[1] - P[0]) + 6 * (1 - t) * t * (P[2] - P[1]) + 3 * t ** 2 * (P[3] - P[2])

# Arc length along the curved part, for the linear taper.
_fine = np.linspace(0, 1, 4001)
_len = [np.r_[0, np.cumsum(np.linalg.norm(np.diff(bez(P, _fine), axis=0), axis=1))] for P in BEZ]
TOTAL = _len[0][-1] + _len[1][-1]

def width(i, t):
    s = np.interp(t, _fine, _len[i]) + (_len[0][-1] if i else 0)
    return SHAFT_W + (TAIL_W - SHAFT_W) * s / TOTAL

def offset(i, t, side):
    """Point on the edge `side` (+1 right/lower, -1 left/upper; 0 = centreline) of Bézier i."""
    d = dbez(BEZ[i], t)
    d = d / np.linalg.norm(d, axis=-1, keepdims=True)
    N = np.stack([d[..., 1], -d[..., 0]], -1)
    return bez(BEZ[i], t) + side * N * np.asarray(width(i, t))[..., None]

def cubic_fit(i, side, tol=0.005):
    """Cubic Bézier segments (Hermite) for an offset edge, refined until within tol."""
    k = 1
    while True:
        segs, worst = [], 0.0
        ts = np.linspace(0, 1, k + 1)
        for t0, t1 in zip(ts[:-1], ts[1:]):
            h = 1e-5
            P0, P1 = offset(i, t0, side), offset(i, t1, side)
            D0 = (offset(i, min(t0 + h, 1), side) - offset(i, max(t0 - h, 0), side)) / (min(t0 + h, 1) - max(t0 - h, 0))
            D1 = (offset(i, min(t1 + h, 1), side) - offset(i, max(t1 - h, 0), side)) / (min(t1 + h, 1) - max(t1 - h, 0))
            C = np.array([P0, P0 + D0 * (t1 - t0) / 3, P1 - D1 * (t1 - t0) / 3, P1])
            u = np.linspace(0, 1, 60)
            truth = offset(i, t0 + (t1 - t0) * u, side)
            approx = bez(C, u)
            worst = max(worst, float(np.max(np.linalg.norm(truth - approx, axis=1))))
            segs.append(C)
        if worst < tol:
            return segs
        k += 1

def edge_down(side):
    """Edge from the head's base down to the baseline, as path commands (start point excluded)."""
    cmds = []
    for i in (0, 1):
        for C in cubic_fit(i, side):
            cmds.append('C' + ' '.join(pt(p) for p in C[1:]))
    return cmds

def reverse(cmds, start):
    """Reverse a run of C commands that begins at `start`."""
    pts = [start]
    segs = []
    for c in cmds:
        nums = [float(v) for v in c[1:].split()]
        segs.append([pts[-1]] + [(nums[j], nums[j + 1]) for j in range(0, 6, 2)])
        pts.append(segs[-1][-1])
    out = []
    for s in reversed(segs):
        out.append('C' + ' '.join(pt(p) for p in (s[2], s[1], s[0])))
    return pts[-1], out

notch_l, notch_r = base - n * SHAFT_W, base + n * SHAFT_W
J_l, J_r = J - n * SHAFT_W, J + n * SHAFT_W
left_down = edge_down(-1)
right_down = edge_down(+1)
mid_down = edge_down(0)
end_r, right_up = reverse(right_down, tuple(J_r))
end_c, mid_up = reverse(mid_down, tuple(J))

arrow_light = ('M' + pt(tip) + 'L' + pt(barb_l) + 'L' + pt(notch_l) + 'L' + pt(J_l) + ''.join(left_down)
               + 'L' + pt(end_r) + ''.join(right_up) + 'L' + pt(notch_r) + 'L' + pt(barb_r) + 'Z')
arrow_dark = ('M' + pt(tip) + 'L' + pt(base) + 'L' + pt(J) + ''.join(mid_down)
              + 'L' + pt(end_r) + ''.join(right_up) + 'L' + pt(notch_r) + 'L' + pt(barb_r) + 'Z')

# Dense polygon of the arrow, for the boolean work on the star.
def dense_edge(side):
    t = np.linspace(0, 1, 800)
    return np.vstack([offset(0, t, side), offset(1, t, side)[1:]])
arrow_poly = Polygon([tip, barb_l, notch_l, *dense_edge(-1), *dense_edge(+1)[::-1], notch_r, barb_r])

# ── Arch (traced, unchanged) ─────────────────────────────────────────────
SRC = Path(__file__).resolve().parents[1] / 'lib/brand/emblemPaths.ts'
src = SRC.read_text()
arch_block = src[src.index('export const ARCH'):]
ARCH = {tone: re.search(tone + r": '([^']*)'", arch_block).group(1) for tone in ('light', 'dark')}
arch_poly = Polygon([(float(x), float(y)) for x, y in re.findall(r'(-?[\d.]+) (-?[\d.]+)', ARCH['light'])])

# ── Star ─────────────────────────────────────────────────────────────────
up_o, up_i = Polygon(tri(R, True)), Polygon(tri(R - 2 * BAND, True))
dn_o, dn_i = Polygon(tri(R, False)), Polygon(tri(R - 2 * BAND, False))
rings = up_o.difference(up_i).union(dn_o.difference(dn_i))
cut = rings.difference(arrow_poly.buffer(GAP, join_style='mitre')).difference(arch_poly.buffer(GAP, join_style='mitre'))
# Only the pieces above / beside the arrow are part of the mark: the star's
# own outline closes where the arrow sweeps across it, the rest is open space.
# Kept: the piece holding the apex, and the lower-right tip beside the arch.
apex = (CX, CY - R + 10)
right_tip = (CX + R * math.sin(math.radians(120)) - 15, CY + R / 2 - 5)
pieces = [g for g in cut.geoms if g.contains(Point(apex)) or g.contains(Point(right_tip))]
star = unary_union(pieces)

def half_plane(p, d, keep_left=True, big=4000):
    """Half-plane left (or right) of the directed line through p along d."""
    p, d = np.array(p, float), np.array(d, float) / np.linalg.norm(d)
    nrm = np.array([d[1], -d[0]]) * (-1 if keep_left else 1)
    return Polygon([p - d * big, p + d * big, p + d * big + nrm * big, p - d * big + nrm * big])

ut, ui = tri(R, True), tri(R - 2 * BAND, True)        # apex, bottom-right, bottom-left
dt, di = tri(R, False), tri(R - 2 * BAND, False)      # bottom apex, top-right, top-left
y_dt = dt[1][1]
world = box(-50, -50, VIEW_W + 50, VIEW_H + 50)
# Dark faces sit between the miter lines (outer vertex -> inner vertex) of a band.
# The up triangle's right band: between the apex miter (x = CX) and the bottom-right miter.
br_miter = half_plane(ut[1], np.subtract(ui[1], ut[1]), keep_left=True)
upR_band = up_o.difference(up_i).intersection(box(CX, -50, VIEW_W + 50, VIEW_H + 50)).intersection(br_miter)
# The down triangle's left band: between the top-left miter and the bottom-apex miter (x = CX).
tl_miter = half_plane(dt[2], np.subtract(di[2], dt[2]), keep_left=True)
dnL_band = dn_o.difference(dn_i).intersection(box(-50, -50, CX, VIEW_H + 50)).intersection(tl_miter)

d1 = upR_band.intersection(box(-50, -50, VIEW_W + 50, y_dt)).intersection(star)
d2 = up_i.intersection(box(-50, y_dt, CX, y_dt + BAND)).intersection(star)
d3 = dnL_band.intersection(star)
d4 = upR_band.intersection(box(-50, CY, VIEW_W + 50, VIEW_H + 50)).intersection(star)
star_dark = unary_union([d1, d2, d3, d4])

SRC.write_text(f"""// Vector Landly emblem, built from exact geometry by
// scripts/generate-emblem-paths.py (do not edit by hand):
//  - Star of David: two equilateral triangles about one centre ({fmt(CX)}, {fmt(CY)}),
//    circumradius {fmt(R)}, each a ring of constant band width {fmt(BAND)}; the darker
//    faces are bounded by the bands' miter lines.
//  - Arrow: an equilateral head (side {fmt(HEAD)}) on a straight shaft along a
//    {fmt(-AXIS_DEG)}° axis that sweeps into two G1-joined cubic Béziers; the right
//    half (axis to edge) is the darker face.
//  - A {fmt(GAP)}-unit white clearance separates the star from the arrow and the arch,
//    so the emblem works on any background.
//  - The arch keeps the contour traced from the official app icon.
// Each part has two tones, split so the entrance animation can stage them:
// the Star of David, the arch it stands on, and the arrow cutting through.
export const EMBLEM_VIEWBOX = {{ width: {VIEW_W}, height: {VIEW_H} }}

// The Star of David's vertical axis. The arrow reaches further right than the
// star does left, so the viewBox centre ({fmt(VIEW_W / 2)}) is not the mark's optical
// centre: lockups align this axis, not the box, with the text below it (as the
// master logo does).
export const EMBLEM_AXIS_X = {fmt(CX)}

export const EMBLEM_COLORS = {{ light: '{COLORS['light']}', dark: '{COLORS['dark']}' }}

type Part = {{ light: string; dark: string }}

export const STAR: Part = {{
  light: '{poly_path(star)}',
  dark: '{poly_path(star_dark)}',
}}

export const ARCH: Part = {{
  light: '{ARCH['light']}',
  dark: '{ARCH['dark']}',
}}

export const ARROW: Part = {{
  light: '{arrow_light}',
  dark: '{arrow_dark}',
}}
""")
print(f'wrote {SRC.relative_to(SRC.parents[2])}')
