// CHAOS ARENA V2 — deterministic top battle simulation (2D rigid-body approximation).
// No scripted winners. Rendering must never change simulation state.
export const STEP = 1 / 120;
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
export const TYPES = [
  {name:'Angriff',mass:0.85,grip:0.7,drag:0.013,spinDrag:0.030,attack:1.3,color:'#ff5365'},
  {name:'Verteidigung',mass:1.45,grip:1.25,drag:0.018,spinDrag:0.027,attack:0.9,color:'#50aaff'},
  {name:'Ausdauer',mass:1.0,grip:0.95,drag:0.010,spinDrag:0.016,attack:1,color:'#6cf5b0'},
  {name:'Balance',mass:1.1,grip:1,drag:0.014,spinDrag:0.023,attack:1.05,color:'#ffc45b'}
];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createBattle(seed=1, contestants=[0,1]) {
  const random=rng(seed);
  const n=contestants.length;
  const tops=contestants.map((type,i)=>{
    const spec=TYPES[type],angle=2*Math.PI*i/n+random()*0.12,rad=0.47;
    return {id:i,type,name:spec.name+' '+(i+1),x:Math.cos(angle)*rad,y:Math.sin(angle)*rad,
      vx:-Math.cos(angle)*(0.65+random()*0.18)-Math.sin(angle)*0.10,vy:-Math.sin(angle)*(0.65+random()*0.18)+Math.cos(angle)*0.10,
      angle:random()*Math.PI*2,omega:(random()<0.5?-1:1)*(35+random()*12),
      radius:0.105,mass:spec.mass,alive:true,tilt:0,hitBy:null,hitTick:-1,knockouts:0};
  });
  return {seed,tick:0,radius:1,tops,events:[],winner:null};
}
export function step(b) {
  if(b.winner!==null) return b;
  const dt=STEP; b.tick++;
  const t=b.tick*dt;
  // The bowl becomes smaller after 30 s. The edge is not a solid wall.
  b.radius=1-Math.min(0.53,Math.max(0,t-30)*0.007);
  for(const p of b.tops) {
    if(!p.alive)continue;
    const spec=TYPES[p.type];
    p.angle+=p.omega*dt;
    p.omega*=Math.exp(-spec.spinDrag*dt);
    // Gyroscopic stability proxy: reduced spin increases tilt and translational wobble.
    const stability=clamp(Math.abs(p.omega)/40,0,1);
    p.tilt=(1-stability)*0.48;
    const distance=Math.hypot(p.x,p.y)||1;
    // Smooth bowl force, tangential gyroscopic drift, contact friction.
    // Bowl profile h(r)=0.10*r²+0.48*r⁶: steep rounded outer wall.
    const radialForce=(0.20*distance+2.88*Math.pow(distance,5))/spec.mass;
    p.vx+=(-p.x/distance*radialForce-p.y/distance*0.015*Math.sign(p.omega))*dt;
    p.vy+=(-p.y/distance*radialForce+p.x/distance*0.015*Math.sign(p.omega))*dt;
    const damping=Math.exp(-spec.drag*dt);
    p.vx*=damping;p.vy*=damping;
    p.x+=p.vx*dt;p.y+=p.vy*dt;
  }
  // Resolve contact impulses based on relative velocity, mass, and spin tangential velocity.
  const active=b.tops.filter(p=>p.alive);
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
    const a=active[i],c=active[j];
    let dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy),min=a.radius+c.radius;
    if(d>=min)continue;
    const nx=d>1e-9?dx/d:1,ny=d>1e-9?dy/d:0;
    const invA=1/a.mass,invC=1/c.mass,overlap=min-d;
    a.x-=nx*overlap*invA/(invA+invC);a.y-=ny*overlap*invA/(invA+invC);
    c.x+=nx*overlap*invC/(invA+invC);c.y+=ny*overlap*invC/(invA+invC);
    const rvx=c.vx-a.vx,rvy=c.vy-a.vy,normal=rvx*nx+rvy*ny;
    if(normal>=0)continue;
    const restitution=0.72;
    const impulse=-(1+restitution)*normal/(invA+invC);
    a.vx-=impulse*nx*invA;a.vy-=impulse*ny*invA;
    c.vx+=impulse*nx*invC;c.vy+=impulse*ny*invC;
    // Coulomb tangential impulse and simplified spin transfer.
    const tx=-ny,ty=nx;
    const tangential=(c.vx-a.vx)*tx+(c.vy-a.vy)*ty - (a.omega*a.radius+c.omega*c.radius)*0.035;
    const friction=clamp(-tangential/(invA+invC),-impulse*0.16,impulse*0.16);
    a.vx-=friction*tx*invA;a.vy-=friction*ty*invA;
    c.vx+=friction*tx*invC;c.vy+=friction*ty*invC;
    a.omega+=friction*0.4/a.mass;c.omega+=friction*0.4/c.mass;
    a.hitBy=c.id;c.hitBy=a.id;a.hitTick=b.tick;c.hitTick=b.tick;
    b.events.push({type:'hit',tick:b.tick,a:a.id,c:c.id,strength:Math.abs(normal)});
  }
  // A physical lip, not a hit-timer: outward kinetic energy must clear the raised rim.
  // A top may leave without a recent collision if it has sufficient launch energy.
  for(const p of b.tops){
    if(!p.alive)continue;
    if(b.tops.filter(q=>q.alive).length<=1)break;
    const d=Math.hypot(p.x,p.y),nx=p.x/(d||1),ny=p.y/(d||1);
    const edge=b.radius-p.radius;
    if(d<=edge)continue;
    const outward=p.vx*nx+p.vy*ny;
    // Geometric rise from bowl floor to rim; shrinking radius raises pressure,
    // but never teleports a top outside or directly eliminates it.
    const climb=Math.max(0,d-edge);
    const rimBarrier=0.22+climb*1.5;
    if(d>b.radius && outward>0 && outward*outward>rimBarrier){
      p.alive=false;
      const by=p.hitBy;
      if(by!==null && b.tops[by])b.tops[by].knockouts++;
      b.events.push({type:'ringout',tick:b.tick,id:p.id,by});
    } else if(outward>0){
      // Climbing the lip drains outward momentum; gravity sends it back down.
      const brake=Math.min(outward,(0.8+climb*6)*dt);
      p.vx-=nx*brake;p.vy-=ny*brake;
      if(d>=b.radius){p.vx-=nx*outward*0.6;p.vy-=ny*outward*0.6;}
    }
  }
  const survivors=b.tops.filter(p=>p.alive);
  if(survivors.length===1){b.winner=survivors[0].id;b.events.push({type:'winner',tick:b.tick,id:b.winner});}
  return b;
}
export function simulate(b,seconds){for(let i=0;i<Math.round(seconds/STEP)&&b.winner===null;i++)step(b);return b;}
