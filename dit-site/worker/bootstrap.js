// Idempotent bootstrap: agents, profiles, sources, zeroed vote counts. Never resets existing state (votes, memories, state are untouched).
import { createHash } from 'node:crypto';
import { AGENTS, AGENT_IDS } from '../server/lib/agents.js';
import { sourceRows } from './sources.js';
export const PROMPT_VERSION = '2026-10-13.1';
export async function bootstrap(store) {
  for (const id of AGENT_IDS) {
    const a = AGENTS[id];
    await store.upsert('agents', { id, title: a.title, tagline: a.tagline, specialty: a.specialty }, { onConflict: 'id', ignoreDuplicates: true });
    await store.upsert('agents', { id, title: a.title, tagline: a.tagline, specialty: a.specialty }, { onConflict: 'id', ignoreDuplicates: false }).catch(() => {});   // refresh copy; state columns are not in the payload
    await store.upsert('agent_profiles', { agent_id: id, personality: a.personality, voice_line: a.voiceLine, memory_focus: a.memoryFocus, portrait: a.portrait, prompt_version: PROMPT_VERSION, prompt_sha256: createHash('sha256').update(a.systemPrompt).digest('hex'), config: { sources: a.sources, categoryWeights: a.categoryWeights, rubric: a.rubric, minScore: a.minScore } }, { onConflict: 'agent_id' });
    await store.upsert('agent_vote_counts', { agent_id: id, votes: 0 }, { onConflict: 'agent_id', ignoreDuplicates: true });
  }
  await store.upsert('research_sources', sourceRows(), { onConflict: 'id', ignoreDuplicates: true });
}
