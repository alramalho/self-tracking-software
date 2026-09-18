import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';

const directory = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(directory, '../..');
const output = path.resolve(process.argv[2] || path.join(directory, 'results'));
const selectedModels = [
  'meta/muse-spark-1.3',
  'spacexai/grok-4.6',
  'google/gemini-3.8-flash',
  'openai/gpt-5.6-terra',
  'zai/glm-5.3',
];
const caseText = await fs.readFile(path.join(directory, 'cases-v2.json'), 'utf8');
const system = await fs.readFile(path.join(directory, 'prompt-v2.md'), 'utf8');
const cases = JSON.parse(caseText);
const casesSha256 = createHash('sha256').update(caseText).digest('hex');
const promptSha256 = createHash('sha256').update(system).digest('hex');
if (process.argv.includes('--describe')) {
  console.log(JSON.stringify({ cases: cases.map(c => ({ id: c.id, origin: c.origin, variants: c.variants?.map(v => v.id) || [] })), models: selectedModels, casesSha256, promptSha256 }, null, 2));
  process.exit(0);
}
const review = JSON.parse(await fs.readFile(path.join(directory, 'review.json'), 'utf8'));
if (review.status !== 'approved' || review.approvedCasesSha256 !== casesSha256 || review.approvedPromptSha256 !== promptSha256) {
  console.error('Case set and capability prompt are pending user review, or changed since approval. No model requests were made.');
  process.exit(1);
}
dotenv.config({ path: path.join(backend, '.env') });
const apiKey = process.env.AI_GATEWAY_API_KEY;
if (!apiKey) throw new Error('AI_GATEWAY_API_KEY is not configured');
await fs.mkdir(output, { recursive: true });
const catalogResponse = await fetch('https://ai-gateway.vercel.sh/v1/models');
if (!catalogResponse.ok) throw new Error(`Model catalog returned HTTP ${catalogResponse.status}`);
const catalogBody = await catalogResponse.json();
const catalog = catalogBody.data || catalogBody.models;
const models = selectedModels.map(id => {
  const model = catalog.find(item => item.id === id);
  if (!model) throw new Error(`Requested model not in catalog: ${id}`);
  return { id, name: model.name, inputPrice: Number(model.pricing?.input), outputPrice: Number(model.pricing?.output) };
});
const maxOutputTokens = 4096;
const metadata = {
  suite: 'onboarding-decision-pilot-v2', startedAt: new Date().toISOString(), casesSha256, promptSha256,
  models, cases: cases.map(c => c.id), maxOutputTokens,
  maxCalls: models.length * cases.reduce((n, c) => n + 2 + (c.variants?.length || 0), 0),
  configuration: 'Same prompt, provider-default reasoning/temperature, JSON object format. No tools, no model judge, no retries or fallback models.',
  limits: 'One run per case/phase. Synthetic scenarios. Not statistical evidence of model quality or behavioural effectiveness. Cost is a catalog estimate, not an invoice.',
};
await fs.writeFile(path.join(output, 'metadata.json'), JSON.stringify(metadata, null, 2));

function check(value) {
  const issues = [];
  if (!['ask', 'ready', 'no_intervention'].includes(value?.kind)) issues.push('invalid_kind');
  const screen = value?.screen;
  if (!screen || typeof screen.title !== 'string') issues.push('missing_screen');
  else {
    if (screen.title.split(/\s+/).length > 12) issues.push('title_too_long');
    if ((screen.helper || '').split(/\s+/).length > 25) issues.push('helper_too_long');
    if (!['text', 'single_choice', 'number', 'date', 'none'].includes(screen.input)) issues.push('invalid_input');
    if (!Array.isArray(screen.choices)) issues.push('missing_choices');
    else if (screen.input === 'single_choice' ? screen.choices.length < 2 || screen.choices.length > 5 : screen.choices.length !== 0) issues.push('invalid_choices');
    if (value.kind === 'ask' ? screen.input === 'none' : screen.input !== 'none') issues.push('input_kind_mismatch');
  }
  if (!value?.decision || !value?.proposed_action || !Array.isArray(value?.known_facts)) issues.push('missing_contract_fields');
  if (!Array.isArray(value?.answer_use) || (value.kind === 'ask' ? value.answer_use.length !== 2 : value.answer_use.length !== 0)) issues.push('answer_use_mismatch');
  if (value.kind === 'ask' && value.proposed_action?.type !== 'none') issues.push('action_before_answer');
  return issues;
}

const results = [];
let authenticationFailed = false;
async function call(model, scenario, phase, messages) {
  const started = Date.now();
  const result = { model: model.id, case: scenario.id, phase, startedAt: new Date().toISOString() };
  try {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model.id, messages, max_tokens: maxOutputTokens, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(120000),
    });
    result.httpStatus = response.status;
    if (!response.ok) {
      result.error = `Provider returned HTTP ${response.status}`;
      if (response.status === 401 || response.status === 403) authenticationFailed = true;
    } else {
      const responseBody = await response.json();
      result.returnedModel = responseBody.model;
      result.finishReason = responseBody.choices?.[0]?.finish_reason;
      result.text = responseBody.choices?.[0]?.message?.content || '';
      result.usage = responseBody.usage;
      const usage = result.usage;
      result.estimatedCatalogCost = usage ? (usage.prompt_tokens * model.inputPrice + usage.completion_tokens * model.outputPrice) : null;
      try {
        result.value = JSON.parse(result.text);
        result.contractIssues = check(result.value);
        const evidence = messages.filter(m => m.role === 'user').map(m => m.content).join('\n').toLowerCase();
        for (const fact of result.value.known_facts || []) {
          if (!fact.source_quote || !evidence.includes(fact.source_quote.toLowerCase())) result.contractIssues.push(`untraced_fact:${fact.field}`);
        }
      } catch { result.contractIssues = ['invalid_json']; }
    }
  } catch (error) {
    result.error = error.name === 'TimeoutError' ? 'Provider timed out after 120 seconds' : 'Network or response error';
  }
  result.latencyMs = Date.now() - started;
  results.push(result);
  const name = `${model.id.replaceAll('/', '--')}.${scenario.id}.${phase}.json`;
  await fs.writeFile(path.join(output, name), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ model: model.id, case: scenario.id, phase, latencyMs: result.latencyMs, finish: result.finishReason, issues: result.contractIssues, error: result.error }));
  return result;
}

const queue = models.flatMap(model => cases.map(scenario => ({ model, scenario })));
async function worker() {
  while (queue.length && !authenticationFailed) {
    const { model, scenario } = queue.shift();
    const firstMessages = [{ role: 'system', content: system }, { role: 'user', content: scenario.initial }];
    const first = await call(model, scenario, 'initial', firstMessages);
    if (first.error || !first.value || authenticationFailed) continue;
    // Independent, identical informed checkpoint: do not let each model's prior
    // question change the evidence or create an incomparable synthetic dialogue.
    const informed = answer => [{ role: 'system', content: system }, { role: 'user', content: `${scenario.initial}\n\nAdditional user-provided facts:\n${answer}` }];
    await call(model, scenario, 'informed', informed(scenario.followup));
    for (const variant of scenario.variants || []) {
      if (authenticationFailed) break;
      await call(model, scenario, variant.id, informed(variant.answer));
    }
  }
}
await Promise.all([worker(), worker()]);
const successfulResponses = results.filter(r => r.value).length;
await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ ...metadata, completedAt: new Date().toISOString(), authenticationFailed, successfulResponses, results }, null, 2));
console.log(JSON.stringify({ attempts: results.length, successfulResponses, authenticationFailed, estimatedCatalogCost: successfulResponses ? results.reduce((n, r) => n + (r.estimatedCatalogCost || 0), 0) : null, output }));
if (successfulResponses === 0 || authenticationFailed) process.exitCode = 1;
