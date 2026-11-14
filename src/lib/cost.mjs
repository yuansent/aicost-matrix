export const BUCKETS = ['input', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h', 'output'];
export function count(value, label) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative whole number.`);
  return value;
}
export function numberInput(value, label, integer = true) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} is required.`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e12 || (integer && !Number.isSafeInteger(n))) throw new Error(`${label} must be a non-negative ${integer ? 'whole number' : 'number'} no greater than 1 trillion.`);
  return n;
}
export function priceCall(model, buckets, mode) {
  if (!model || !['standard', 'batch'].includes(mode)) throw new Error('Select a supported model and billing mode.');
  for (const key of BUCKETS) count(buckets[key], key);
  const promptTokens = buckets.input + buckets.cacheRead + buckets.cacheWrite5m + buckets.cacheWrite1h;
  if (!Number.isSafeInteger(promptTokens) || promptTokens > model.maxPromptTokens) throw new Error(`Supported prompt length is at most ${model.maxPromptTokens.toLocaleString()} tokens, including cache reads and writes. Higher tiers are not priced here.`);
  const factor = mode === 'batch' ? model.batchMultiplier : 1;
  const lines = BUCKETS.map(key => ({ bucket: key, tokens: buckets[key], ratePerMillion: model.rates[key] * factor, usd: buckets[key] * model.rates[key] * factor / 1e6 }));
  const total = lines.reduce((sum, x) => sum + x.usd, 0);
  if (!Number.isFinite(total)) throw new Error('Cost exceeds the supported numeric range.');
  return { lines, total, promptTokens };
}
export function estimate(model, buckets, mode, workload) {
  const call = priceCall(model, buckets, mode);
  for (const k of ['actionsPerDay', 'days', 'callsPerAction', 'extraCallsPerDay']) count(workload[k], k);
  if (workload.days < 1 || workload.days > 366) throw new Error('Days must be between 1 and 366.');
  if (workload.callsPerAction < 1) throw new Error('Calls per action must be at least 1.');
  const dailyCalls = workload.actionsPerDay * workload.callsPerAction + workload.extraCallsPerDay;
  if (!Number.isSafeInteger(dailyCalls) || !Number.isSafeInteger(dailyCalls * workload.days)) throw new Error('Request count is too large.');
  const perAction = call.total * workload.callsPerAction;
  return { ...call, dailyCalls, monthlyCalls: dailyCalls * workload.days, perAction, daily: call.total * dailyCalls, period: call.total * dailyCalls * workload.days };
}
// Only direct Anthropic Messages non-streaming responses, not normalized SDK/Bedrock records.
export function normalizeMessage(record, models, mode) {
  if (!record || typeof record !== 'object' || record.type !== 'message') throw new Error('Expected a complete, non-streaming Anthropic Messages response with type="message".');
  const model = models.find(m => m.apiModel === record.model);
  if (!model) throw new Error('Unknown model/version. No alias or nearest-price fallback is used.');
  const u = record.usage;
  if (!u || typeof u !== 'object' || Array.isArray(u)) throw new Error('Missing usage object.');
  const allowed = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens', 'cache_creation', 'server_tool_use', 'service_tier', 'inference_geo'];
  const unknown = Object.keys(u).filter(k => !allowed.includes(k));
  if (unknown.length) throw new Error(`Unsupported usage fields: ${unknown.join(', ')}. No complete estimate was produced.`);
  if (u.inference_geo && u.inference_geo !== 'global') throw new Error('Only global inference pricing is supported.');
  if (u.service_tier && u.service_tier !== 'standard') throw new Error('Only standard service tier is supported (no fast/priority modes).');
  if (u.server_tool_use && Object.values(u.server_tool_use).some(n => n !== 0)) throw new Error('Server tool usage is present. Tool charges are not priced here.');
  // Optional cache counts may be omitted by the direct API when unused; required input/output may not.
  const buckets = { input: count(u.input_tokens, 'input_tokens'), output: count(u.output_tokens, 'output_tokens'), cacheRead: count(('cache_read_input_tokens' in u ? u.cache_read_input_tokens : 0), 'cache_read_input_tokens'), cacheWrite5m: 0, cacheWrite1h: 0 };
  const creation = count(('cache_creation_input_tokens' in u ? u.cache_creation_input_tokens : 0), 'cache_creation_input_tokens');
  if (u.cache_creation != null) {
    if (typeof u.cache_creation !== 'object' || Array.isArray(u.cache_creation) || Object.keys(u.cache_creation).some(k => !['ephemeral_5m_input_tokens', 'ephemeral_1h_input_tokens'].includes(k))) throw new Error('Unsupported cache creation breakdown.');
    buckets.cacheWrite5m = count(u.cache_creation.ephemeral_5m_input_tokens, 'ephemeral_5m_input_tokens');
    buckets.cacheWrite1h = count(u.cache_creation.ephemeral_1h_input_tokens, 'ephemeral_1h_input_tokens');
    if (creation !== buckets.cacheWrite5m + buckets.cacheWrite1h) throw new Error('Cache write total conflicts with its 5m/1h breakdown.');
  } else if (creation > 0) throw new Error('Cache writes need an explicit 5m/1h breakdown; TTL is not guessed.');
  return { model, buckets, ...priceCall(model, buckets, mode) };
}
export function inspectMessages(text, models, mode) {
  if (new TextEncoder().encode(text).length > 1_000_000) throw new Error('Input is limited to 1 MB.');
  let records;
  try { const parsed = JSON.parse(text); records = Array.isArray(parsed) ? parsed : [parsed]; }
  catch { try { records = text.trim().split('\n').map(line => JSON.parse(line)); } catch { throw new Error('Enter a JSON response, array of responses, or one complete JSON response per line.'); } }
  if (!records.length || records.length > 500) throw new Error('Provide between 1 and 500 responses.');
  const ids = new Set();
  const rows = records.map((record, index) => {
    if (typeof record?.id !== 'string' || !record.id.trim()) throw new Error(`Row ${index + 1}: message id is required for duplicate detection.`);
    if (ids.has(record.id)) throw new Error(`Row ${index + 1}: duplicate message id. Remove duplicated responses; do not count stream snapshots as calls.`);
    ids.add(record.id);
    try { const result = normalizeMessage(record, models, mode); return { row: index + 1, model: result.model.apiModel, priceCheckedAt: result.model.verifiedAt, source: result.model.sourceUrl, buckets: result.buckets, lines: result.lines, usd: result.total }; }
    catch (e) { throw new Error(`Row ${index + 1}: ${e.message}`); }
  });
  return { version: 1, basis: 'Token-fee estimate at stored reference prices; not a provider-reported charge or historical invoice.', mode, rows, total: rows.reduce((s, r) => s + r.usd, 0) };
}
export function money(n) {
  if (n > 0 && n < 0.000001) return '<$0.000001';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}
