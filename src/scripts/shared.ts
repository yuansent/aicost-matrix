export const bucketLabels: Record<string,string> = { input:'Uncached input',output:'Output (including billed thinking)',cacheRead:'Cache read',cacheWrite5m:'Cache write · 5 minutes',cacheWrite1h:'Cache write · 1 hour' };
export function downloadJSON(name: string, data: unknown) {
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
