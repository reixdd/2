// Trend Classifier (rule-based) + clustering. Honest label: classifier='rules'. LLM classification is intentionally NOT used here
// so categories are reproducible and cheap; the LLM is reserved for creative generation.
import { CATEGORIES } from '../server/lib/agents.js';
const KW = {
  forgotten_web: ['geocities', 'myspace', 'forum', 'usenet', 'bbs', 'flash', 'webring', 'dial-up', 'aol', 'napster', 'limewire', 'angelfire', 'defunct', 'shutdown', 'discontinued', 'archive', 'nostalgia', 'abandoned', 'obsolete', 'early web', 'web 1.0'],
  folklore: ['creepypasta', 'urban legend', 'myth', 'legend', 'haunted', 'cursed', 'lost episode', 'ghost', 'folklore', 'ritual', 'rumor', 'mystery', 'unsolved', 'liminal', 'backrooms'],
  market_anomaly: ['volume', 'spike', 'liquidity', 'surge', 'anomaly', 'boost', 'pump', 'tps', 'throughput', 'whale', 'volatility', 'listing'],
  early_pattern: ['emerging', 'first', 'new', 'launch', 'trending', 'rising', 'debut', 'beta', 'prototype', 'announce', 'released'],
  viral_humor: ['meme', 'joke', 'funny', 'lol', 'viral', 'parody', 'shitpost', 'humor', 'comedy', 'cat', 'dog', 'frog', 'goat', 'cursed image', 'reaction'],
  remix: ['remix', 'mashup', 'cover', 'edit', 'fan', 'reboot', 'parody', 'template', 'format', 'sample', 'ai-generated', 'fanart'],
  attention_cycle: ['trend', 'hype', 'cycle', 'viral', 'engagement', 'followers', 'views', 'streamer', 'tiktok', 'twitter', 'influencer', 'outrage', 'discourse']
};
const STOP = new Set('the a an and or of to in on for with from by at is are was were be been this that these those it its as into over after before about how why what who when new says said will can could would not no you your our their his her they them just more most than then also have has had out up one two top best vs via'.split(' '));

export const tokens = s => (String(s).toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || []).filter(t => !STOP.has(t));
export function classify(title, hintCategory) {
  const text = ' ' + String(title).toLowerCase() + ' '; let best = 'general', bestHits = 0;
  for (const c of CATEGORIES) { const hits = (KW[c] || []).filter(k => text.includes(k)).length; if (hits > bestHits) { best = c; bestHits = hits; } }
  if (!bestHits && hintCategory) return { category: hintCategory, confidence: 0.3, classifier: 'rules' };
  return { category: best, confidence: bestHits ? Math.min(0.85, 0.4 + 0.15 * bestHits) : 0.2, classifier: 'rules' };
}
// Source kind gives a weak prior when no keyword matches (market sources lean market_anomaly, culture sources lean forgotten_web ...).
export const KIND_HINT = { market: 'market_anomaly', chain: 'market_anomaly', culture: 'forgotten_web', social: 'attention_cycle' };

export function clusterKey(title) {
  const freq = new Map(); for (const t of tokens(title)) freq.set(t, (freq.get(t) || 0) + 1);
  const top = [...freq.keys()].sort((a, b) => b.length - a.length || a.localeCompare(b)).slice(0, 2).sort(); return top.join('-') || 'misc';
}
export const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); };
