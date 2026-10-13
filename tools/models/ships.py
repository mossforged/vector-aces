"""Ship recipes. Each follows the ship's 2D art in src/render/shipArt.js (same mm coordinates,
nose toward -Y) and is built only from kit parts."""
import math
from kit import (loft, loft_top, slab, cyl, cone, beam, blob, box, engine, cannon, canopy,
                 stripe, mirror, rock)

SIDES = (1, -1)


def lancer():
    """League Lancer: forward-swept dart, long nose, twin rear thrusters."""
    body = [(-18.6, 0.5, -0.2, 0.5), (-15, 1.5, -0.9, 1.2), (-9, 2.8, -1.5, 2.0), (-2, 3.5, -1.8, 2.5),
            (5, 3.9, -1.8, 2.3), (11.5, 3.6, -1.5, 1.8), (12.6, 2.6, -1.0, 1.2)]
    loft('fuselage', body, 'paint', squareness=3.0)
    top = lambda x, y: loft_top(body, y)
    # twin racing stripes down the spine and a red nose cap
    for s in SIDES:
        stripe([(s * 0.5, -16.6), (s * 1.0, -16.6), (s * 1.25, -7.4), (s * 0.75, -7.4)], top, lift=0.1)
    loft('nose cap', [(-18.9, 0.35, -0.12, 0.42), (-17.2, 1.0, -0.55, 0.85), (-15.4, 1.62, -0.98, 1.27)], 'accent', squareness=3.0)
    canopy(-7.2, 0.2, loft_top(body, -3) - 0.35, 1.75, 1.35)
    box('spine vent', (0, 3.2, 2.1), (2.2, 3.0, 0.5), 'trim', 0.12)
    for s in SIDES:
        # forward-swept wing, thin at the tip, with a candy-red tip band
        wing = [(s * 3, 4), (s * 16, -2), (s * 15.5, 3), (s * 4, 10)]
        thick = lambda x, y: 0.55 - 0.025 * abs(x)
        slab('wing', wing, lambda x, y: -0.2 - thick(x, y), lambda x, y: -0.2 + thick(x, y), 'paint', 0.15)
        band = [(s * 11.5, 0.3), (s * 13.2, -0.6), (s * 13.2, 4.3), (s * 11.5, 5.3)]
        stripe(band, lambda x, y: -0.2 + 0.55 - 0.025 * abs(x), lift=0.03)
        slab('wing root fairing', [(s * 3.2, 3.5), (s * 6, 2.4), (s * 6, 9), (s * 3.2, 10)], -1.0, 0.8, 'trim', 0.2)
        cannon((s * 15.9, 0.2, -0.2), 6.0, r=0.3, housing=0.62)
        engine((s * 5.6, 11.3, 0.25), 1.95, 8.2)
        box('engine pylon', (s * 4.4, 10.4, 0.2), (1.6, 4.0, 1.2), 'trim', 0.15)
    cyl('nose sensor', (0, -18.7, 0.12), 0.18, 0.4, 'glow', n=8, bevel=0)


def wasp():
    """Dominion Wasp: segmented insect body, two pairs of swept blade-wings, stinger cannon."""
    blob('head', (0, -9, 0.6), (2.8, 3.2, 2.3), 'paint')
    blob('thorax', (0, -1, 0.8), (3.8, 4.6, 2.9), 'paint')
    blob('abdomen', (0, 9, 0.5), (3.2, 7.2, 2.5), 'paint')
    for y, l in [(-5.4, 1.4), (3.5, 1.4)]:
        cyl('waist joint', (0, y, 0.7), 1.6, l, 'steel', n=16)
    # emerald bands around the abdomen
    for yb in (6.5, 9.5, 12.5):
        k = math.sqrt(max(0.05, 1 - ((yb - 9) / 7.2) ** 2))
        cyl('abdomen band', (0, yb, 0.5), 3.2 * k + 0.07, 0.7, 'accent', n=24, bevel=0.05, scale=(1, 1, 2.5 / 3.2))
    # head: glowing compound eyes, mandible guns and a stinger cannon under the chin
    for s in SIDES:
        blob('eye', (s * 1.45, -10.9, 1.2), (1.1, 1.0, 0.95), 'glow', n=16)
        blob('eye socket', (s * 1.45, -10.6, 1.15), (1.3, 1.1, 1.15), 'trim', n=16)
    beam('stinger barrel', (0, -11.5, -0.9), (0, -17.5, -0.9), 0.28, 'steel', n=10)
    cyl('stinger muzzle', (0, -17.2, -0.9), 0.45, 0.8, 'chrome', n=10, bevel=0.05)
    cyl('stinger mount', (0, -11.4, -0.9), 0.8, 1.6, 'trim', n=12)
    blob('dorsal dome', (0, -1.6, 3.25), (1.6, 2.2, 0.8), 'glass', n=20)
    for s in SIDES:
        # front blades: curved, angled upward; rear blades: shorter, angled downward
        def curve(p0, p1, p2, q1, n=10):
            """Blade outline: leading edge p0->p2 bowed toward p1, trailing edge back via q1."""
            q = lambda a, b, c, t: tuple((1 - t) ** 2 * a[i] + 2 * (1 - t) * t * b[i] + t * t * c[i] for i in (0, 1))
            lead = [q(p0, p1, p2, i / n) for i in range(n + 1)]
            trail = [q(p0, q1, p2, 1 - i / n) for i in range(1, n)]
            return lead + trail
        fw = curve((s * 2.5, -4.5), (s * 16, -11), (s * 17, 2), (s * 10, -0.5))
        fw = fw + [(s * 2.5, 1.0)]
        up = lambda x, y: 1.4 + 0.16 * abs(x)
        slab('front blade', fw, lambda x, y: up(x, y) - 0.28, lambda x, y: up(x, y) + 0.28, 'trim', 0.12)
        stripe([(s * 12.5, -5.6), (s * 14.0, -5.1), (s * 15.6, 0.6), (s * 14.2, 0.1)], lambda x, y: up(x, y) + 0.28, lift=0.03)
        rw = curve((s * 2.5, 2.5), (s * 12, 3.5), (s * 13, 13), (s * 7, 8))
        rw = rw + [(s * 2.5, 7.0)]
        dn = lambda x, y: 0.2 - 0.12 * abs(x)
        slab('rear blade', rw, lambda x, y: dn(x, y) - 0.25, lambda x, y: dn(x, y) + 0.25, 'trim', 0.12)
        cyl('wing hinge', (s * 2.9, -1.6, 1.6), 0.9, 4.2, 'steel', n=12)
        cyl('blade gun', (s * 15.4, -3.6, up(15.4, 0) - 0.2), 0.3, 4.0, 'chrome', n=8, bevel=0)
    # tail thruster
    cyl('tail collar', (0, 15.8, 0.5), 1.4, 1.2, 'chrome', n=16)
    cyl('tail well', (0, 16.42, 0.5), 1.05, 0.1, 'dark', n=16, bevel=0)
    cyl('tail glow', (0, 16.45, 0.5), 0.85, 0.1, 'glow', n=16, bevel=0)


def raptor():
    """Syndicate Raptor: heavy blunt nose, forward-swept stub wings, wide three-engine block."""
    body = [(-17.2, 3.6, -1.1, 1.1), (-15.5, 4.6, -1.6, 2.0), (-8, 5.9, -2.0, 2.9),
            (2, 7.0, -2.1, 3.0), (8.5, 7.6, -2.0, 2.7)]
    loft('hull', body, 'paint', squareness=3.4)
    top = lambda x, y: loft_top(body, y)
    # hot-rod grille across the blunt nose, gold hood stripes, scoop
    box('grille frame', (0, -17.25, -0.05), (6.4, 0.5, 1.9), 'trim', 0.2)
    for z in (-0.55, -0.05, 0.45):
        cyl('grille bar', (0, -17.55, z), 0.17, 6.0, 'chrome', axis='X', n=8, bevel=0)
    for s in SIDES:
        stripe([(s * 1.1, -16.4), (s * 1.9, -16.4), (s * 1.9, -13.2), (s * 1.1, -13.2)], top, lift=0.12)
        cyl('headlight', (s * 3.6, -16.9, 0.3), 0.55, 0.4, 'glow', n=12, bevel=0)
    canopy(-12.4, -5.6, loft_top(body, -9) - 0.4, 2.4, 1.5, frame='accent')
    box('hood scoop', (0, -2.4, 3.0), (3.2, 4.0, 1.0), 'chrome', 0.3)
    box('scoop mouth', (0, -4.42, 3.0), (2.4, 0.1, 0.55), 'dark', 0)
    # wide engine block (rusted bronze) with three thrusters and side exhaust headers
    box('engine block', (0, 11.2, 0.3), (16.2, 6.4, 4.2), 'trim', 0.4)
    for s in SIDES:
        for j in range(3):
            y = 9.2 + j * 1.5
            beam('header', (s * 8.0, y, 1.0), (s * 9.4, y + 0.4, 0.4), 0.32, 'chrome', n=8)
            beam('header run', (s * 9.4, y + 0.4, 0.4), (s * 9.4, 14.6, 0.4), 0.32, 'chrome', n=8)
    for x in (-4.6, 0, 4.6):
        engine((x, 13.5, 0.4), 1.7, 3.6, casing='paint')
    for s in SIDES:
        wing = [(s * 5.5, 2.5), (s * 15, -7), (s * 16.4, -3), (s * 7.5, 8.5)]
        slab('stub wing', wing, lambda x, y: -0.9 - 0.02 * abs(x), lambda x, y: -0.1 - 0.02 * abs(x), 'paint', 0.2)
        stripe([(s * 12.2, -3.6), (s * 14.4, -5.9), (s * 15.2, -3.9), (s * 13.2, -1.3)],
               lambda x, y: -0.1 - 0.02 * abs(x), lift=0.03)
        cannon((s * 15.6, -4.2, -0.5), 3.6, r=0.36, housing=0.75, mat='accent')


def asteroid(seed=1):
    rock('asteroid', 30, seed)


SHIPS = {'lancer': ('league', lancer), 'wasp': ('dominion', wasp), 'raptor': ('syndicate', raptor),
         'asteroid': ('league', asteroid)}
