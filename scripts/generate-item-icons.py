"""Generate Aquaria's chunky inventory pixel art on a 12px logical grid.

The game displays 24px PNGs; each logical pixel is exactly 2x2 physical pixels.
Shapes are hand-pixelled with a full logical-pixel outline, broad color clusters
and a small palette. Terrain cubes and procedural pickaxes remain separate.
Run: python scripts/generate-item-icons.py
"""
from pathlib import Path
from tempfile import gettempdir
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / 'src' / 'art' / 'items'
ROOT.mkdir(parents=True, exist_ok=True)
SIZE = 12
INK = '#35434b'
WARM = '#503c39'
WOOD = ('#a77850', '#d5aa70', '#78513f')
COPPER = ('#cb805b', '#f5bc84', '#9b5746')
IRON = ('#9aafb0', '#d7e0cf', '#607982')
COBALT = ('#798bd0', '#b6c9f3', '#515f94')
GREEN = ('#609970', '#a3cb8a', '#3a6d58')
GOLD = ('#c6a05c', '#f0d28b', '#927047')
CLOTH = ('#b6a386', '#e4cfaa', '#83725f')
STONE = ('#58727a', '#86a0a0', '#425961')
BLUE = ('#508bb5', '#92c9dc', '#385d86')
POISON = ('#70b35d', '#bce58c', '#437d4d')

# Each pattern specifies the colored interior. A one-pixel border is added
# around its silhouette, including internal holes. Dots are transparent.
def art(pattern, colors, *, extra='', outline=INK):
    rows = pattern.split('/')
    width = max(map(len, rows))
    height = len(rows)
    assert width <= SIZE - 2 and height <= SIZE - 2, pattern
    palette = dict(zip('bhsacdef', (*colors, *extra.split())))
    cells = {}
    left, top = (SIZE - width) // 2, (SIZE - height) // 2
    for y, row in enumerate(rows):
        for x, key in enumerate(row):
            if key != '.':
                cells[left+x, top+y] = palette[key]
    assert cells, pattern
    im = Image.new('RGBA', (SIZE, SIZE))
    d = ImageDraw.Draw(im)
    for x, y in cells:
        for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)):
            d.point((x+dx, y+dy), fill=outline)
    for pos, color in cells.items():
        d.point(pos, fill=color)
    return im.resize((24,24), Image.Resampling.NEAREST)

def ore(metal):
    # Large exposed mineral face and one secondary deposit, not tiny facets.
    return art('...hh..../.aahbh.../ahhbbsa../ahbbssaaa/absssabaa/accabbsac/.ccabsscc/..cccccc.',
               metal, extra='#607780 #425963', outline=INK)

def sword(metal, curved=False):
    pattern = ('......hh./.....hbh./....hbs../...hbs.../..hbs..../.aab...../..aa...../.db.a..../db.......'
               if curved else
               '.......h./......hb./.....hbs./....hbs../...hbs.../..hbs..../.aa.a..../..aa...../.db.a..../db.......')
    return art(pattern, metal, extra='#d5aa70 #78513f #a77850')

def spear(metal):
    return art('.......hh/......hbs/.....hbs./.....bs../....aa.../...ad..../..ad...../.ad....../ad......./d........',
               metal, extra='#d5aa70 #78513f #a77850')

def armor(metal):
    return art('hh....hh./hbh..hbh./hbbhhbbs./sbbbbbbs./.bbbbbs../.bssbbs../.bbbbbs../.ssssss..', metal)

def snorkel(metal):
    return art('........h/........b/........b/.hhhhhh.b/hacccab.b/bcddccbsb/bcccccbss/.ssssss..',
               metal, extra='#70bbc4 #a9dcd9 #408496')

def arrow(metal):
    return art('.......hh/......hbs/.....hbs./.....bs../....ad.../...ad..../..ad...../.cad...../cda....../cc.......',
               metal, extra='#c39b64 #609970 #78513f')

def fish(cooked):
    colors = ('#c98248','#edb473','#955938') if cooked else ('#70a4b9','#aed8d9','#4e7893')
    return art('...s....../..hhh...s./.hhbbbb.bs/habbbbbsbs/hbbbbbbbs./.bbsss.bs./..sss.....', colors, extra='#35434b')

def crab(cooked):
    colors = ('#d95c3f','#ffa16a','#9e3f30') if cooked else ('#c96854','#eca082','#9d5145')
    return art('hb.....bh./bbh...hbb./.bhhhhbb../.habhab.../sbbbbbbbs./.bbbbbbb../s.sss.s.s.', colors, extra='#35434b')

ITEMS = {
    'wooden-shield': art('hhhhhhh/hbbabbs/hbbabbs/hbaaabs/hbbabbs/.bbabs./..sas../...s...', WOOD, extra='#d7e0cf', outline=WARM),
    'root-ring': art('.....aa../....aab../.hhhbs.../hbs..bs../hb....b../hb....s../.bb..bs../..ssss...', WOOD, extra='#609970', outline=WARM),
    'lesser-soul': art('...h.../..hhh../..hbb../.hbbbs./hbbbbbs/hbbbbbs/.sbbbs./..sss..', ('#73baf2','#bce9f6','#437caa')),
    'greater-soul': art('...h.../..hhh../..hab../.habbs./habbbbs/hbbbbbs/.sbbbs./..sss..', ('#dba968','#fff0b4','#8b6491'), extra='#f8d593'),
    'grappling-hook': art('...h..../h..b..h./b..b..b./bh.b.hb./.bbbbbs./..sbs.../...b..../..b.b.../...b....', IRON),
    'explorers-map': art('hh.hhh.hh/hbbbbbbbh/hbsbbsbbh/hbsbasbbh/hbsabasbh/hbbbbbbbs/ss.sss.ss', CLOTH, extra='#b65a4f', outline=WARM),
    'kelp-dressing': art('..hhhh.../.hbbabb../hbbabbas./hbabbabs./hbbababs./.ssssss..', CLOTH, extra='#609970', outline=WARM),
    'captains-cutlass': sword(IRON, True),
    'iron-sword': sword(IRON),
    'cobalt-spear': spear(COBALT),
    'spear': spear(IRON),
    'copper-spear': spear(COPPER),
    'bow': art('..h..../..bh.../..b.h../..b..h./aabbbba/..b..b./..b.b../..bs.../..s....', WOOD, extra='#d7e0cf', outline=WARM),
    'arrow': arrow(IRON),
    'poison-arrow': arrow(POISON),
    'poison-needle': art('......hh/.....hbs/....hbs./...hbs../..hbs.../.bs...../as......', POISON, extra='#a65b4a'),
    'door': art('.hhhhh./hbbbbbh/hbbbsbs/hbbbsbs/hbbbsas/hbbbsbs/hbbbsbs/sssssss', WOOD, extra='#eacb80', outline=WARM),
    'workbench': art('....hh.../...abbs../hhhhhhhhh/bbbbbbbbs/sssssssss/.b.....b./.bbbbbbb./.s.....s.', WOOD, extra='#9aafb0', outline=WARM),
    'fireplace': art('....h..../...hh..../...hbb.../..hbbbs../.hbbabs../.sbabss../aaddddaaa/.ccccccc.', ('#dc6843','#f8be68','#ae4c39'), extra='#8c6047 #607982 #c89863', outline=WARM),
    'raw-fish': fish(False),
    'cooked-fish': fish(True),
    'raw-crab': crab(False),
    'cooked-crab': crab(True),
    'copper-snorkel': snorkel(COPPER),
    'iron-snorkel': snorkel(IRON),
    'cobalt-snorkel': snorkel(COBALT),
    'diving-fin': art('......hh./....hhbb./.hhhbbbs./habbbbbs./hacbbbss./.sccsss../..ss.....', BLUE, extra='#c39b64 #345b75'),
    'scrappers-gloves': art('.h.h..h.h/.bbb..bbb/hbbbsbbbs/hbbbsbbbs/.bbbsbbbs/.ssbssbs./..ss.ss..', WOOD, outline=WARM),
    'explorers-anklet': art('..hhhhh../.hb...bh./hb.....bs/hb.....bs/.bs...bs./..bbbas../.....ah../.....ss..', IRON, extra='#c6a05c'),
    'padded-leg-wraps': art('hhh..hhh./hbbs.hbbs/hhbs.hhbs/hbbs.hbbs/hhbs.hhbs/hbbs.hbbs/.ss...ss.', CLOTH, outline=WARM),
    'prospectors-brooch': art('...h.../..hhh../.hacas./hacccas/hacccas/.sacas./..sss..', GOLD, extra='#65aea1 #b8e6d5', outline=WARM),
    'rusty-metal-scraps': art('.hh....../hbbh..hh./hbbs.hbbs/hbss.hbbs/.sss.hbss/..bsssss./..sss....', COPPER, outline=WARM),
    'torn-cloth': art('hh..hhh../hbhhbbbh./hbbbbbbs./.hbsbbbs./.hbsbbbs./hbbbsbss./.ss.s.s..', CLOTH, outline=WARM),
    'broken-gears': art('..bb.bb../.hhbbbbs./bhb...bsb/bb.....bb/.b.....s./bb.....sb/bbs...ssb/.sssssss./..bb.bb..', IRON),
    'ancient-coins': art('...hhh.../..hbhbs../.hbhbbbs./hbhbbbsb./hbbsssbbs/hbbbbbbs./.ssssss..', GOLD, outline=WARM),
    'glowshroom-torch': art('..hhhh.../.hhhhhb../hhbhhbbh./hbbbbbbbs/.sssssss./...aa..../...ac..../...ac....', ('#72bda0','#b5f0c9','#468d77'), extra='#c9a56e #78513f'),
    'rope-bundle': art('..hhhhh../.hbbbbbs./hb..h..bs/hb.hbs.bs/hb.sbs.bs/.bbbbbbs./..sssssbs/.......bs', WOOD, outline=WARM),
    'string': art('..hhhhh../.hbbbbbs./hb..h..bs/hb.hbs.bs/hb.sbs.bs/.bbbbbbs./..sssssbs/.......bs', ('#cbd5db','#edf2eb','#8d9fa8')),
    'tent': art('....a..../...hb.../..hhbb../..hhbb../.hhhbbbs./.hhbaabs./hhhbaaabs/sssaaasss', ('#536e69','#7d9690','#243a42'), extra='#8d6c52'),
    'kelp': art('.....hh../....hbb../.h..hbs../hbh.hbs../.bbhbs.../..bs..hh./hhbs.hbs./.bbbhbs../..sbs..../...s.....', GREEN),
    'copper': ore(COPPER),
    'iron': ore(IRON),
    'cobalt': ore(COBALT),
    'copper-breastplate': armor(COPPER),
    'iron-breastplate': armor(IRON),
    'cobalt-breastplate': armor(COBALT),
}

for spell, palette in [('firebolt', ('#b64e43', '#f8aa64', '#71383c')), ('frost-lance', ('#4a83ab', '#a6e5eb', '#355879')), ('mend', ('#538c63', '#a6db9b', '#355d4e'))]:
    ITEMS[spell + '-tome'] = art('hhhhhhh/hbbbbbs/hbbabbs/hbaaabs/hbbabbs/hbbbbbs/aaaaaas/sssssss', palette, extra='#e6cfa0')
    ITEMS[spell + '-scroll'] = art('hhhhhhs/habbbas/.aaaaa./.aabaa./.abbba./.aabaa./habbbas/sssssss', CLOTH, extra=palette[0], outline=WARM)

for name, image in ITEMS.items():
    image.save(ROOT / (name + '.png'), optimize=True)
(ROOT / 'manifest.js').write_text(
    '// Generated by scripts/generate-item-icons.py; do not edit manually.\n'
    + 'export const ITEM_ICON_IDS = new Set(' + repr(list(ITEMS)).replace("'", '"') + ');\n',
    encoding='utf-8'
)

# Review at actual inventory size and enlarged nearest-neighbor scale.
sheet = Image.new('RGB', (8*130, ((len(ITEMS)+7)//8)*105), '#132530')
d = ImageDraw.Draw(sheet)
for i, (name, icon) in enumerate(ITEMS.items()):
    x, y = (i%8)*130, (i//8)*105
    d.rectangle((x+3,y+3,x+126,y+101), fill='#1c3039', outline='#4a6470')
    sheet.paste(icon.resize((60,60),Image.Resampling.NEAREST), (x+8,y+8), icon.resize((60,60),Image.Resampling.NEAREST))
    sheet.paste(icon, (x+88,y+27), icon)
    d.text((x+7,y+76), name[:20], fill='#d6e2d0')
sheet.save(Path(gettempdir()) / 'aquaria-item-sprites-preview.png')
print('Generated', len(ITEMS), 'chunky 24px sprites in', ROOT)
