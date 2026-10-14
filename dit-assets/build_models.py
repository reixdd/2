"""Dead Internet Theory - four original, procedural real 3D GLB assets.
Runs with Python 3, numpy and trimesh. +Y is up; the robots face +Z.
Meshes are grouped by PBR material and head/torso/podium for low draw calls.
These are original stylized reconstructions, not scanned versions of 2D concept art.
"""
import math
from collections import defaultdict
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual import TextureVisuals
from trimesh.transformations import rotation_matrix, translation_matrix

OUT=Path(__file__).resolve().parent
PI=math.pi

PALETTE={
 'black':dict(color=[8,11,17,255],metal=.87,rough=.23),
 'black_glass':dict(color=[9,9,15,255],metal=.98,rough=.105),
 'chrome':dict(color=[52,54,65,255],metal=1.,rough=.115),
 'polished_silver':dict(color=[157,166,178,255],metal=.98,rough=.17),
 'brushed_silver':dict(color=[137,146,155,255],metal=.93,rough=.3),
 'bright_steel':dict(color=[207,216,225,255],metal=.9,rough=.18),
 'gunmetal':dict(color=[43,50,60,255],metal=.94,rough=.27),
 'dark_steel':dict(color=[21,27,33,255],metal=.9,rough=.34),
 'fabric':dict(color=[21,24,30,255],metal=.12,rough=.95),
 'fabric_fold':dict(color=[34,39,46,255],metal=.1,rough=.93),
 'rubber':dict(color=[9,13,17,255],metal=.05,rough=.8),
 'blue':dict(color=[12,112,237,255],metal=.4,rough=.2,emissive=[0.07,.34,1]),
 'violet':dict(color=[145,43,241,255],metal=.45,rough=.16,emissive=[.49,.05,1]),
 'green':dict(color=[19,210,98,255],metal=.4,rough=.2,emissive=[.03,.95,.23]),
 'white':dict(color=[215,237,255,255],metal=.2,rough=.17,emissive=[.35,.42,.55]),
 'charcoal':dict(color=[16,18,22,255],metal=.75,rough=.5)
}
MATS={name:PBRMaterial(name=name,baseColorFactor=data['color'],metallicFactor=data['metal'],roughnessFactor=data['rough'],emissiveFactor=data.get('emissive')) for name,data in PALETTE.items()}

# Custom primitives oriented in +Y up (GLTF/Three.js standard).
def ell(center,rad,sub=2):
 m=trimesh.creation.icosphere(subdivisions=sub)
 m.vertices=np.array(m.vertices)*np.array(rad)+np.array(center)
 return m

def box(center,scale):
 m=trimesh.creation.box(extents=scale)
 m.apply_translation(center)
 return m

def cyl(a,b,r,sections=14):
 a,b=np.array(a,dtype=float),np.array(b,dtype=float)
 vec=b-a; length=np.linalg.norm(vec)
 if length<1e-5: return ell(a,[r,r,r],sub=1)
 m=trimesh.creation.cylinder(radius=r,height=length,sections=sections)
 m.apply_transform(trimesh.geometry.align_vectors([0,0,1],vec/length))
 m.apply_translation((a+b)/2)
 return m

def cone_axis(a,b,r,sections=24):
 a,b=np.array(a,dtype=float),np.array(b,dtype=float); v=b-a
 m=trimesh.creation.cone(radius=r,height=np.linalg.norm(v),sections=sections)
 m.apply_transform(trimesh.geometry.align_vectors([0,0,1],v/np.linalg.norm(v)))
 m.apply_translation(a);return m

def torus_y(r,thin,y,z=0,x=0,sections=72):
 m=trimesh.creation.torus(major_radius=r,minor_radius=thin,major_sections=sections,minor_sections=8)
 m.apply_transform(rotation_matrix(PI/2,[1,0,0]));m.apply_translation([x,y,z]);return m

def torus_front(r,thin,x,y,z,sections=48):
 m=trimesh.creation.torus(major_radius=r,minor_radius=thin,major_sections=sections,minor_sections=8)
 m.apply_translation([x,y,z]);return m

def wire(points,r=.013,sections=8):
 verts=[];faces=[]
 # tube sweep, ring perpendicular to polyline tangent
 pts=np.array(points,dtype=float)
 for i,p in enumerate(pts):
  t=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)])
  norm=np.linalg.norm(t);t=t/norm if norm>0 else np.array([0,1,0.])
  guide=np.array([0,1,0.]) if abs(t[1])<.88 else np.array([1.,0,0])
  u=np.cross(t,guide); u/=np.linalg.norm(u)
  v=np.cross(t,u)
  for j in range(sections):
   a=2*PI*j/sections;verts.append(p+r*(math.cos(a)*u+math.sin(a)*v))
 for k in range(len(pts)-1):
  for j in range(sections):
   p=k*sections+j;q=k*sections+(j+1)%sections
   s=(k+1)*sections+j;t=(k+1)*sections+(j+1)%sections
   faces.extend([(p,q,s),(q,t,s)])
 
 for j in range(1,sections-1):
  faces.append((0,j+1,j))
  s=(len(pts)-1)*sections
  faces.append((s,s+j,s+j+1))
 return trimesh.Trimesh(vertices=np.array(verts),faces=np.array(faces),process=False)

def plate(points,th=.015):
 pts=np.array(points,dtype=float)
 # double-sided extrusion via convex hull: acceptable for metallic armor plates
 front=pts+np.array([0,0,th/2]);back=pts-np.array([0,0,th/2])
 return trimesh.convex.convex_hull(np.vstack([front,back]))

def lathe(profile,N=84):
 """Solid of revolution around the world Y axis. profile list (y,r)."""
 verts=[];faces=[]
 for y,r in profile:
  for k in range(N):
   a=2*PI*k/N;verts.append([r*math.cos(a),y,r*math.sin(a)])
 for j in range(len(profile)-1):
  for k in range(N):
   a=j*N+k;b=j*N+(k+1)%N;c=(j+1)*N+k;d=(j+1)*N+(k+1)%N
   faces.extend([(a,c,b),(b,c,d)])
 for k in range(1,N-1):
  faces.append((0,k+1,k))
  s=(len(profile)-1)*N
  faces.append((s,s+k,s+k+1))
 return trimesh.Trimesh(vertices=np.array(verts),faces=faces,process=False)

def noisy_shell(profile,opening=False,N=72):
 # Hood with 3D folds. Partial mesh leaves the front open for the face and glowing eyes.
 verts=[];faces=[]
 for row,(y,rx,rz) in enumerate(profile):
  for k in range(N):
   a=2*PI*k/N
   wrinkle=1+0.029*math.sin(12*a+2*y)+0.022*math.sin(23*a-4*y)
   verts.append([rx*math.sin(a)*wrinkle,y,rz*math.cos(a)*wrinkle-.03])
 for j in range(len(profile)-1):
  ymid=(profile[j][0]+profile[j+1][0])/2
  for k in range(N):
   a=2*PI*(k+.5)/N; theta=((a+PI)%(2*PI))-PI
   if opening and 1.75<ymid<2.92 and abs(theta)<.86:continue
   b=j*N+k;c=j*N+(k+1)%N;d=(j+1)*N+k;e=(j+1)*N+(k+1)%N
   faces.extend([(b,c,d),(c,e,d)])
 return trimesh.Trimesh(vertices=np.array(verts),faces=np.array(faces),process=False)

class Builder:
 def __init__(self,name):
  self.name=name;self.pool=defaultdict(list)
 def add(self,mesh,material='black',group='TORSO'):
  if mesh is not None and len(mesh.vertices):self.pool[(group,material)].append(mesh)
 def build(self,groups=('TORSO','HEAD','PODIUM'),shift=0.):
  scene=trimesh.Scene(); scene.metadata={'title':self.name,'asset_type':'procedural 3D mesh','front_axis':'+Z','up_axis':'+Y','head_pivot_height':round(2.18+shift,3),'note':'Procedural approximation of Dead Internet Theory character reference'}
  scene.graph.update(frame_to='HEAD_PIVOT',frame_from=scene.graph.base_frame,matrix=translation_matrix([0,2.18+shift,0]))
  for (group,material),meshes in self.pool.items():
   if group not in groups:continue
   combined=trimesh.util.concatenate(meshes)
   combined.visual=TextureVisuals(material=MATS[material])
   if group!='PODIUM':
    combined.apply_translation([0,shift,0])
   if group=='HEAD':
    combined.apply_translation([0,-2.18-shift,0]);parent='HEAD_PIVOT';matrix=np.eye(4)
   else:parent=scene.graph.base_frame;matrix=np.eye(4)
   scene.add_geometry(combined,geom_name=f'{group}_{material}',node_name=f'{group}_{material}',parent_node_name=parent,transform=matrix)
  return scene

def torso(b,type='null'):
 base='black' if type=='null' else ('gunmetal' if type=='echo' else 'dark_steel')
 b.add(ell([0,1.23,-.02],[.81,.36,.38],3),base)
 b.add(ell([0,1.54,-.09],[.30,.40,.27],2),'dark_steel')
 for side in (-1,1):
  x=side
  b.add(ell([.64*x,1.38,-.01],[.38,.27,.40],2),base)
  b.add(plate([[.20*x,1.68,.38],[.75*x,1.56,.26],[.92*x,1.23,.20],[.32*x,1.10,.48]],.038),'chrome' if type=='null' else 'brushed_silver')
  b.add(wire([[.23*x,1.71,.39],[.52*x,1.50,.42],[.84*x,1.28,.26]],.016),'gunmetal')
  for k in range(4):
   dx=(.4+.15*k)*x
   b.add(cyl([dx,1.27,-.1],[dx+.05*x,1.47,-.19],.015),'black')
  for i in range(3):
   b.add(cyl([.28*x,1.40,.39],[.16*x,1.65-i*.11,.34],.013),'bright_steel')
 # breastplate with center split and layered edges
 b.add(plate([[-.5,1.42,.47],[-.06,1.65,.55],[-.05,1.19,.56],[-.30,1.11,.51]],.033),'brushed_silver' if type=='echo' else 'chrome')
 b.add(plate([[.5,1.42,.47],[.06,1.65,.55],[.05,1.19,.56],[.30,1.11,.51]],.033),'brushed_silver' if type=='echo' else 'chrome')
 b.add(wire([[-.02,1.73,.55],[0,1.43,.6],[.02,1.17,.55]],.008),'black')
 # ribbed neck collar
 for k in range(5):
  y=1.60+k*.079
  b.add(torus_y(.205+.035*math.sin(k*.85),.024,y,0,0,36),'brushed_silver' if type=='echo' else 'gunmetal')
 for side in [-1,1]:
  b.add(wire([[.12*side,1.63,.19],[.14*side,1.94,.15],[.12*side,2.15,.18]],.027),'black_glass')

def mask_surface(b):
 rows=[(1.91,.12,.19),(2.04,.21,.28),(2.17,.31,.32),(2.34,.34,.29),(2.48,.30,.27),(2.59,.21,.23)]
 verts=[];faces=[];N=19
 for y,rx,rz in rows:
  for i in range(N):
   a=-1.23+2.46*i/(N-1)
   verts.append([rx*math.sin(a),y,.30+rz*math.cos(a)])
 for j in range(len(rows)-1):
  for i in range(N-1):
   a=j*N+i;bb=a+1;c=(j+1)*N+i;d=c+1
   faces +=[(a,bb,c),(bb,d,c)]
 b.add(trimesh.Trimesh(vertices=np.array(verts),faces=np.array(faces),process=False),'brushed_silver','HEAD')
 # angular armor nose, cheek seams
 b.add(plate([[-.065,2.54,.62],[.065,2.54,.62],[.06,2.09,.65],[0,1.94,.61]],.028),'polished_silver','HEAD')
 for s in [-1,1]:
  b.add(plate([[.055*s,2.41,.625],[.33*s,2.32,.49],[.29*s,2.04,.51],[.068*s,2.12,.64]],.024),'gunmetal','HEAD')
  b.add(wire([[.05*s,2.52,.63],[.22*s,2.61,.47],[.31*s,2.37,.40]],.012),'black','HEAD')
  b.add(wire([[.08*s,2.40,.643],[.19*s,2.36,.626],[.315*s,2.395,.540]],.016),'blue','HEAD')
  # secondary bleached eye highlight
  b.add(wire([[.105*s,2.405,.650],[.18*s,2.37,.636],[.25*s,2.385,.60]],.005),'white','HEAD')

def ghost():
 b=Builder('GHOST_001 / The Archivist')
 torso(b,'ghost')
 # hood interior and hood cowl
 b.add(ell([0,2.25,-.01],[.33,.51,.29],2),'rubber','HEAD')
 mask_surface(b)
 profile=[(1.42,.76,.47),(1.57,.78,.50),(1.78,.66,.46),(2.03,.57,.44),(2.31,.52,.46),(2.61,.47,.47),(2.82,.39,.39),(2.99,.20,.23),(3.09,.018,.025)]
 b.add(noisy_shell(profile,opening=True),'fabric','HEAD')
 for s in [-1,1]:
  # angular rim of hood framing the face
  b.add(wire([[.52*s,1.86,.19],[.46*s,2.24,.34],[.40*s,2.67,.28],[.25*s,2.97,.14],[0,3.07,.01]],.052),'fabric_fold','HEAD')
  # folded drape from neck to shoulder
  b.add(plate([[.29*s,1.90,.44],[.51*s,1.77,.42],[.84*s,1.28,.37],[.47*s,1.15,.47]],.031),'fabric','TORSO')
  for k in range(5):
   b.add(wire([[.50*s,1.56-k*.04,.49],[.74*s,1.33-k*.025,.33],[.81*s,1.16,.15]],.012),'gunmetal')
 for i in range(14):
  ang=2*PI*i/14
  b.add(cyl([.19*math.sin(ang),1.76,.18+.15*math.cos(ang)],[.12*math.sin(ang),1.93,.19+.17*math.cos(ang)],.012),'bright_steel')
 return b

def null():
 b=Builder('NULL_ENTITY / The Signal Hunter')
 torso(b,'null')
 # glassy fluid body, separable head pivot
 b.add(ell([0,2.3,0],[.407,.569,.36],3),'black_glass','HEAD')
 b.add(ell([0,2.11,.055],[.35,.44,.345],2),'chrome','HEAD')
 # front black inset visor (semi-oval), no face behind
 b.add(ell([0,2.35,.25],[.255,.40,.16],3),'black','HEAD')
 for s in [-1,1]:
  # side helmet futuristic swept plates
  b.add(plate([[.32*s,2.64,.15],[.40*s,2.47,.14],[.30*s,2.12,.31],[.12*s,1.86,.34]],.023),'chrome','HEAD')
  for i in range(5):
   y=2.0+i*.15
   b.add(wire([[.26*s,y,.335],[.38*s,y+.04,.14],[.35*s,y+.07,-.14]],.009),'gunmetal','HEAD')
  # glowing tracer in chest and shoulder
  b.add(wire([[.09*s,1.62,.53],[.36*s,1.49,.49],[.64*s,1.36,.34]],.008),'violet')
  b.add(wire([[.03*s,2.03,.35],[.19*s,2.24,.37],[.29*s,2.54,.22]],.007),'polished_silver','HEAD')
 # Single vertical violet iris, widest near center and tapered ends
 b.add(wire([[0,1.99,.396],[0,2.17,.413],[0,2.40,.412],[0,2.64,.391],[0,2.77,.315]],.027),'violet','HEAD')
 b.add(wire([[.006,2.06,.426],[.006,2.33,.444],[.006,2.58,.42]],.006),'white','HEAD')
 # metallic neck flexing segments and hinges
 for y in np.linspace(1.85,2.07,7):
  b.add(torus_y(.175,.011,float(y),.0,0,32),'gunmetal','HEAD')
 b.add(plate([[-.39,1.73,.37],[-.1,1.48,.55],[0,1.16,.57],[.1,1.48,.55],[.39,1.73,.37]],.035),'black_glass')
 return b

def echo():
 b=Builder('ECHO.exe / The Viral Machine')
 torso(b,'echo')
 b.add(ell([0,2.32,-.04],[.39,.54,.34],3),'brushed_silver','HEAD')
 b.add(ell([0,2.13,.22],[.32,.34,.24],2),'gunmetal','HEAD')
 # single midline forehead camera + lens
 b.add(cyl([0,2.57,.29],[0,2.57,.52],.167,36),'dark_steel','HEAD')
 for r,mat in [(.175,'brushed_silver'),(.14,'gunmetal'),(.098,'bright_steel'),(.073,'black_glass')]:
  b.add(torus_front(r,.012 if r>.1 else .009,0,2.57,.54),'HEAD' if False else mat,'HEAD')
 b.add(ell([0,2.57,.544],[.052,.052,.015],2),'black_glass','HEAD')
 for i in range(12):
  a=2*PI*i/12
  b.add(wire([[.15*math.cos(a),2.57+.15*math.sin(a),.525],[.25*math.cos(a),2.57+.25*math.sin(a),.42]],.011),'dark_steel','HEAD')
 # iconic circular emerald optics, rings, eyelid details
 for s in [-1,1]:
  x=.227*s
  b.add(cyl([x,2.23,.295],[x,2.23,.515],.129,28),'black','HEAD')
  b.add(torus_front(.134,.017,x,2.23,.525,40),'bright_steel','HEAD')
  b.add(torus_front(.103,.017,x,2.23,.542,40),'green','HEAD')
  b.add(ell([x,2.23,.55],[.072,.074,.029],2),'green','HEAD')
  b.add(ell([x,2.23,.586],[.018,.021,.008],1),'white','HEAD')
  # asymmetric plated skull panels + cheek guards
  b.add(plate([[.13*s,2.81,.32],[.37*s,2.76,.17],[.40*s,2.42,.25],[.31*s,2.42,.46]],.038),'polished_silver','HEAD')
  b.add(plate([[.30*s,2.09,.47],[.43*s,2.13,.24],[.31*s,1.89,.43],[.10*s,1.85,.55]],.031),'polished_silver','HEAD')
  b.add(wire([[.26*s,2.70,.39],[.32*s,2.52,.44],[.41*s,2.27,.22],[.33*s,2.00,.42]],.013),'gunmetal','HEAD')
  # ear servo cup
  b.add(cyl([.38*s,2.40,-.03],[.52*s,2.40,-.03],.16,24),'dark_steel','HEAD')
  for i in range(8):
   a=2*PI*i/8
   b.add(ell([.44*s,2.40+.11*math.sin(a),-.03+.11*math.cos(a)],[.012]*3,1),'bright_steel','HEAD')
 # jaw plated in layers
 b.add(plate([[-.22,1.99,.54],[.22,1.99,.54],[.12,1.77,.51],[-.12,1.77,.51]],.048),'brushed_silver','HEAD')
 for k in range(4):
  x=(k-1.5)*.085
  b.add(box([x,1.95,.572],[.049,.084,.022]),'dark_steel','HEAD')
 # geometric cranial plate seams and rivets
 for lat in [2.48,2.67,2.81]:
  for s in [-1,1]:
   b.add(ell([.28*s,lat,.32],[.012,.015,.012],1),'black','HEAD')
 for s in [-1,1]:
  for i in range(7):
   xx=s*(.17+.025*i)
   b.add(cyl([xx,1.84,.03],[xx+s*.06,1.35,.27],.016),'bright_steel')
 return b

def podium(color='blue'):
 b=Builder('DIT MACHINED PODIUM '+color)
 # profile stages inset upper darker surface and chrome bevels
 b.add(lathe([(0,.02),(.0,.77),(.02,.86),(.08,.88),(.13,.82),(.23,.78),(.28,.72),(.295,.02)]),'brushed_silver','PODIUM')
 b.add(lathe([(.292,0),(.292,.725),(.316,.72),(.320,0)]),'charcoal','PODIUM')
 b.add(torus_y(.824,.015,.090),'polished_silver','PODIUM')
 b.add(torus_y(.761,.018,.262),color,'PODIUM')
 b.add(torus_y(.79,.011,.055),color,'PODIUM')
 b.add(torus_y(.737,.008,.310),'gunmetal','PODIUM')
 b.add(torus_y(.872,.008,.037),'dark_steel','PODIUM')
 for i in range(12):
  a=i*2*PI/12
  b.add(ell([.84*math.cos(a),.099,.84*math.sin(a)],[.018,.012,.024],1),'dark_steel','PODIUM')
 return b

def save(scene,path):
 data=scene.export(file_type='glb')
 Path(path).write_bytes(data)
 imported=trimesh.load(path,force='scene')
 tris=sum(len(g.faces) for g in imported.geometry.values()); verts=sum(len(g.vertices) for g in imported.geometry.values())
 print(f'{Path(path).name}: {len(data)/1024:.0f} KiB, {len(imported.geometry)} draw groups, {tris} triangles, {verts} verts')
 assert len(imported.geometry)>0 and tris>500

if __name__=='__main__':
 for name,make in [('ghost_001',ghost),('null_entity',null),('echo_exe',echo)]:
  b=make(); save(b.build(groups=('HEAD','TORSO'),shift=-.87),OUT/f'{name}.glb')
  color={'ghost_001':'blue','null_entity':'violet','echo_exe':'green'}[name]
  p=podium(color)
  for key,meshes in p.pool.items():b.pool[key].extend(meshes)
  save(b.build(shift=-.55),OUT/f'{name}_display.glb')
 for color in ('blue','violet','green'):
  p=podium(color);save(p.build(groups=('PODIUM',)),OUT/f'podium_{color}.glb')
 print('DONE')