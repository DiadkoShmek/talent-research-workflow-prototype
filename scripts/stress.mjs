import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { demoProject, createSession, viewSession, transition, exportHandoff } from '../src/engine.js';
const started=performance.now();
for(let i=0;i<200;i++){
 let state=createSession(demoProject());
 const person=viewSession(state).candidates[0];
 assert.throws(()=>transition(state,{type:'approve',personKey:person.personKey,reviewer:'Stress demo'}));
 for(const ev of person.evidence)state=transition(state,{type:'review',evidenceId:ev.id,decision:'accept',reviewer:'Stress demo',reason:'Fixture quote supports the example criterion'});
 state=transition(state,{type:'identity',personKey:person.personKey,confirmed:true,reviewer:'Stress demo'});
 state=transition(state,{type:'approve',personKey:person.personKey,reviewer:'Stress demo'});
 assert.equal(exportHandoff(state).candidates.length,1);
 state=transition(state,{type:'setCutoff',cutoff:'2026-09-01'});
 assert.equal(viewSession(state).metrics.approved,0);
 assert.throws(()=>exportHandoff(state));
 assert.throws(()=>createSession(demoProject('future-date')));
 if(performance.now()-started>10000)throw Error('Stress smoke exceeded 10 seconds');
}
console.log(`PASS: 200 complete local review / export / invalidation flows in ${Math.round(performance.now()-started)} ms. No network calls.`);
