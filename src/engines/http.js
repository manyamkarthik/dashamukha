// HTTP providers: the Anthropic Messages API and any OpenAI-compatible
// /chat/completions endpoint (OpenAI, OpenRouter, Groq, Together, Ollama,
// LM Studio, vLLM, a LiteLLM proxy, ...).
import { readSSE, httpError } from './sse.js';

export async function runAnthropic({ provider = {}, model, system, prompt, signal, onDelta }) {
  const keyVar = provider.apiKeyEnv || 'ANTHROPIC_API_KEY';
  const apiKey = process.env[keyVar];
  if (!apiKey) throw new Error(`Anthropic API key missing: set the ${keyVar} environment variable.`);
  if (!model) throw new Error('Set a model for the Anthropic engine in dashamukha.config.json.');
  const base = (provider.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: provider.maxTokens || 1200, system, stream: true, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw await httpError(res, 'Anthropic API');
  let text = '';
  for await (const { data } of readSSE(res.body)) {
    let msg;
    try { msg = JSON.parse(data); } catch { continue; }
    if (msg.type === 'content_block_delta' && msg.delta?.type === 'text_delta') { text += msg.delta.text; onDelta?.(msg.delta.text); }
    if (msg.type === 'error') throw new Error(`Anthropic API: ${msg.error?.message || 'stream error'}`);
  }
  return text;
}

export async function runOpenAICompatible({ provider = {}, model, system, prompt, signal, onDelta }) {
  const base = (provider.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const keyVar = provider.apiKeyEnv || (base.includes('api.openai.com') ? 'OPENAI_API_KEY' : '');
  const apiKey = keyVar ? process.env[keyVar] : '';
  if (keyVar && !apiKey) throw new Error(`API key missing: set the ${keyVar} environment variable.`);
  if (!model) throw new Error(`Set a model for the engine at ${base} in dashamukha.config.json.`);
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST', signal, headers,
    body: JSON.stringify({ model, stream: true, ...(provider.maxTokens ? { max_tokens: provider.maxTokens } : {}), messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw await httpError(res, provider.label || base);
  let text = '';
  for await (const { data } of readSSE(res.body)) {
    if (data === '[DONE]') break;
    let msg;
    try { msg = JSON.parse(data); } catch { continue; }
    if (msg.error) throw new Error(`${provider.label || base}: ${msg.error.message || 'stream error'}`);
    const delta = msg.choices?.[0]?.delta?.content;
    if (delta) { text += delta; onDelta?.(delta); }
  }
  return text;
}
