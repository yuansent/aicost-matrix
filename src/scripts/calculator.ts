import models from '../data/models.json';
import { numberInput, estimate, money } from '../lib/cost.mjs';
import { downloadJSON, bucketLabels } from './shared';
const el = (id: string) => document.getElementById(id)!;
const value = (id: string) => (el(id) as HTMLInputElement).value;
let exportData: object | null = null;
function render() {
  try {
    const model = models.find(m => m.id === value('model'))!;
    const buckets = Object.fromEntries(['input','output','cacheRead','cacheWrite5m','cacheWrite1h'].map(k => [k, numberInput(value(k), bucketLabels[k])]));
    const workload = Object.fromEntries(['actionsPerDay','callsPerAction','extraCallsPerDay','days'].map(k => [k, numberInput(value(k), k)]));
    const result = estimate(model,buckets,value('mode'),workload);
    el('estimateError').hidden = true; el('estimateOutput').hidden = false;
    for (const [id,n] of Object.entries({ perCall:result.total,perAction:result.perAction,perDay:result.daily,periodCost:result.period })) el(id).textContent = money(n);
    el('workloadSummary').textContent = `${result.dailyCalls.toLocaleString()} calls/day × ${workload.days} days = ${result.monthlyCalls.toLocaleString()} calls. Includes ${workload.extraCallsPerDay} extra calls/day once. Prompt total: ${result.promptTokens.toLocaleString()} tokens/call.`;
    el('breakdown').replaceChildren(...result.lines.map(line => {
      const tr = document.createElement('tr');
      for (const text of [bucketLabels[line.bucket],line.tokens.toLocaleString(),money(line.ratePerMillion),money(line.usd)]) { const td = document.createElement('td');td.textContent = text;tr.append(td); }return tr;
    }));
    el('rateSource').textContent = `Source: Anthropic official pricing, checked ${model.verifiedAt}; ${model.channel}, ${value('mode')}, global routing, USD. Stored snapshot; not live prices. Next review due ${model.reviewAfter}.${new Date().toISOString().slice(0,10) > model.reviewAfter ? ' REVIEW OVERDUE: verify provider prices before relying on this estimate.' : ''}`;
    el('scenarios').replaceChildren(...[.5,1,2].map(factor=>{ const div=document.createElement('div');const label=document.createElement('span');label.textContent=`${factor}× call volume`;const strong=document.createElement('strong');strong.textContent=money(result.period*factor);div.append(label,strong);return div;}));
    el('comparison').replaceChildren(...models.map(m=>{const p=document.createElement('p');p.textContent=`${m.name}: ${money(estimate(m,buckets,value('mode'),workload).period)} / ${workload.days} days`;return p;}));
    exportData={version:1,basis:'Estimated text token fees, not a provider charge or invoice',model:model.apiModel,channel:model.channel,mode:value('mode'),geography:'global',currency:'USD',priceVerifiedAt:model.verifiedAt,source:model.sourceUrl,buckets,workload,result,excluded:['Server tools','Images, audio, video','Tax, credits and private discounts','Other application infrastructure','US-only inference','Fast/priority modes'],scenarios:'0.5x / 1x / 2x volume; same token profile; not confidence intervals'};
  } catch (error) {
    el('estimateError').textContent=(error as Error).message;el('estimateError').hidden=false;el('estimateOutput').hidden=true;exportData=null;
  }
}
el('estimateForm').addEventListener('input',render);el('estimateForm').addEventListener('change',render);
el('estimateForm').addEventListener('submit',e=>e.preventDefault());
el('resetExample').addEventListener('click',()=>{(el('estimateForm') as HTMLFormElement).reset();render();});
el('downloadBudget').addEventListener('click',()=>{if(exportData)downloadJSON('aicost-budget.json',exportData);});
render();
