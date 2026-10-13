"""Vector Aces parts kit for Blender (run headless via the `bpy` module).

Every ship is a short recipe built from these parts. Units are millimetres, matching the
2D ship art: the ship faces -Y (nose up on the board), X is right, Z is up, and a small
ship fits roughly inside +/-17 mm (it sits on a 40 mm base).

Style: painted-miniature "lacquer and chrome" — glossy candy paint, ivory/gold trim,
chrome engine hardware, smoked glass and glowing engines.
"""
import bpy, bmesh, math
from mathutils import Vector

# ---------------------------------------------------------------- materials
# Colours are linear RGB. Each faction palette fills the same roles, so recipes
# only ever say "paint", "accent", "trim"... and the faction decides the look.
PALETTES = {
    'league': {     # warm ivory hulls, candy vermilion, orange engine glow
        'paint':  ((0.80, 0.74, 0.62), 0.25, 0.30),
        'accent': ((0.62, 0.035, 0.018), 0.55, 0.22),
        'trim':   ((0.05, 0.055, 0.06), 0.6, 0.35),
        'glow':   (1.0, 0.42, 0.08),
    },
    'dominion': {   # cool porcelain, graphite blades, emerald identification + glow
        'paint':  ((0.72, 0.75, 0.77), 0.30, 0.28),
        'accent': ((0.012, 0.30, 0.10), 0.55, 0.25),
        'trim':   ((0.035, 0.042, 0.05), 0.70, 0.32),
        'glow':   (0.18, 1.0, 0.45),
    },
    'syndicate': {  # candy violet, gold leaf trim, magenta glow
        'paint':  ((0.20, 0.035, 0.36), 0.65, 0.22),
        'accent': ((0.60, 0.40, 0.12), 0.85, 0.25),
        'trim':   ((0.20, 0.07, 0.03), 0.70, 0.40),
        'glow':   (1.0, 0.18, 0.75),
    },
}
SHARED = {
    'chrome': ((0.62, 0.64, 0.66), 1.0, 0.14),
    'steel':  ((0.26, 0.28, 0.30), 0.9, 0.30),
    'dark':   ((0.018, 0.02, 0.024), 0.5, 0.40),
    'glass':  ((0.01, 0.07, 0.09), 0.3, 0.06),
    'rock':   ((0.13, 0.11, 0.095), 0.0, 0.85),
    'rock2':  ((0.07, 0.065, 0.06), 0.1, 0.70),
}
M = {}


def _mat(name, col, metal, rough, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*col, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if 'Coat Weight' in p.inputs and rough < 0.3 and metal < 0.9:   # lacquer clear-coat
        p.inputs['Coat Weight'].default_value = 0.6
        p.inputs['Coat Roughness'].default_value = 0.05
    if emit:
        p.inputs['Emission Color'].default_value = (*col, 1)
        p.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*col, 1)
    return m


def reset(faction):
    """Empty the scene and load one faction's palette."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M.clear()
    pal = PALETTES[faction]
    for role in ('paint', 'accent', 'trim'):
        M[role] = _mat(role, *pal[role])
    for role, v in SHARED.items():
        M[role] = _mat(role, *v)
    M['glow'] = _mat('glow', pal['glow'], 0, 0.3, emit=12)


# ---------------------------------------------------------------- core helpers
def _obj(name, me, mat, bevel=0.0, smooth=False):
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(M[mat])
    o['bevel'] = bevel
    o['smooth'] = smooth
    return o


def _from_pydata(name, verts, faces, mat, bevel=0.0, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    return _obj(name, me, mat, bevel, smooth)


def _num(f, *a):
    return f(*a) if callable(f) else f


def mirror(pts):
    return [(-x, y) for x, y in pts]


def both(fn, *args, **kw):
    """Call a part builder for the right side, then mirrored for the left (x -> -x)."""
    fn(*args, **kw)
    fn(*_mirror_args(args), **kw)


def _mirror_args(args):
    out = []
    for a in args:
        if isinstance(a, list) and a and isinstance(a[0], tuple) and len(a[0]) == 2:
            out.append(mirror(a))
        elif isinstance(a, tuple) and len(a) == 3 and all(isinstance(v, (int, float)) for v in a):
            out.append((-a[0], a[1], a[2]))
        else:
            out.append(a)
    return out


# ---------------------------------------------------------------- shapes
def slab(name, outline, bottom, top, mat, bevel=0.25):
    """Top-down outline (x, y) extruded between bottom(x, y) and top(x, y) (numbers or functions).
    Wings, armour plates, fins and stripes are all slabs."""
    k = len(outline)
    # make the outline counter-clockwise seen from above so normals face out
    area = sum(outline[i][0] * outline[(i + 1) % k][1] - outline[(i + 1) % k][0] * outline[i][1] for i in range(k))
    if area < 0:
        outline = outline[::-1]
    v = [(x, y, _num(bottom, x, y)) for x, y in outline] + [(x, y, _num(top, x, y)) for x, y in outline]
    f = [tuple(range(k - 1, -1, -1)), tuple(range(k, 2 * k))] + [(i, (i + 1) % k, (i + 1) % k + k, i + k) for i in range(k)]
    return _from_pydata(name, v, f, mat, bevel)


def loft(name, sections, mat, n=20, squareness=2.6, bevel=0.0, cap=True):
    """Smooth fuselage through cross-sections (y, half_width, z_bottom, z_top[, x_centre]).
    Sections are rounded rectangles (super-ellipses); squareness 2 = oval, 4+ = boxy."""
    v, f = [], []
    e = 2.0 / squareness
    for s in sections:
        y, hw, zb, zt = s[:4]
        xc = s[4] if len(s) > 4 else 0.0
        zc, rz = (zb + zt) / 2, (zt - zb) / 2
        for i in range(n):
            a = math.tau * i / n
            c, sn = math.cos(a), math.sin(a)
            v.append((xc + hw * math.copysign(abs(c) ** e, c), y, zc + rz * math.copysign(abs(sn) ** e, sn)))
    for j in range(len(sections) - 1):
        for i in range(n):
            a, b = j * n + i, j * n + (i + 1) % n
            f.append((a, b, b + n, a + n))
    if cap:
        f.append(tuple(range(n)))
        f.append(tuple(range(len(v) - 1, len(v) - n - 1, -1)))
    o = _from_pydata(name, v, f, mat, bevel, smooth=True)
    # make sure normals point outward whichever way the sections run
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free()
    return o


def loft_top(sections, y):
    """Height of a loft's top surface at y (for laying stripes and canopies on it)."""
    pts = sorted((s[0], s[3]) for s in sections)
    for (y0, z0), (y1, z1) in zip(pts, pts[1:]):
        if y0 <= y <= y1:
            return z0 + (z1 - z0) * (y - y0) / (y1 - y0 or 1)
    return pts[0][1] if y < pts[0][0] else pts[-1][1]


def cyl(name, p, r, length, mat, axis='Y', n=16, bevel=0.12, scale=None):
    """Cylinder centred at p along an axis. scale=(sx, sy, sz) squashes it (oval pods)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=n, radius1=r, radius2=r, depth=length)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = _obj(name, me, mat, bevel, smooth=True)
    if axis == 'Y':
        o.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == 'X':
        o.rotation_euler = (0, math.pi / 2, 0)
    o.location = p
    if scale:
        o.scale = scale
    return o


def cone(name, p, r1, r2, length, mat, axis='Y', n=16, bevel=0.1):
    """Tapered cylinder; r1 at the -axis end, r2 at the +axis end."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=n, radius1=r1, radius2=r2, depth=length)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = _obj(name, me, mat, bevel, smooth=True)
    if axis == 'Y':
        o.rotation_euler = (-math.pi / 2, 0, 0)
    o.location = p
    return o


def beam(name, a, b, r, mat, n=8):
    """Rod from point a to point b (pipes, struts, gun barrels)."""
    a, b = Vector(a), Vector(b)
    o = cyl(name, (a + b) / 2, r, (b - a).length, mat, axis='Z', n=n, bevel=0)
    o.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return o


def blob(name, p, radii, mat, n=24):
    """Ellipsoid (insect body segments, domes, sensor eyes)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=n, v_segments=max(8, n // 2), radius=1)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = _obj(name, me, mat, 0, smooth=True)
    o.location = p
    o.scale = radii
    return o


def box(name, p, size, mat, bevel=0.15):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = _obj(name, me, mat, bevel)
    o.location = p
    return o


# ---------------------------------------------------------------- assemblies
def engine(p, r, length, casing='accent', n=20, detail=False):
    """Hot-rod thruster facing +Y: painted casing, chrome bands, recessed glowing nozzle.
    p = centre of the casing. detail=True adds an intake fan, heat-sink rings and nozzle petals."""
    x, y, z = p
    y0, y1 = y - length / 2, y + length / 2
    cyl('engine casing', (x, y - 0.1 * length, z), r, length * 0.8, casing, n=n, bevel=0.15)
    cyl('engine band', (x, y0 + 0.3 * length, z), r * 1.06, length * 0.08, 'chrome', n=n, bevel=0.05)
    cyl('engine collar', (x, y1 - 0.12 * length, z), r * 1.02, length * 0.24, 'chrome', n=n, bevel=0.1)
    if detail:
        intake_fan((x, y0 - 0.05, z), r * 0.98)
        for k in range(4):
            cyl('heat sink', (x, y1 - 0.3 * length + k * 0.42, z), r * 1.08, 0.18, 'dark', n=n, bevel=0)
        exhaust_petals((x, y1 + 0.02, z), r * 0.92)
    else:
        cyl('engine intake', (x, y0 - 0.02, z), r * 0.72, 0.15, 'dark', n=n, bevel=0)
    cyl('nozzle well', (x, y1 + 0.01, z), r * 0.82, 0.12, 'dark', n=n, bevel=0)
    cyl('nozzle glow', (x, y1 + 0.03, z), r * 0.62, 0.12, 'glow', n=n, bevel=0)
    cyl('nozzle cone', (x, y1 + 0.06, z), r * 0.28, 0.14, 'steel', n=12, bevel=0)


def cannon(p, length, r=0.32, housing=0.75, mat='paint', detail=False):
    """Gun pointing -Y from p: painted housing, steel barrel, chrome muzzle.
    detail=True adds cooling rings, a vented flash suppressor and a rear power coupling."""
    x, y, z = p
    cyl('gun housing', (x, y, z), housing, 2.4, mat, n=12, bevel=0.15)
    cyl('gun barrel', (x, y - 1.2 - length / 2, z), r, length, 'steel', n=10, bevel=0)
    cyl('gun muzzle', (x, y - 1.2 - length + 0.3, z), r * 1.5, 0.7, 'chrome', n=10, bevel=0.05)
    cyl('gun bore', (x, y - 1.2 - length - 0.02, z), r * 0.6, 0.08, 'dark', n=8, bevel=0)
    if detail:
        for k in range(3):
            cyl('barrel ring', (x, y - 1.6 - k * 0.45, z), r * 1.45, 0.2, 'dark', n=10, bevel=0)
        cyl('barrel jacket', (x, y - 1.2 - length * 0.55, z), r * 1.2, length * 0.25, 'trim', n=10, bevel=0.03)
        for k in range(4):
            a = math.tau * k / 4 + math.pi / 4
            box('suppressor slot', (x + math.cos(a) * r * 1.42, y - 1.2 - length + 0.35, z + math.sin(a) * r * 1.42), (0.12, 0.5, 0.12), 'dark', 0)
        cyl('power coupling', (x, y + 1.35, z), housing * 0.7, 0.4, 'chrome', n=12, bevel=0.04)


def canopy(y_front, y_back, z_base, half_w, height, frame='chrome'):
    """Faceted glass canopy: sloped windscreen, flat roof, raked back, chrome edges."""
    yf, yb = y_front, y_back
    yr0, yr1 = yf + (yb - yf) * 0.35, yf + (yb - yf) * 0.78
    zt = z_base + height
    w2 = half_w * 0.62
    v = [(-half_w * 0.7, yf, z_base), (half_w * 0.7, yf, z_base),
         (-w2, yr0, zt), (w2, yr0, zt), (-w2, yr1, zt), (w2, yr1, zt),
         (-half_w, yb, z_base), (half_w, yb, z_base),
         (-half_w, (yf + yb) / 2, z_base), (half_w, (yf + yb) / 2, z_base)]
    f = [(0, 1, 3, 2), (2, 3, 5, 4), (4, 5, 7, 6), (0, 2, 8), (2, 4, 6, 8), (1, 9, 3), (3, 9, 7, 5), (6, 7, 9, 8), (8, 9, 1, 0)]
    _from_pydata('canopy glass', v, f, 'glass', 0.04)
    for a, b in [(0, 1), (0, 2), (1, 3), (2, 3), (4, 5), (2, 4), (3, 5), (4, 6), (5, 7)]:
        beam('canopy frame', v[a], v[b], 0.11, frame, n=6)


def stripe(outline, surface, mat='accent', lift=0.04, thick=0.06):
    """Thin raised paint panel laid on a surface: surface(x, y) gives the height underneath."""
    return slab('stripe', outline, lambda x, y: surface(x, y) + lift - thick / 2,
                lambda x, y: surface(x, y) + lift + thick / 2, mat, bevel=0)


def rock(name, radius, seed, lumps=0.35):
    """Asteroid: a lumpy, faceted rock with a darker crater pass."""
    from mathutils import noise
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=radius)
    off = Vector((seed * 7.31, seed * 3.17, seed * 5.53))
    for v in bm.verts:
        d = v.co.normalized()
        h = noise.fractal(d * 1.6 + off, 0.6, 2.2, 4)
        c = noise.cell(d * 2.8 + off)
        v.co = d * radius * (1 + lumps * h - 0.12 * max(0, 0.35 - c))
    v_scale = Vector((1.0, 0.82, 0.62))
    for v in bm.verts:
        v.co = Vector((v.co.x * v_scale.x, v.co.y * v_scale.y, v.co.z * v_scale.z))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = _obj(name, me, 'rock', 0)
    o.data.materials.append(M['rock2'])
    # darker material on low-lying faces reads as craters and grooves
    for poly in o.data.polygons:
        r = Vector(poly.center).length / radius
        poly.material_index = 1 if r < 0.93 else 0
    o['flat'] = True
    return o


# ---------------------------------------------------------------- detail parts ("greebles")
def vents(p, n, pitch, size, axis='Y', mat='dark', frame='trim'):
    """A bank of n slots along an axis, set in a raised frame. size = (w, l, h) of one slot."""
    x, y, z = p
    w, l, h = size
    span = pitch * (n - 1) + l
    if axis == 'Y':
        box('vent frame', (x, y, z - h * 0.3), (w + 0.35, span + 0.35, h), frame, 0.08)
        for i in range(n):
            box('vent slot', (x, y - span / 2 + l / 2 + i * pitch, z + h * 0.2), (w, l * 0.55, h * 0.6), mat, 0)
    else:
        box('vent frame', (x, y, z - h * 0.3), (span + 0.35, w + 0.35, h), frame, 0.08)
        for i in range(n):
            box('vent slot', (x - span / 2 + l / 2 + i * pitch, y, z + h * 0.2), (l * 0.55, w, h * 0.6), mat, 0)


def hatch(p, size, mat='paint', bolts=True, tilt=(0, 0, 0)):
    """Raised access panel with corner bolts."""
    x, y, z = p
    w, l = size
    o = box('hatch', (x, y, z), (w, l, 0.16), mat, 0.05)
    o.rotation_euler = tilt
    if bolts:
        for bx in (-1, 1):
            for by in (-1, 1):
                b = cyl('bolt', (x + bx * (w / 2 - 0.22), y + by * (l / 2 - 0.22), z + 0.09), 0.09, 0.08, 'steel', axis='Z', n=6, bevel=0)
                b.rotation_euler = tilt


def pipe(points, r, mat='steel', n=8):
    """A pipe run through a list of points, with a collar at each bend."""
    for a, b in zip(points, points[1:]):
        beam('pipe', a, b, r, mat, n)
    for q in points[1:-1]:
        blob('pipe joint', q, (r * 1.35,) * 3, mat, n=8)


def intake_fan(p, r, vanes=12, axis_dir=-1):
    """Engine intake facing -Y (axis_dir=-1): chrome lip, dark throat, spinner and angled fan blades."""
    x, y, z = p
    cyl('intake lip', (x, y, z), r * 1.02, 0.35, 'chrome', n=24, bevel=0.06)
    cyl('intake throat', (x, y + 0.25 * -axis_dir, z), r * 0.86, 0.3, 'dark', n=24, bevel=0)
    blob('spinner', (x, y + axis_dir * 0.1, z), (r * 0.26, r * 0.32, r * 0.26), 'steel', n=12)
    for i in range(vanes):
        a = math.tau * i / vanes
        beam('fan blade', (x + math.cos(a) * r * 0.25, y + axis_dir * 0.05, z + math.sin(a) * r * 0.25),
             (x + math.cos(a + 0.35) * r * 0.82, y + axis_dir * 0.05, z + math.sin(a + 0.35) * r * 0.82), r * 0.07, 'steel', n=4)


def exhaust_petals(p, r, petals=12):
    """Ring of nozzle petals flaring out behind an exhaust facing +Y."""
    x, y, z = p
    for i in range(petals):
        a = math.tau * i / petals
        beam('nozzle petal', (x + math.cos(a) * r * 0.95, y, z + math.sin(a) * r * 0.95),
             (x + math.cos(a) * r * 0.78, y + r * 0.45, z + math.sin(a) * r * 0.78), r * 0.11, 'steel', n=4)


def antenna(base, top, r=0.08):
    beam('antenna', base, top, r, 'steel', n=6)
    blob('antenna tip', top, (r * 1.8,) * 3, 'glow', n=8)


def decal_text(text, p, size, mat='trim', rot=(0, 0, 0), thick=0.05):
    """Raised lettering (squadron numbers, hull codes), converted to a mesh."""
    cu = bpy.data.curves.new('decal', 'FONT')
    cu.body = text; cu.size = size; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = thick / 2
    o = bpy.data.objects.new('decal', cu)
    bpy.context.scene.collection.objects.link(o)
    o.location = p; o.rotation_euler = rot
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.view_layer.objects.active
    o.data.materials.clear(); o.data.materials.append(M[mat])
    o['bevel'] = 0
    return o


# ---------------------------------------------------------------- baked paint layer
def _n(nt, kind, **props):
    node = nt.nodes.new(kind)
    for k, v in props.items():
        setattr(node, k, v)
    return node


def _paint_shader(mat, scorch, panel=(0.28, 0.16, 0.28), wear=1.0):
    """Swap a material's output for an emission shader that computes its painted look:
    base colour x recess wash (AO) x panel lines x grime x scorch, plus worn, lighter edges."""
    nt = mat.node_tree; L = nt.links.new
    pr = nt.nodes['Principled BSDF']
    base = tuple(pr.inputs['Base Color'].default_value)
    metal = pr.inputs['Metallic'].default_value
    tc = _n(nt, 'ShaderNodeTexCoord')
    geo = _n(nt, 'ShaderNodeNewGeometry')
    mul = lambda a, b: _math(nt, 'MULTIPLY', a, b)
    # recess wash: ambient occlusion
    ao = _n(nt, 'ShaderNodeAmbientOcclusion', samples=16, only_local=True)
    ao.inputs['Distance'].default_value = 1.4
    ao_t = _range(nt, ao.outputs['AO'], 0, 1, 0.22, 1)
    # panel lines: plate seams in object space (plates are longer along the hull)
    sc = _n(nt, 'ShaderNodeVectorMath', operation='MULTIPLY'); sc.inputs[1].default_value = panel
    L(tc.outputs['Object'], sc.inputs[0])
    vor = _n(nt, 'ShaderNodeTexVoronoi', feature='DISTANCE_TO_EDGE', voronoi_dimensions='3D')
    vor.inputs['Scale'].default_value = 1.0; vor.inputs['Randomness'].default_value = 0.35
    L(sc.outputs[0], vor.inputs['Vector'])
    line_t = _range(nt, vor.outputs['Distance'], 0.0, 0.03, 0.42, 1)
    # grime: soft blotches
    noi = _n(nt, 'ShaderNodeTexNoise'); noi.inputs['Scale'].default_value = 0.16; noi.inputs['Detail'].default_value = 6
    L(tc.outputs['Object'], noi.inputs['Vector'])
    grime_t = _range(nt, noi.outputs['Fac'], 0.3, 0.75, 0.86 if metal < 0.8 else 0.93, 1.0)
    shade = mul(mul(ao_t, line_t), grime_t)
    # scorch around exhausts and muzzles
    for (pt, radius) in scorch:
        d = _n(nt, 'ShaderNodeVectorMath', operation='DISTANCE'); d.inputs[1].default_value = pt
        L(tc.outputs['Object'], d.inputs[0])
        shade = mul(shade, _range(nt, d.outputs['Value'], 0, radius, 0.12, 1))
    # worn edges: convex edges show lighter bare metal, broken up by noise
    edge = _range(nt, geo.outputs['Pointiness'], 0.5, 0.56, 0, 1)
    chips = _n(nt, 'ShaderNodeTexNoise'); chips.inputs['Scale'].default_value = 1.6; chips.inputs['Detail'].default_value = 8
    L(tc.outputs['Object'], chips.inputs['Vector'])
    edge = mul(edge, _range(nt, chips.outputs['Fac'], 0.42, 0.6, 0.25, 1.0))
    # candy paint chips less visibly than ivory; polished metal hardly at all
    edge = mul(edge, 0.55 * wear * (0.5 if metal > 0.8 else 0.35 if mat.name == 'accent' else 1.0))
    col = _n(nt, 'ShaderNodeVectorMath', operation='SCALE')
    col.inputs[0].default_value = base[:3]
    L(shade, col.inputs['Scale'])
    hi = _n(nt, 'ShaderNodeVectorMath', operation='SCALE'); hi.inputs[0].default_value = (0.55, 0.55, 0.56)
    L(edge, hi.inputs['Scale'])
    add = _n(nt, 'ShaderNodeVectorMath', operation='ADD')
    L(col.outputs[0], add.inputs[0]); L(hi.outputs[0], add.inputs[1])
    em = _n(nt, 'ShaderNodeEmission')
    L(add.outputs[0], em.inputs['Color'])
    out = nt.nodes['Material Output']
    L(em.outputs[0], out.inputs['Surface'])
    return pr, out


def _math(nt, op, a, b):
    m = _n(nt, 'ShaderNodeMath', operation=op)
    for i, v in enumerate((a, b)):
        if isinstance(v, (int, float)):
            m.inputs[i].default_value = v
        else:
            nt.links.new(v, m.inputs[i])
    return m.outputs[0]


def _range(nt, src, a, b, c, d):
    r = _n(nt, 'ShaderNodeMapRange', clamp=True)
    r.inputs['From Min'].default_value = a; r.inputs['From Max'].default_value = b
    r.inputs['To Min'].default_value = c; r.inputs['To Max'].default_value = d
    nt.links.new(src, r.inputs['Value'])
    return r.outputs['Result']


def bake_paint(ship, size=2048, scorch=(), samples=20, wear=1.0, path=None):
    """Unwrap the ship and bake the painted look into one colour texture shared by all its materials."""
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ship; ship.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new(ship.name + '_paint', size, size)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
    restore = []
    for mat in ship.data.materials:
        nt = mat.node_tree
        if mat.name in ('glow', 'glass'):   # these keep their own look
            continue
        pr, out = _paint_shader(mat, scorch, wear=wear)
        tex = _n(nt, 'ShaderNodeTexImage', image=img)
        nt.nodes.active = tex
        restore.append((mat, pr, out, tex))
    for mat in ship.data.materials:
        if mat.name in ('glow', 'glass'):   # their faces still need an active image to bake into
            tex = _n(mat.node_tree, 'ShaderNodeTexImage', image=img); mat.node_tree.nodes.active = tex
    bpy.ops.object.bake(type='EMIT', margin=6, use_clear=True)
    for mat, pr, out, tex in restore:
        nt = mat.node_tree
        nt.links.new(pr.outputs[0], out.inputs['Surface'])
        nt.links.new(tex.outputs['Color'], pr.inputs['Base Color'])
    for mat in ship.data.materials:
        if mat.name in ('glow', 'glass'):
            for nd in [x for x in mat.node_tree.nodes if x.type == 'TEX_IMAGE']:
                mat.node_tree.nodes.remove(nd)
    if path:
        img.filepath_raw = str(path); img.file_format = 'PNG'; img.save()
    return img


# ---------------------------------------------------------------- finish + export
def finish(name):
    """Apply bevels, then merge everything into one mesh (one draw call per material)."""
    dg = bpy.context.evaluated_depsgraph_get()
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH':
            continue
        if o.get('bevel', 0) > 0:
            m = o.modifiers.new('bevel', 'BEVEL')
            m.width = o['bevel']; m.segments = 2; m.limit_method = 'ANGLE'
            m.angle_limit = math.radians(35); m.harden_normals = False
    dg.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.convert(target='MESH')   # applies modifiers
        o.select_set(False)
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    ship = bpy.context.view_layer.objects.active
    ship.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = ship.data
    flat = any(o.get('flat') for o in [ship])
    for p in me.polygons:
        p.use_smooth = not flat
    me.set_sharp_from_angle(angle=math.radians(40))
    # (join already shares one slot per material, so no remapping is needed)
    return ship


def stats(o):
    me = o.data
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    dims = o.dimensions
    return {'tris': tris, 'materials': len(me.materials), 'size_mm': [round(dims.x, 1), round(dims.y, 1), round(dims.z, 1)]}


def export_glb(o, path):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_materials='EXPORT',
                              export_image_format='JPEG', export_jpeg_quality=88)
