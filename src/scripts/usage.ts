import models from '../data/models.json';
import { inspectMessages, money } from '../lib/cost.mjs';
import { downloadJSON } from './shared';
const el=(id:string)=>document.getElementById(id)!;
const input=el('usageRecords') as HTMLTextAreaElement;
const mode=el('usageMode') as HTMLSelectElement;
const confirm=el('confirmScope') as HTMLInputElement;
let result:ReturnType<typeof inspectMessages>|null=null;
function invalidate(){result=null;el('usageOutput').hidden=true;el('usageError').hidden=true;}
input.addEventListener('input',invalidate);mode.addEventListener('change',invalidate);confirm.addEventListener('change',invalidate);
el('loadUsageExample').addEventListener('click',()=>{
 input.value=JSON.stringify([{id:'msg_fictional_1',type:'message',model:'claude-sonnet-5-5',usage:{input_tokens:1000,cache_read_input_tokens:2000,cache_creation_input_tokens:300,cache_creation:{ephemeral_5m_input_tokens:200,ephemeral_1h_input_tokens:100},output_tokens:500}},{id:'msg_fictional_2',type:'message',model:'claude-sonnet-5-5',usage:{input_tokens:500,cache_read_input_tokens:0,cache_creation_input_tokens:0,output_tokens:100}}],null,2);
 confirm.checked=false;mode.value='standard';invalidate();
});
el('clearUsage').addEventListener('click',()=>{input.value='';confirm.checked=false;invalidate();el('usageRows').replaceChildren();});
el('inspectUsage').addEventListener('click',()=>{
 invalidate();
 try{
  if(!confirm.checked)throw new Error('Confirm the supported provider, mode and scope before checking.');
  result=inspectMessages(input.value,models,mode.value);
  el('usageTotal').textContent=money(result.total);el('usageSummary').textContent=`${result.rows.length} complete responses · ${mode.value} · global routing · USD. Input is exclusive of cache reads and writes. No raw message content or IDs in the export.`;
  el('usageRows').replaceChildren(...result.rows.map(row=>{const tr=document.createElement('tr');const b=row.buckets;for(const text of [`${row.row} · ${row.model}`,b.input,b.cacheRead,b.cacheWrite5m,b.cacheWrite1h,b.output,money(row.usd)]){const td=document.createElement('td');td.textContent=String(text);tr.append(td);}return tr;}));
  el('usageOutput').hidden=false;
 }catch(e){result=null;el('usageError').textContent=(e as Error).message;el('usageError').hidden=false;}
});
el('downloadUsage').addEventListener('click',()=>{if(result)downloadJSON('aicost-usage-calculation.json',result);});
window.addEventListener('pageshow',invalidate);
