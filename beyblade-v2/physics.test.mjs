import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,step,simulate,STEP,TYPES} from './physics.js';
test('four distinct top classes',()=>assert.equal(new Set(TYPES.map(t=>t.name)).size,4));
test('fixed timestep is 120 Hz',()=>assert.equal(STEP,1/120));
test('same seed produces same initial state',()=>assert.deepEqual(createBattle(123),createBattle(123)));
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
 if(b.winner!==null){assert.equal(b.tops.filter(p=>p.alive).length,1);assert.equal(b.tops[b.winner].alive,true)}
});
test('no automatic winner by timeout',()=>{
 const b=createBattle(2);
 b.tops.forEach(p=>{p.vx=0;p.vy=0;p.x=0;p.y=0});
 // A timeout must not directly set winner; any winner needs actual ring-out events.
 simulate(b,90);
 if(b.winner!==null)assert.ok(b.events.some(e=>e.type==='ringout'));
});

test('all standard battles finish through physical ring-outs within 120 seconds',()=>{
 for(let seed=1;seed<=20;seed++){
  const b=simulate(createBattle(seed),120);
  assert.notEqual(b.winner,null,'seed '+seed+' did not finish');
  assert.equal(b.events.filter(e=>e.type==='ringout').length,3,'seed '+seed+' needs three ring-outs');
 }
});
