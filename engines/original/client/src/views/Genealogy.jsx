import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Avatar } from '../characters.jsx';
import { StatusBadge } from '../components.jsx';
export default function Genealogy({ onSelect, refreshKey }) {
  const [nodes, setNodes] = useState([]), [error, setError] = useState(null);
  useEffect(() => { api('/genealogy').then((r) => setNodes(r.nodes)).catch((e) => setError(e.message)); }, [refreshKey]);
  function branch(node, trail = []) {
    if (trail.includes(node.id)) return null;
    const children = nodes.filter((n) => n.parentId === node.id);
    return <li key={node.id}><article className="lineage-node"><button onClick={() => onSelect(node.id)}><Avatar id={node.id} size={58} /><span><strong>{node.characterName ?? node.name}</strong><small>{node.name}</small></span><StatusBadge status={node.label} /></button>{node.diffFromParent && <details><summary>Configuration changes from parent</summary><pre>{JSON.stringify(node.diffFromParent, null, 2)}</pre><p className="muted">Inherited visual traits: {node.inheritedTraits.join(', ') || 'none declared'}</p></details>}</article>{children.length > 0 && <ul>{children.map((c) => branch(c, [...trail, node.id]))}</ul>}</li>;
  }
  return <div className="page"><header className="page-head"><p className="eyebrow">THE MUTATION TREE</p><h1>Same origin. Different paths.</h1><p className="lede">Follow model ancestry and inspect what changed. Specialization is a configuration, not a claim of improved performance.</p></header>{error && <p role="alert" className="err">{error}</p>}<ul className="genealogy-tree">{nodes.filter((n) => !n.parentId).map((n) => branch(n))}</ul></div>;
}
