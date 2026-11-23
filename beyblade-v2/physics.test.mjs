import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,step,simulate,STEP,TYPES} from './physics.js';
test('four distinct top classes',()=>assert.equal(new Set(TYPES.map(t=>t.name)).size,4));
test('fixed timestep is 120 Hz',()=>assert.equal(STEP,1/120));
test('same seed produces same initial state',()=>assert.deepEqual(createBattle(123),createBattle(123)));
test('fighter labels use player numbers rather than roles',()=>{
 assert.deepEqual(createBattle(123,[0,1],[2,4]).tops.map(p=>p.name),['Spieler 2','Spieler 4']);
});
test('same seed and tick count produce same state',()=>{
 const a=createBattle(77),b=createBattle(77);
 for(let i=0;i<1200;i++){step(a);step(b)}
 assert.deepEqual(a,b);
});
test('frame rendering never affects physics',()=>{
 const a=createBattle(22),b=createBattle(22);
 for(let i=0;i<2400;i++)step(a);
 for(let i=0;i<2400;i++){if(i%2===0){void b.tops.map(p=>p.x)}step(b)}
 assert.deepEqual(a,b);
});
test('no champion with multiple survivors',()=>{
 const b=createBattle(1);
 for(let i=0;i<600;i++){step(b);if(b.tops.filter(p=>p.alive).length>1)assert.equal(b.winner,null)}
});
test('winner only when exactly one survives',()=>{
 const b=simulate(createBattle(9),90);
 if(b.winner!==null){
 assert.equal(b.tops.filter(p=>p.alive).length,1);
 assert.equal(b.tops[b.winner].alive,true);
 assert.ok(b.events.some(e=>e.type==='ringout'));
 }
});
test('no automatic winner by timeout',()=>{
 const b=createBattle(2);
 b.tops.forEach(p=>{p.vx=0;p.vy=0;p.x=0;p.y=0;p.omega=0});
 simulate(b,90);
 assert.equal(b.winner,null);
 assert.equal(b.events.some(e=>e.type==='ringout'),false);
 assert.ok(b.radius<1);
});

test('default battle is a 1v1 duel',()=>assert.equal(createBattle(5).tops.length,2));
test('doubles support four contestants',()=>assert.equal(createBattle(5,[0,1,2,3]).tops.length,4));
test('winner requires an actual ring-out',()=>{
 const b=createBattle(7);
 b.tops[0].x=0.999;b.tops[0].y=0;b.tops[0].vx=2;b.tops[0].vy=0;
 b.tops[1].x=0;b.tops[1].y=0;b.tops[1].vx=0;b.tops[1].vy=0;
 step(b);
 assert.equal(b.tops[0].alive,false);
 assert.equal(b.tops[1].alive,true);
 assert.equal(b.winner,1);
 assert.ok(b.events.some(e=>e.type==='ringout'&&e.id===0));
});
test('a lone contestant is not declared winner without a ring-out',()=>{
 const b=createBattle(7,[0]);
 b.tops[0].x=0;b.tops[0].y=0;b.tops[0].vx=0;b.tops[0].vy=0;b.tops[0].omega=0;
 simulate(b,10);
 assert.equal(b.winner,null);
 assert.equal(b.events.some(e=>e.type==='ringout'),false);
});
test('contracting bowl does not stop before a ring-out',()=>{
 const b=createBattle(12);
 b.tops.forEach(p=>{p.x=0;p.y=0;p.vx=0;p.vy=0;p.omega=0});
 simulate(b,220);
 assert.ok(b.events.some(e=>e.type==='ringout'));
 assert.ok(b.radius<0.22);
});
test('overlapping tops keep pursuit forces finite',()=>{
 const b=createBattle(12);
 b.tops.forEach(p=>{p.x=0;p.y=0;p.vx=0;p.vy=0});
 step(b);
 assert.ok(b.tops.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.vx)&&Number.isFinite(p.vy)));
});
test('seeded duels produce frequent contacts and only ring-out winners',()=>{
 let hitCount=0,longestGap=0;
 for(let seed=1;seed<=20;seed++){
  const b=createBattle(seed);
  simulate(b,180);
  const hits=b.events.filter(e=>e.type==='hit');
  const ringouts=b.events.filter(e=>e.type==='ringout');
  hitCount+=hits.length;
  for(let i=1;i<hits.length;i++)longestGap=Math.max(longestGap,(hits[i].tick-hits[i-1].tick)*STEP);
  assert.ok(ringouts.length>0,`seed ${seed} must end with a ring-out`);
  assert.equal(b.tops.filter(p=>p.alive).length,1);
  assert.ok(b.events.some(e=>e.type==='winner'&&e.id===b.winner));
 }
 assert.ok(hitCount/20>60,`average hits ${hitCount/20} should exceed the 36.1 baseline`);
 assert.ok(longestGap<15,`longest inter-hit gap ${longestGap}s should remain under 15 seconds`);
});
test('simultaneous ring-outs do not award a winner',()=>{
 const b=createBattle(7);
 b.tops.forEach((p,i)=>{p.x=i?1.2:-1.2;p.y=0;p.vx=i?2:-2;p.vy=0});
 step(b);
 assert.equal(b.tops.filter(p=>p.alive).length,0);
 assert.equal(b.winner,null);
 assert.equal(b.draw,true);
});
