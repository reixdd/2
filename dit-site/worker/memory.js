// Per-agent long-term memory: write, retrieve (persona-weighted), consolidate. Memories are never shared between agents.
import { tokens } from './classify.js';
const DAY = 86400_000;

export async function remember(store, agentId, { kind, content, summary, tags = [], importance = 0.5, refs = [], jobId = null }) {
  return store.insert('agent_memories', { agent_id: agentId, kind, content: content.slice(0, 4000), summary: summary.slice(0, 400), tags, importance: Math.min(1, Math.max(0, importance)), source_refs: refs, job_id: jobId });
}
export function scoreMemory(persona, mem, terms, now) {
  const w = persona.memoryWeights; const mt = new Set(tokens(mem.summary + ' ' + mem.content + ' ' + (mem.tags || []).join(' ')));
  const overlap = terms.length ? terms.filter(t => mt.has(t)).length / terms.length : 0;
  const tagBoost = Math.max(1, ...(mem.tags || []).map(t => w.tags[t] || 1));
  const ageDays = Math.max(0, (now - Date.parse(mem.created_at)) / DAY);
  const recency = Math.pow(0.5, ageDays / w.recencyHalfLifeDays);
  return (0.15 + overlap) * (w.kinds[mem.kind] ?? 1) * tagBoost * (0.4 + mem.importance) * (0.3 + 0.7 * recency);
}
export async function recall(store, persona, terms, { k = 5, now = Date.now() } = {}) {
  const pool = await store.select('agent_memories', { filters: [['agent_id', 'eq', persona.id]], order: ['created_at', 'desc'], limit: 300 });
  const top = pool.map(m => ({ m, s: scoreMemory(persona, m, terms, now) })).sort((a, b) => b.s - a.s || (a.m.id > b.m.id ? 1 : -1)).slice(0, k).map(x => x.m);
  for (const m of top) await store.update('agent_memories', [['id', 'eq', m.id]], { recall_count: m.recall_count + 1, last_recalled_at: new Date(now).toISOString() });
  return top;
}
// Memory Curator: when episodic memories pile up, write ONE semantic digest of the oldest undigested batch. Originals are kept (audit trail).
export async function consolidate(store, persona, { llm, signal, batch = 20, threshold = 40, jobId = null } = {}) {
  const all = await store.select('agent_memories', { filters: [['agent_id', 'eq', persona.id]], order: ['created_at', 'asc'] });
  const digested = new Set(all.filter(m => m.kind === 'semantic').flatMap(m => (m.source_refs || []).filter(r => r.type === 'memory').map(r => r.id)));
  const pending = all.filter(m => m.kind === 'episodic' && !digested.has(m.id));
  if (pending.length < threshold) return { digested: 0, usage: null };
  const group = pending.slice(0, batch); let content, method = 'extractive', usage = null;
  if (llm?.configured) {
    try { const r = await llm.complete({ agentId: persona.id, system: persona.systemPrompt + ' Summarise your own memories into durable lessons. Reply as JSON {"digest":"..."}.', user: JSON.stringify(group.map(m => m.summary)), temperature: 0.2, maxTokens: 500, signal });
      content = JSON.parse(r.text.slice(r.text.indexOf('{'), r.text.lastIndexOf('}') + 1)).digest; method = 'llm'; usage = r.usage; } catch { content = null; }
  }
  content ||= group.map(m => '- ' + m.summary).join('\n');
  await remember(store, persona.id, { kind: 'semantic', content: String(content).slice(0, 3000), summary: `Digest of ${group.length} earlier experiments (${method})`, tags: ['digest', ...Object.keys(persona.memoryWeights.tags).slice(0, 1)], importance: 0.7, refs: group.map(m => ({ type: 'memory', id: m.id })), jobId });
  return { digested: group.length, usage };
}
