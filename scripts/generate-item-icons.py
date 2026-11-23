"""Generate consistent 24x24 transparent pixel art for Aquaria inventory items.

Run: python scripts/generate-item-icons.py
All sprites have a one-pixel dark outline and intentionally readable silhouettes.
"""
from pathlib import Path
from PIL import Image, ImageDraw
from tempfile import gettempdir

ROOT = Path(__file__).resolve().parents[1] / 'src' / 'art' / 'items'
ROOT.mkdir(parents=True, exist_ok=True)
S = 24
INK='#17252f'
DEEP='#25343a'
EDGE='#31464d'
WOOD='#956443'
WOOD_DARK='#573c39'
WOOD_HI='#c99b66'
CLOTH='#c4b592'
CLOTH_HI='#f0d6a4'
CLOTH_DARK='#847661'
GOLD='#c6a05c'
GOLD_HI='#ffde91'
GREEN='#5f9b70'
GREEN_HI='#a6d6a1'
COPPER=('#cf825e','#ffd0a1','#81453d')
IRON=('#9baeb3','#dce5dc','#586e7a')
COBALT=('#788be4','#c6d4ff','#414a88')

class Sprite:
    def __init__(self):
        self.im=Image.new('RGBA',(S,S),(0,0,0,0))
        self.d=ImageDraw.Draw(self.im)
    def rect(self,a,b,c,d,color):
        self.d.rectangle((a,b,c,d),fill=color)
    def line(self,points,color,width=1):
        self.d.line(points,fill=color,width=width,joint='curve')
    def poly(self,points,color,outline=INK):
        self.d.polygon(points,fill=color)
        if outline: self.d.line(points+[points[0]],fill=outline,width=1)
    def oval(self,a,b,c,d,color,outline=None,width=1):
        self.d.ellipse((a,b,c,d),fill=color,outline=outline,width=width)
    def save(self,name):
        self.im.save(ROOT/(name+'.png'),optimize=True)

def rock(kind):
    p=Sprite()
    if kind=='stone':
        p.poly([(3,8),(8,4),(17,5),(22,12),(19,20),(9,22),(2,17)],'#506d77')
        p.poly([(3,9),(9,6),(13,10),(9,18),(3,16)],'#64848a',None)
        p.poly([(11,6),(17,6),(21,13),(16,18),(10,16)],'#3b5864',None)
        p.line([(5,10),(9,8),(12,9)],'#aac0b3',2)
        p.line([(14,18),(17,15),(20,15)],'#2b4652',1)
    elif kind=='sand':
        p.poly([(1,18),(3,14),(8,12),(12,8),(17,12),(21,14),(23,19),(19,21),(4,21)],'#cda66e')
        p.poly([(4,17),(10,13),(15,13),(20,18),(18,19),(5,19)],'#e8c48a',None)
        for x,y in [(6,16),(12,15),(16,18),(9,19),(18,16)]:
            p.rect(x,y,x+1,y+1,'#96754e')
        p.line([(5,20),(16,20)],'#ffe0a1')
    elif kind=='wood':
        for ox,oy in [(3,13),(5,6)]:
            p.poly([(ox,oy+2),(ox+4,oy),(ox+14,oy+2),(ox+15,oy+7),(ox+12,oy+9),(ox,oy+7)],'#805339')
            p.poly([(ox+4,oy+1),(ox+14,oy+3),(ox+13,oy+5),(ox+3,oy+3)],'#b28053',None)
            p.oval(ox,oy+2,ox+5,oy+7,'#dbb17a',INK)
            p.oval(ox+2,oy+4,ox+4,oy+6,'#92694b')
            p.line([(ox+7,oy+3),(ox+12,oy+5)],'#d6a16b')
    elif kind in ('copper','iron','cobalt'):
        main,hi,dark={'copper':COPPER,'iron':IRON,'cobalt':COBALT}[kind]
        p.poly([(2,10),(8,5),(17,6),(22,13),(18,20),(8,22),(2,17)],'#3e515d')
        p.poly([(3,10),(9,6),(12,11),(8,19),(3,17)],'#5f7074',None)
        p.poly([(11,8),(16,4),(20,9),(17,14),(11,15),(8,12)],main)
        p.poly([(12,8),(16,5),(16,11),(12,13)],hi,None)
        p.poly([(17,6),(20,9),(17,13),(16,11)],dark,None)
        p.poly([(6,14),(10,12),(13,15),(9,19),(5,18)],dark)
        p.line([(7,14),(9,13),(11,15)],hi)
        p.rect(15,16,17,18,main)
        p.rect(16,16,16,16,hi)
    return p

def sword(kind):
    p=Sprite()
    if kind=='iron-sword':
        p.poly([(13,12),(18,3),(21,1),(21,6),(15,16),(11,15)],IRON[0])
        p.poly([(15,12),(19,4),(20,3),(19,7),(15,14)],IRON[1],None)
        p.line([(12,15),(17,10)],IRON[2])
        p.poly([(8,13),(10,12),(15,17),(13,19)],GOLD)
        p.line([(9,13),(12,16)],GOLD_HI)
    else:
        p.poly([(12,13),(17,5),(20,3),(22,3),(21,7),(17,11),(15,16),(11,16)],'#a1bbb8')
        p.poly([(13,12),(18,5),(21,4),(19,9),(15,14)],'#e3ead5',None)
        p.poly([(8,12),(10,11),(13,17),(10,19),(8,17)],GOLD)
        p.oval(7,14,12,20,None,GOLD,width=2)
        p.rect(9,13,10,15,GOLD_HI)
    p.line([(9,16),(4,21)],WOOD_DARK,4)
    p.line([(9,16),(5,20)],WOOD_HI,2)
    p.oval(2,20,5,23,GOLD,INK)
    return p

def spear(kind):
    p=Sprite()
    p.line([(5,21),(17,6)],INK,5)
    p.line([(5,21),(17,6)],WOOD,3)
    p.line([(7,19),(16,7)],WOOD_HI,1)
    tip={'spear':('#8b9b9c','#dee2d0','#536a74'),
         'copper-spear':COPPER,'cobalt-spear':COBALT}[kind]
    p.poly([(16,11),(15,7),(18,1),(21,0),(22,4),(20,10)],tip[0])
    p.poly([(18,3),(21,1),(20,7),(17,8)],tip[1],None)
    p.line([(19,8),(20,5)],tip[2])
    p.poly([(11,11),(14,10),(16,12),(14,15)],GOLD if kind!='spear' else '#8a8c7b')
    p.rect(11,14,12,15,WOOD_DARK)
    return p

def breastplate(metal):
    p=Sprite()
    main,hi,dark=metal
    p.poly([(5,3),(9,4),(12,7),(15,4),(19,3),(23,8),(20,13),(19,21),(5,21),(4,13),(1,8)],main)
    p.poly([(5,4),(9,5),(12,9),(15,5),(19,4),(21,8),(18,11),(15,9),(12,12),(9,9),(6,11),(3,8)],hi,None)
    p.poly([(7,12),(12,14),(17,12),(18,20),(6,20)],dark,None)
    p.poly([(9,12),(12,14),(15,12),(14,19),(10,19)],main,None)
    p.line([(8,15),(8,20)],hi)
    p.line([(16,15),(16,20)],INK)
    p.poly([(10,8),(12,10),(14,8),(14,11),(12,13),(10,11)],GOLD,INK)
    p.rect(11,10,12,11,GOLD_HI)
    p.rect(4,9,5,12,dark)
    p.rect(19,9,20,12,dark)
    return p

def snorkel(metal):
    p=Sprite()
    main,hi,dark=metal
    p.line([(19,16),(20,7),(20,3)],INK,6)
    p.line([(19,16),(20,7),(20,3)],main,3)
    p.rect(19,2,22,4,hi)
    p.rect(18,5,20,6,dark)
    p.poly([(2,11),(5,8),(15,8),(18,11),(17,17),(13,20),(5,19),(2,16)],INK,INK)
    p.poly([(4,11),(6,10),(15,10),(16,12),(15,17),(6,17),(4,15)],main,None)
    p.poly([(5,11),(14,11),(15,13),(13,16),(6,16),(5,14)],'#80c5c9',None)
    p.rect(6,11,10,12,'#c3eee5')
    p.rect(12,13,14,14,'#4e8da6')
    p.rect(6,17,13,18,dark)
    p.rect(18,16,19,18,GOLD)
    return p

def glove_pair():
    p=Sprite()
    for offset, y in [(0,4),(8,2)]:
        x=2+offset
        p.poly([(x+2,y+6),(x+4,y+1),(x+6,y+2),(x+6,y+5),
                (x+8,y+1),(x+10,y+3),(x+9,y+9),
                (x+7,y+13),(x+4,y+15),(x+1,y+13),(x,y+9)],'#92785d')
        p.poly([(x+2,y+8),(x+4,y+5),(x+5,y+9),(x+7,y+10),(x+5,y+13),(x+2,y+12)],'#c0a37e',None)
        p.line([(x+2,y+11),(x+6,y+13)],'#624d45')
        p.rect(x+2,y+13,x+7,y+15,'#5f5349')
        p.rect(x+3,y+13,x+5,y+13,'#e4ca97')
    return p

def sprite(name):
    if name in ('sand','stone','wood','copper','iron','cobalt'):
        return rock(name)
    if name in ('iron-sword','captains-cutlass'):
        return sword(name)
    if name in ('spear','copper-spear','cobalt-spear'):
        return spear(name)
    if name in ('copper-breastplate','iron-breastplate','cobalt-breastplate'):
        return breastplate({'copper-breastplate':COPPER,'iron-breastplate':IRON,'cobalt-breastplate':COBALT}[name])
    if name in ('copper-snorkel','iron-snorkel','cobalt-snorkel'):
        return snorkel({'copper-snorkel':COPPER,'iron-snorkel':IRON,'cobalt-snorkel':COBALT}[name])
    p=Sprite()
    if name=='root-ring':
        p.oval(4,5,20,22,'#5f432e',INK,2)
        p.oval(8,9,16,18,(0,0,0,0),INK,1)
        p.line([(7,9),(6,14),(8,19),(12,21)],'#b28051',2)
        p.line([(17,9),(20,14),(18,17)],'#94714d',2)
        p.line([(13,7),(15,4),(18,3)],'#5e885a',2)
        p.poly([(16,3),(19,0),(22,2),(19,5)],GREEN_HI,INK)
        p.rect(7,17,8,19,'#9ac26e')
    elif name=='grappling-hook':
        p.oval(7,17,17,22,None,WOOD_HI,3)
        p.oval(9,18,15,20,None,WOOD_DARK,1)
        p.line([(12,18),(12,5)],IRON[2],3)
        p.line([(12,15),(12,5)],IRON[1])
        p.poly([(12,7),(6,4),(3,7),(4,12),(7,13),(8,10),(6,8),(10,9)],IRON[0])
        p.poly([(13,7),(19,4),(22,7),(20,12),(17,13),(16,10),(19,8),(15,9)],IRON[0])
        p.line([(5,7),(5,10),(7,11)],IRON[1])
        p.line([(19,7),(19,10),(17,11)],IRON[1])
        p.rect(10,3,14,6,GOLD)
    elif name=='explorers-map':
        p.poly([(3,4),(9,2),(15,4),(21,2),(21,18),(15,21),(9,19),(3,21)],'#c5a46e')
        p.poly([(5,6),(9,4),(15,6),(19,4),(19,17),(15,19),(9,17),(5,19)],'#e4c893',None)
        p.line([(9,4),(9,18)],'#aa865a')
        p.line([(15,6),(15,19)],'#aa865a')
        p.line([(6,14),(10,12),(12,15),(15,9),(18,10)],'#866e5b',1)
        p.line([(13,7),(16,10)],'#b64e4e',2)
        p.line([(16,7),(13,10)],'#b64e4e',2)
        p.oval(5,6,8,9,None,EDGE,1)
        p.rect(6,5,6,10,'#665543')
    elif name=='kelp-dressing':
        p.poly([(3,7),(6,4),(18,6),(21,9),(20,17),(17,20),(5,17),(2,14)],CLOTH)
        p.poly([(5,8),(7,6),(18,8),(19,15),(16,18),(5,16)],'#8bba8f',None)
        p.line([(8,6),(6,17)],CLOTH_HI,3)
        p.line([(16,7),(15,18)],CLOTH_HI,3)
        p.line([(11,9),(13,14)],'#2f6957',2)
        p.line([(13,10),(10,13)],'#3d8069',2)
    elif name=='bow':
        p.line([(10,2),(16,4),(19,9),(19,14),(16,20),(10,22)],INK,4)
        p.line([(10,3),(15,5),(17,9),(17,15),(14,20),(10,21)],WOOD_HI,2)
        p.line([(10,2),(10,22)],'#e6d9b5',1)
        p.line([(6,13),(20,8)],'#d6e2d0',2)
        p.poly([(19,6),(22,7),(20,10)],IRON[1])
        p.poly([(5,12),(3,9),(5,10),(7,12),(4,16)],GREEN)
        p.rect(16,11,18,14,WOOD_DARK)
    elif name=='arrow':
        for sx,sy in [(0,1),(4,-2)]:
            p.line([(4+sx,21+sy),(15+sx,6+sy)],WOOD_DARK,3)
            p.line([(5+sx,20+sy),(16+sx,5+sy)],WOOD_HI,1)
            p.poly([(13+sx,7+sy),(16+sx,0+sy),(20+sx,3+sy),(19+sx,8+sy)],IRON[0])
            p.line([(16+sx,2+sy),(17+sx,6+sy)],IRON[1])
            p.poly([(4+sx,18+sy),(1+sx,16+sy),(3+sx,22+sy),(7+sx,22+sy),(7+sx,18+sy)],GREEN)
    elif name=='kelp':
        p.line([(11,22),(11,9)],'#275749',3)
        p.line([(11,11),(5,5)],'#3e865c',2)
        p.line([(11,15),(18,5)],'#3e865c',2)
        p.poly([(11,15),(4,13),(2,9),(5,7),(9,12)],'#69b378')
        p.poly([(12,12),(15,3),(20,1),(21,6),(17,10)],'#7fca83')
        p.poly([(9,21),(3,20),(2,15),(7,15),(11,19)],'#4e9871')
        p.poly([(12,19),(18,13),(21,14),(21,18),(15,21)],'#4f9d72')
        p.line([(14,11),(17,6)],GREEN_HI)
    elif name=='door':
        p.poly([(4,22),(4,6),(7,3),(16,3),(20,7),(20,22)],WOOD)
        p.poly([(6,20),(6,7),(8,5),(16,5),(18,7),(18,20)],'#b48257',None)
        p.line([(12,5),(12,21)],WOOD_DARK,2)
        p.line([(7,8),(10,8)],'#e3b77a')
        p.line([(14,14),(17,14)],'#724c3e')
        p.rect(5,8,7,10,IRON[2])
        p.rect(5,17,7,19,IRON[2])
        p.rect(15,12,17,14,GOLD_HI)
        p.rect(15,13,15,13,WOOD_DARK)
    elif name=='workbench':
        p.poly([(2,8),(19,8),(22,10),(20,13),(3,13)],WOOD)
        p.rect(3,9,20,10,'#d1a36b')
        p.rect(5,13,8,21,WOOD_DARK)
        p.rect(17,13,20,21,WOOD_DARK)
        p.rect(8,15,17,17,'#70513c')
        p.rect(9,14,15,15,'#ac774b')
        p.line([(10,8),(14,4)],IRON[2],3)
        p.poly([(13,3),(17,2),(19,4),(17,6),(14,5)],IRON[0])
        p.rect(14,3,17,3,IRON[1])
    elif name=='diving-fin':
        p.poly([(3,9),(6,6),(12,8),(20,3),(22,5),(22,16),(14,19),(7,16),(3,15)],'#2f78ae')
        p.poly([(6,9),(12,10),(20,5),(20,14),(14,17),(8,14)],'#4d9bda',None)
        p.line([(12,12),(20,8)],'#89c8eb')
        p.line([(14,15),(21,13)],'#275886')
        p.rect(4,10,6,14,INK)
        p.rect(7,11,9,13,'#d0a875')
        p.rect(10,11,12,13,'#275886')
    elif name=='scrappers-gloves':
        p=glove_pair()
    elif name=='explorers-anklet':
        p.oval(2,7,21,19,'#526f75',INK,2)
        p.oval(5,9,18,16,(0,0,0,0),INK,1)
        p.line([(4,12),(6,9),(11,7),(17,9)],'#aec8b9',2)
        p.poly([(15,13),(19,13),(21,17),(18,21),(15,18)],GOLD)
        p.rect(17,15,19,18,'#89d2d5')
        p.rect(18,15,18,15,'#d1f3e3')
    elif name=='padded-leg-wraps':
        for x,y in [(4,3),(13,1)]:
            p.poly([(x,y+1),(x+6,y),(x+7,y+5),(x+7,y+17),(x+5,y+21),(x,y+20)],CLOTH_DARK)
            p.poly([(x+1,y+3),(x+5,y+2),(x+6,y+16),(x+4,y+18),(x+1,y+17)],CLOTH,None)
            for j in [5,9,13]:
                p.line([(x+1,y+j),(x+6,y+j-2)],CLOTH_HI,2)
            p.rect(x+2,y+18,x+6,y+19,WOOD_DARK)
    elif name=='prospectors-brooch':
        p.poly([(12,1),(19,4),(22,11),(20,18),(12,23),(4,18),(2,11),(5,4)],GOLD)
        p.poly([(12,4),(18,6),(20,11),(17,17),(12,20),(7,17),(4,11),(7,6)],'#805b48',None)
        p.poly([(12,5),(16,8),(16,15),(12,19),(8,15),(8,8)],'#65aea1')
        p.poly([(12,6),(15,8),(12,13),(9,12)],'#b8eee2',None)
        p.poly([(16,8),(16,15),(12,19),(12,13)],'#326e7e',None)
        p.rect(11,1,13,3,GOLD_HI)
    elif name=='rusty-metal-scraps':
        p.poly([(3,16),(5,5),(10,3),(14,8),(12,18),(7,21)],'#90513e')
        p.poly([(12,6),(19,4),(22,10),(18,20),(11,17)],'#ad6248')
        p.poly([(5,7),(9,5),(12,9),(11,15),(6,16)],'#cb8160',None)
        p.line([(5,15),(9,16),(12,12)],'#653c36')
        p.rect(8,7,9,8,IRON[1])
        p.rect(17,9,18,10,IRON[2])
        p.line([(13,16),(17,19)],'#563e3a',2)
    elif name=='torn-cloth':
        p.poly([(4,3),(10,5),(15,3),(21,6),(20,11),(22,16),(18,21),(14,18),(10,22),(6,18),(2,17),(4,12)],'#bcae91')
        p.poly([(6,5),(10,7),(16,6),(19,8),(18,18),(13,16),(10,20),(6,16)],'#e3d3ae',None)
        p.line([(7,6),(7,16),(10,18)],'#8b7a61')
        p.line([(15,8),(12,11),(15,13)],'#a68f72')
        p.rect(18,5,19,7,CLOTH_HI)
    elif name=='broken-gears':
        # Tooth shapes on main gear to make it recognizable at 24px.
        for a,b,c,d in [(8,1,11,5),(12,18,16,22),(2,9,6,13),(17,8,22,12),
                        (4,4,7,7),(16,4,19,7),(4,16,7,19),(17,15,20,18)]:
            p.rect(a,b,c,d,'#61757a')
        p.oval(4,3,19,19,'#8ea1a1',INK,1)
        p.oval(7,6,16,16,'#5e7780',None)
        p.oval(9,8,14,13,(0,0,0,0),INK,2)
        p.line([(7,7),(9,5)],IRON[1],2)
        p.line([(15,16),(17,14)],IRON[2],2)
        p.poly([(17,17),(21,15),(23,18),(21,22),(17,21)],'#6d7778')
        p.rect(19,19,20,20,INK)
    elif name=='ancient-coins':
        for x,y in [(3,10),(6,7),(8,3)]:
            p.oval(x,y,x+12,y+12,'#a77a3d',INK)
            p.oval(x+2,y+1,x+10,y+9,GOLD,outline='#e6c178')
            p.line([(x+5,y+3),(x+5,y+8)],GOLD_HI)
            p.line([(x+4,y+4),(x+8,y+4)],GOLD_HI)
        p.rect(7,18,12,19,'#ffe4a1')
    elif name=='glowshroom-torch':
        p.line([(11,14),(11,22)],WOOD_DARK,5)
        p.line([(11,15),(11,22)],WOOD_HI,2)
        p.rect(8,19,14,20,'#4c6556')
        p.poly([(2,13),(5,7),(9,4),(16,4),(20,8),(22,13),(18,15),(6,15)],'#65c6a3')
        p.poly([(5,12),(9,6),(16,6),(19,11),(15,13),(9,13)],'#b5ffe2',None)
        for a,b in [(9,9),(15,8),(17,11)]:
            p.rect(a,b,a+1,b+1,'#ecffe2')
        p.rect(10,14,13,17,'#d5d9a5')
        p.rect(11,16,12,16,'#738d73')
    elif name=='fireplace':
        p.poly([(2,19),(5,15),(19,15),(22,19),(19,22),(5,22)],'#414f55')
        p.poly([(4,18),(7,16),(17,16),(20,18),(17,20),(7,20)],'#627379',None)
        p.line([(5,17),(19,13)],WOOD_DARK,3)
        p.line([(5,13),(19,17)],WOOD,3)
        p.poly([(6,14),(8,8),(12,2),(16,8),(18,14),(12,16)],'#d95c48')
        p.poly([(8,14),(10,8),(12,5),(15,9),(15,14)],'#f09c46',None)
        p.poly([(10,14),(11,10),(12,8),(14,11),(13,14)],'#ffe17d',None)
    elif name=='raw-fish':
        p.poly([(16,12),(22,6),(21,12),(22,18)],'#588ba8')
        p.poly([(2,12),(6,7),(13,6),(18,10),(18,14),(13,18),(6,17)],'#6fa7c4')
        p.poly([(4,11),(9,8),(15,8),(16,12),(8,12)],'#a7dbec',None)
        p.poly([(8,6),(12,2),(15,6)],'#588ba8')
        p.rect(5,10,7,12,INK)
        p.rect(5,10,6,11,'#e6f5f5')
        p.line([(12,9),(12,15)],'#426d88')
    elif name=='cooked-fish':
        p.poly([(16,12),(22,6),(21,12),(22,18)],'#965632')
        p.poly([(2,12),(6,7),(13,6),(18,10),(18,14),(13,18),(6,17)],'#c97e42')
        p.poly([(4,11),(9,8),(15,8),(16,12),(8,12)],'#f0b56d',None)
        p.poly([(8,6),(12,2),(15,6)],'#965632')
        p.rect(5,10,7,12,'#5e3422')
        p.line([(9,8),(11,16)],'#6e3a20')
        p.line([(13,8),(15,16)],'#6e3a20')
    elif name=='raw-crab':
        for lx,rx,ly in [(3,18,13),(2,19,16),(4,17,19)]:
            p.line([(6,ly),(lx,ly+2)],'#b84e3d',2)
            p.line([(17,ly),(rx,ly+2)],'#b84e3d',2)
        p.poly([(4,10),(2,5),(5,2),(8,5),(7,9)],'#d96c52')
        p.poly([(19,10),(21,5),(18,2),(15,5),(16,9)],'#d96c52')
        p.oval(5,8,19,19,'#d4694f',INK,1)
        p.oval(7,10,16,15,'#f39e7a',None)
        p.rect(8,9,9,10,INK)
        p.rect(14,9,15,10,INK)
    elif name=='cooked-crab':
        for lx,rx,ly in [(3,18,13),(2,19,16),(4,17,19)]:
            p.line([(6,ly),(lx,ly+2)],'#a63426',2)
            p.line([(17,ly),(rx,ly+2)],'#a63426',2)
        p.poly([(4,10),(2,5),(5,2),(8,5),(7,9)],'#de4c33')
        p.poly([(19,10),(21,5),(18,2),(15,5),(16,9)],'#de4c33')
        p.oval(5,8,19,19,'#d9462f',INK,1)
        p.oval(7,10,16,15,'#ff9452',None)
        p.rect(9,11,14,12,'#ffd285')
    elif name=='rope-bundle':
        p.oval(2,3,21,21,'#8b633f',INK,1)
        p.oval(4,5,19,19,None,'#d4aa72',3)
        p.oval(7,8,16,16,None,'#77553b',3)
        p.oval(9,10,14,14,(0,0,0,0),INK,1)
        p.line([(19,13),(22,16),(21,21)],'#ad8457',3)
        p.line([(3,10),(6,8)],'#e2c18b',1)
        p.line([(9,5),(13,5)],'#e2c18b',1)
    else:
        raise ValueError('Missing icon for '+name)
    return p

ITEMS = [
 'root-ring','grappling-hook','explorers-map','kelp-dressing',
 'captains-cutlass','iron-sword','cobalt-spear','spear','copper-spear','bow','arrow',
 'door','workbench','fireplace','raw-fish','cooked-fish','raw-crab','cooked-crab','copper-snorkel','iron-snorkel','cobalt-snorkel',
 'diving-fin','scrappers-gloves','explorers-anklet','padded-leg-wraps','prospectors-brooch',
 'rusty-metal-scraps','torn-cloth','broken-gears','ancient-coins','glowshroom-torch','rope-bundle',
 'kelp','copper','iron','cobalt','copper-breastplate','iron-breastplate','cobalt-breastplate'
]
for name in ITEMS:
    s=sprite(name)
    if not s.im.getbbox():
        raise ValueError('Empty sprite '+name)
    s.save(name)
(ROOT / 'manifest.js').write_text(
    '// Generated by scripts/generate-item-icons.py; do not edit manually.\n'
    + 'export const ITEM_ICON_IDS = new Set(' + repr(ITEMS).replace("'", '"') + ');\n',
    encoding='utf-8'
)
print('Generated',len(ITEMS),'transparent 24x24 item sprites in',ROOT)

# Contact sheet for visual review (not loaded by the game).
sheet=Image.new('RGB',(8*134,5*136),'#132530')
d=ImageDraw.Draw(sheet)
for i,name in enumerate(ITEMS):
    x=(i%8)*134; y=(i//8)*136
    d.rounded_rectangle((x+4,y+4,x+129,y+130),radius=7,fill='#1c3642',outline='#4a6470')
    image=Image.open(ROOT/(name+'.png')).resize((72,72),Image.Resampling.NEAREST)
    sheet.paste(image,(x+30,y+10),image)
    words=name.replace('-',' ')
    if len(words)>18:
        words=words[:17]+'…'
    d.text((x+8,y+92),words,fill='#d6e2d0')
sheet.save(Path(gettempdir())/'aquaria-item-sprites-preview.png')

