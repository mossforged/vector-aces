"""Build ship models: python3 tools/models/build.py [names...] [--render]

Writes game-ready .glb files to lab/3d/models/ and (with --render) preview renders to
tools/models/previews/. Needs the `bpy` module: pip install bpy
"""
import sys, json, math
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bpy
from mathutils import Vector
import kit
from ships import SHIPS

ROOT = HERE.parent.parent
OUT = ROOT / 'lab' / '3d' / 'models'
PREV = HERE / 'previews'


def studio(target_size):
    sc = bpy.context.scene
    w = bpy.data.worlds.new('studio'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.02, 0.026, 0.04, 1); bg.inputs[1].default_value = 0.6
    s = target_size
    for name, pos, power, col, size in [('key', (0.3, -0.6, 1.0), 2.4, (0.85, 0.92, 1), 1.0),
                                        ('warm rim', (-1.0, 0.5, 0.6), 2.2, (1, 0.65, 0.38), 0.8),
                                        ('cool rim', (1.0, 0.8, 0.35), 2.4, (0.35, 0.6, 1), 0.7),
                                        ('fill', (-0.3, -1.0, 0.1), 0.9, (1, 0.9, 0.8), 0.8)]:
        d = bpy.data.lights.new(name, 'AREA'); d.energy = power * s * s * 25; d.color = col
        d.shape = 'DISK'; d.size = size * s
        o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
        o.location = Vector(pos) * s * 1.6
        o.rotation_euler = (-o.location).to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = target_size * 1.45
    sc.camera = cam
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24
    sc.cycles.use_denoising = True
    sc.render.resolution_x = 560; sc.render.resolution_y = 460
    sc.view_settings.view_transform = 'AgX'
    sc.render.image_settings.file_format = 'PNG'
    return cam


def render_views(name, size):
    cam = studio(size)
    views = {'front': (1.0, -1.25, 0.95), 'rear': (-0.9, 1.2, 0.8), 'top': (0.0001, -0.12, 1.0)}
    files = []
    for v, d in views.items():
        cam.location = Vector(d).normalized() * size * 3
        cam.rotation_euler = (-cam.location).to_track_quat('-Z', 'Y').to_euler()
        f = PREV / f'{name}_{v}.png'
        bpy.context.scene.render.filepath = str(f)
        bpy.ops.render.render(write_still=True)
        files.append(f)
    return files


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    render = '--render' in sys.argv
    OUT.mkdir(parents=True, exist_ok=True); PREV.mkdir(exist_ok=True)
    report = {}
    for name in args or SHIPS:
        faction, recipe = SHIPS[name]
        kit.reset(faction)
        recipe()
        ship = kit.finish(name)
        st = kit.stats(ship)
        kit.export_glb(ship, OUT / f'{name}.glb')
        st['kb'] = round((OUT / f'{name}.glb').stat().st_size / 1024)
        report[name] = st
        print(name, st, flush=True)
        if render:
            render_views(name, max(ship.dimensions))
    (OUT / 'stats.json').write_text(json.dumps(report, indent=1))


main()
