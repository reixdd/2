import React, { useContext, useState } from 'react';
import { CharacterContext, Avatar, CapabilityRadar, Summoning } from '../characters.jsx';
import { StatusBadge, Empty } from '../components.jsx';

export default function Contenders({ contenders, selectedId, onSelect, onGenealogy }) {
  const { byId } = useContext(CharacterContext);
  const [summoning, setSummoning] = useState(null);
  const id = selectedId && byId[selectedId] ? selectedId : contenders.find((c) => byId[c.id]?.presentation.cast)?.id;
  const character = byId[id];
  const cast = Object.values(byId).filter((c) => c.presentation.cast && c.technical.kind === 'model');
  const families = [...new Map(cast.map((c) => [c.technical.family, c])).values()];
  const count = contenders.filter((c) => c.operational).length;
  return <div className="page character-page"><header className="page-head"><p className="eyebrow">THE SUMMONED</p><h1>Many worlds. One arena.</h1><p className="lede">{count} operational / {contenders.length} registered. Character lore tells a story. Completed trials supply the evidence.</p></header>
    <div className="cast-ribbon" aria-label="Character families">{families.map((c) => <button key={c.id} onClick={() => onSelect(c.id)} aria-pressed={id === c.id}><Avatar id={c.id} size={94} /><span>{c.presentation.characterName}</span><small>{c.technical.family}</small></button>)}</div>
    <div className="character-layout"><aside className="character-roster"><h2>Registry</h2>{contenders.map((c) => <button key={c.id} className={`character-row ${id === c.id ? 'selected' : ''}`} onClick={() => onSelect(c.id)}><Avatar id={c.id} size={40} /><span>{byId[c.id]?.presentation.characterName ?? c.name}<small>{c.name}</small></span><StatusBadge status={byId[c.id]?.status.label ?? c.state} /></button>)}</aside>
      {character ? <Profile character={character} onSummon={() => setSummoning(character)} onGenealogy={onGenealogy} /> : <Empty title="Loading character registry">The registry will appear when the API responds.</Empty>}
    </div>{summoning && <Summoning key={summoning.id} character={summoning} onClose={() => setSummoning(null)} />}</div>;
}
function Profile({ character: c, onSummon, onGenealogy }) {
  const { presentation: p, technical: t, status: s } = c;
  return <article className="character-profile" style={{ '--character-accent': p.visualTheme?.primary ?? '#6fe0f0' }}>
    <div className="profile-intro"><div className="profile-art">{p.originalArtworkUrl ? <img src={p.originalArtworkUrl} alt={`${p.characterName}, unofficial SVG concept placeholder`} /> : <Avatar id={c.id} size={180} />}<span className="art-caption">{p.cast ? 'Original SVG concept · replaceable artwork' : 'Uncast contender'}</span></div>
      <div className="profile-copy"><p className="eyebrow">FICTIONAL IDENTITY</p><h2>{p.characterName ?? p.displayName}</h2><p className="archetype">{p.archetype ?? 'A champion yet to be cast'}</p><p className="lore">{p.lore}</p><p className="muted">{p.disclaimer}</p>
        <div className="profile-actions"><button className="cta" onClick={onSummon}>Summon character</button><button className="ghost" onClick={onGenealogy}>Inspect lineage →</button></div><p className="muted">Summoning is optional presentation; it does not connect a model or earn a score.</p>
        <div className="profile-availability"><StatusBadge status={s.label} /><strong>{s.operational ? 'Model available for evaluation' : 'Model not operational'}</strong><p>{s.reason}</p></div>
      </div></div>
    <section className="technical-profile"><p className="eyebrow">TECHNICAL METADATA</p><h3>{p.displayName}</h3><dl className="identity-facts">
      <div><dt>Model identity</dt><dd>{t.modelId ?? 'Not assigned'}</dd></div><div><dt>Declared version</dt><dd>{t.modelVersion ?? 'Unknown'}</dd></div><div><dt>Provider</dt><dd>{t.provider ?? 'Not assigned'}</dd></div><div><dt>Catalog confirmation</dt><dd>{t.catalogConfirmed ? 'Confirmed available' : 'Not confirmed'}</dd></div>
      <div><dt>Evaluation coverage</dt><dd>{t.verificationStatus} · {t.evaluation.completed} completed · {t.evaluation.failed} failed</dd></div><div><dt>Config hash</dt><dd>{t.configHash}</dd></div><div><dt>Base model</dt><dd>{t.baseModelId ?? c.id}</dd></div><div><dt>Mutation parent</dt><dd>{t.mutationParentId ?? 'Original configuration'}</dd></div></dl>
      {t.sourceRepository && <a href={t.sourceRepository} target="_blank" rel="noreferrer">Declared model source ↗</a>}<p className="muted">Version and source are manifest declarations. Catalog availability is checked separately.</p><details><summary>Inspect exact configuration</summary><pre>{JSON.stringify(t.configuration, null, 2)}</pre></details>
    </section><section className="profile-capabilities"><h3>Capabilities, proven in the arena</h3><p className="muted">Results for this configuration only. An untested axis stays empty. No universal intelligence score.</p><CapabilityRadar values={t.testedCapabilities} /></section>
  </article>;
}
