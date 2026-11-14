import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { count, numberInput, priceCall, estimate, inspectMessages, money } from '../src/lib/cost.mjs';
const models=JSON.parse(readFileSync(new URL('../src/data/models.json',import.meta.url)));
const model=models[0];
const base={input:1000,cacheRead:2000,cacheWrite5m:0,cacheWrite1h:0,output:500};
const response=(id='msg_test',usage={input_tokens:1000,output_tokens:500})=>({id,type:'message',model:model.apiModel,usage});
const run=(r,mode='standard')=>inspectMessages(JSON.stringify(r),models,mode);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
test('all five buckets have independently computed standard and batch fees',()=>{
 const b={input:1000,cacheRead:2000,cacheWrite5m:200,cacheWrite1h:100,output:500};
 close(priceCall(model,b,'standard').total,.0081);close(priceCall(model,b,'batch').total,.00405);
});
test('cache counts add to prompt, never subtract from uncached input',()=>{
 const b={...base,input:726,cacheRead:31426,output:114};
 const r=priceCall(model,b,'standard');assert.equal(r.promptTokens,32152);close(r.total,.0057346);
});
test('retries counted once; business action and period units remain separate',()=>{
 const r=estimate(model,base,'standard',{actionsPerDay:100,callsPerAction:2,extraCallsPerDay:20,days:1});
 assert.equal(r.dailyCalls,220);close(r.perAction,.0144);close(r.period,1.584);
});
test('zero usage stays zero; no fake less-than result',()=>{assert.equal(money(priceCall(model,{input:0,cacheRead:0,cacheWrite5m:0,cacheWrite1h:0,output:0},'standard').total),'$0.00');});
test('blank, negative, fraction, nonfinite and unsafe UI counts are rejected',()=>{
 for(const v of ['', ' ', '-1','1.1','Infinity','NaN','9007199254740993'])assert.throws(()=>numberInput(v,'Tokens'));
 assert.equal(numberInput('0','Tokens'),0);assert.throws(()=>count('100','Tokens'));
});
test('prompt cap counts cache buckets and honors exact boundary',()=>{
 priceCall(model,{...base,input:98000,cacheRead:2000},'standard');
 assert.throws(()=>priceCall(model,{...base,input:98001,cacheRead:2000},'standard'),/100,000/);
});
test('no unsupported billing mode or impossible workload',()=>{
 assert.throws(()=>priceCall(model,base,'fast'));
 for(const w of [{days:0,callsPerAction:1},{days:367,callsPerAction:1},{days:30,callsPerAction:0}])assert.throws(()=>estimate(model,base,'standard',{actionsPerDay:1,extraCallsPerDay:0,...w}));
});
test('complete direct responses support optional zero cache counts',()=>close(run(response()).total,.007));
test('JSON array and JSONL work; duplicate responses block whole report',()=>{
 const a=response('a'),b=response('b');close(run([a,b]).total,.014);
 close(inspectMessages(JSON.stringify(a)+'\n'+JSON.stringify(b),models,'batch').total,.007);
 assert.throws(()=>run([a,a]),/duplicate/);
});
test('cache write totals reconcile with explicit TTL; nothing is double-counted',()=>{
 const u={input_tokens:1000,output_tokens:500,cache_read_input_tokens:2000,cache_creation_input_tokens:300,cache_creation:{ephemeral_5m_input_tokens:200,ephemeral_1h_input_tokens:100}};
 close(run(response('a',u)).total,.0081);
 assert.throws(()=>run(response('a',{...u,cache_creation_input_tokens:301})),/conflicts/);
 const {cache_creation,...noTTL}=u;assert.throws(()=>run(response('a',noTTL)),/breakdown/);
});
test('missing required, null, negative and noninteger usage fields block estimates',()=>{
 for(const u of [{output_tokens:1},{input_tokens:null,output_tokens:1},{input_tokens:1,output_tokens:-1},{input_tokens:1.5,output_tokens:1},{input_tokens:1,output_tokens:1,cache_read_input_tokens:null}])assert.throws(()=>run(response('a',u)));
});
test('unknown schema/model, normalized counts and streaming fragments never silently match',()=>{
 assert.throws(()=>run({...response(),model:'claude-sonnet-latest'}),/Unknown model/);
 assert.throws(()=>run({...response(),type:'message_start'}),/complete/);
 assert.throws(()=>run(response('a',{input_tokens:1,output_tokens:1,total_tokens:2})),/Unsupported usage fields/);
});
test('unsupported geography, server tools and service tiers are blocked',()=>{
 for(const extra of [{inference_geo:'us'},{server_tool_use:{web_search_requests:1}},{service_tier:'priority'}])assert.throws(()=>run(response('a',{input_tokens:1,output_tokens:1,...extra})));
});
test('incomplete record sets never yield partial totals',()=>{
 assert.throws(()=>run([response('a'),response('b',{input_tokens:1})]),/Row 2/);
 assert.throws(()=>run({...response(),id:undefined}),/id is required/);
 assert.throws(()=>inspectMessages('',models,'standard'));
 assert.throws(()=>run([]));assert.throws(()=>run(Array.from({length:501},(_,i)=>response(String(i)))));
});
test('export whitelists billing fields and omits sensitive ids/content',()=>{
 const r=run({...response('sensitive_id'),content:[{text:'private prompt'}],customer_id:'secret_customer'});
 const s=JSON.stringify(r);for(const text of ['sensitive_id','private prompt','secret_customer'])assert.ok(!s.includes(text));
 assert.ok(s.includes('priceCheckedAt'));assert.ok(s.includes('source'));
});
test('small nonzero amounts never display as free',()=>{assert.equal(money(.000001),'$0.000001');assert.equal(money(.000000005),'<$0.000001');});
test('source snapshot hashes and exact model IDs are checked',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../docs/pricing-evidence/manifest.json',import.meta.url)));
 for(const f of manifest.files){const bytes=readFileSync(new URL('../'+f.path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);}
 const ids=readFileSync(new URL('../docs/pricing-evidence/anthropic-model-ids-20261114.md',import.meta.url),'utf8');
 for(const m of models){assert.ok(ids.includes(m.apiModel));assert.equal(m.currency,'USD');assert.equal(m.verifiedAt,'2026-11-14');}
});
test('stored rates match the five cells of official source rows',()=>{
 const source=readFileSync(new URL('../docs/pricing-evidence/anthropic-pricing-20261114.md',import.meta.url),'utf8');
 for(const m of models){
  const row=[...source.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(x=>x[1]).find(x=>x.includes(m.name));assert.ok(row,m.name);
  const cells=[...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1]);
  const rates=cells.slice(1).map(x=>Number(x.match(/\$([\d.]+)/)?.[1]));
  assert.deepEqual(rates,[m.rates.input,m.rates.output,m.rates.cacheWrite5m,m.rates.cacheWrite1h,m.rates.cacheRead]);
 }
});
