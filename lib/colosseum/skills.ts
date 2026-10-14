export type SkillWing =
  | "Research & Knowledge"
  | "Mathematics & Reasoning"
  | "Programming & Development"
  | "Creativity & Media"
  | "Data Analysis"
  | "Planning & Automation"
  | "Blockchain & Crypto"
  | "Community"

export interface Skill {
  id: string
  name: string
  wing: SkillWing
  summary: string
  description: string
  source: string
  compatibleFamilies: string[] | "all"
  available: boolean
  unavailableReason?: string
  /** The literal instruction text appended to the system prompt when this skill is equipped. */
  instructionPrompt?: string
}

/**
 * The Skill Hall registry. Each entry is an honest description of what equipping the
 * skill actually does: available skills append real instruction text to the live system
 * prompt sent to the model (verifiable in the response), nothing more. Skills that would
 * require a tool, data feed, or runtime we have not wired up are marked unavailable with
 * the specific missing dependency — they do not silently pretend to work.
 */
export const SKILLS: Skill[] = [
  {
    id: "ledger-interpretation",
    name: "Ledger Interpretation",
    wing: "Blockchain & Crypto",
    summary: "Checks raw token amounts, mint identity, and the limits of holder claims.",
    description: "Adds instructions for interpreting supplied Solana RPC fields. It does not retrieve blockchain data, connect a wallet, or execute transactions.",
    source: "Solana official RPC field documentation",
    compatibleFamilies: "all",
    available: true,
    instructionPrompt: "For supplied Solana token RPC data, use integer raw amounts and decimals. Check mint identity and context slots before comparing supply and accounts. Token accounts are not unique holders; do not infer owner counts without owner fields. Separate documentation examples from captured chain observations. Never initiate a transaction.",
  },
  {
    id: "socratic-inquiry",
    name: "Socratic Inquiry",
    wing: "Research & Knowledge",
    summary: "Separates verified fact from assumption before any conclusion.",
    description:
      "Forces the contender to lay out what it actually knows, what it is assuming, and how confident it is in each claim before committing to an answer.",
    source: "Adapted from Anthropic's public Agent Skills patterns",
    compatibleFamilies: "all",
    available: true,
    instructionPrompt:
      "Before answering, explicitly separate what you know from what you are assuming, and state your confidence in each claim. Do not present an assumption as a verified fact.",
  },
  {
    id: "source-triangulation",
    name: "Source Triangulation",
    wing: "Research & Knowledge",
    summary: "Cross-checks claims against multiple independent sources.",
    description:
      "Would have the contender retrieve and compare several independent sources before answering a research question.",
    source: "MCP Registry — web-search server pattern",
    compatibleFamilies: "all",
    available: false,
    unavailableReason: "Requires a connected retrieval/browsing MCP server — not yet wired into this runtime.",
  },
  {
    id: "proof-scaffolding",
    name: "Proof Scaffolding",
    wing: "Mathematics & Reasoning",
    summary: "Structures reasoning as a formal, checkable proof.",
    description:
      "Requires the contender to state its givens, build intermediate lemmas, and justify each step explicitly before producing a final answer.",
    source: "Adapted from Anthropic's public Agent Skills patterns",
    compatibleFamilies: "all",
    available: true,
    instructionPrompt:
      "Structure your reasoning as a formal proof: state your givens, derive intermediate results one at a time, and justify each step before writing the final line.",
  },
  {
    id: "fermi-estimation",
    name: "Fermi Estimation",
    wing: "Mathematics & Reasoning",
    summary: "Sanity-checks magnitude before committing to a number.",
    description:
      "Encourages decomposing a problem into estimable factors and checking order of magnitude before finalizing a numeric answer.",
    source: "Classical Fermi-problem technique",
    compatibleFamilies: "all",
    available: true,
    instructionPrompt:
      "When a computation is non-trivial, decompose it into smaller estimable factors and sanity-check the order of magnitude before committing to a final answer.",
  },
  {
    id: "code-review-lens",
    name: "Code Review Lens",
    wing: "Programming & Development",
    summary: "Reads its own logic like a strict reviewer before shipping it.",
    description:
      "Has the contender enumerate edge cases, off-by-one risks, and failure modes in any logic or code it produces before finalizing it.",
    source: "Common open-source code-review agent conventions",
    compatibleFamilies: "all",
    available: true,
    instructionPrompt:
      "Think like a strict code reviewer: before finalizing any answer involving code or step-by-step logic, enumerate edge cases and off-by-one risks that could break it.",
  },
  {
    id: "sandboxed-execution",
    name: "Sandboxed Execution",
    wing: "Programming & Development",
    summary: "Would run generated code in an isolated sandbox to verify it.",
    description: "Would execute generated code in an isolated sandbox and feed the real output back into the trial.",
    source: "Hugging Face smolagents / LangGraph tool-node pattern",
    compatibleFamilies: "all",
    available: false,
    unavailableReason: "Requires an isolated code-execution sandbox — not yet connected to this runtime.",
  },
  {
    id: "narrative-voice",
    name: "Narrative Voice",
    wing: "Creativity & Media",
    summary: "Trades dry lists for a consistent in-world voice.",
    description: "Pushes the contender toward vivid, concrete imagery and a consistent narrative voice over dry bullet points.",
    source: "Community prompt-craft pattern",
    compatibleFamilies: "all",
    available: true,
    instructionPrompt:
      "Favor vivid, concrete imagery and a single consistent narrative voice. Present your reasoning as a brief in-world account rather than a dry list, while still ending with the required answer format.",
  },
  {
    id: "chart-interrogation",
    name: "Chart Interrogation",
    wing: "Data Analysis",
    summary: "Would read values and trends directly off a chart image.",
    description: "Would extract specific values and trends from a chart or graph image and reason about them quantitatively.",
    source: "Vision-model evaluation harness (planned)",
    compatibleFamilies: "all",
    available: false,
    unavailableReason:
      "Requires a vision-capable runner and a verified chart dataset — shares the same blocker as The Oracle's Eye trial.",
  },
  {
    id: "task-decomposition",
    name: "Task Decomposition",
    wing: "Planning & Automation",
    summary: "Plans the full checklist before executing a single step.",
    description: "Breaks a multi-step request into a numbered checklist first, then executes each step in order against that plan.",
    source: "Adapted from Anthropic's public Agent Skills patterns",
    compatibleFamilies: "all",
    available: true,
    instructionPrompt:
      "Break the task into a numbered checklist before doing anything else, then work through the checklist in order, referencing which step you are on.",
  },
  {
    id: "tool-orchestration",
    name: "Tool Orchestration",
    wing: "Planning & Automation",
    summary: "Would call real external tools mid-task.",
    description: "Would let the contender call real external tools or MCP servers mid-task and incorporate their actual output.",
    source: "Model Context Protocol (MCP) Registry",
    compatibleFamilies: "all",
    available: false,
    unavailableReason: "Requires a connected MCP tool server to actually invoke external actions — not yet wired in.",
  },
  {
    id: "on-chain-pattern-reading",
    name: "On-Chain Pattern Reading",
    wing: "Blockchain & Crypto",
    summary: "Would read live Solana market and wallet data.",
    description: "Would analyze live on-chain transaction flow and liquidity data for Solana tokens using a read-only market-data feed.",
    source: "GMGN read-only market-data API (planned)",
    compatibleFamilies: "all",
    available: false,
    unavailableReason: "Requires a connected GMGN or equivalent Solana data feed — no on-chain data source is wired in yet.",
  },
  {
    id: "community-submission",
    name: "Open Slot",
    wing: "Community",
    summary: "Reserved for the first community-contributed skill.",
    description:
      "COLOSSEUM is built to accept community-authored skills once the review and sandboxing pipeline is in place. This slot is a placeholder, not a shipped capability.",
    source: "Open for community pull requests",
    compatibleFamilies: "all",
    available: false,
    unavailableReason: "Community skill submissions are not open yet — review and sandboxing tooling is still being built.",
  },
]

export function getSkill(id: string | null | undefined) {
  if (!id) return undefined
  return SKILLS.find((s) => s.id === id)
}

export function skillsByWing() {
  const wings = new Map<SkillWing, Skill[]>()
  for (const skill of SKILLS) {
    const list = wings.get(skill.wing) ?? []
    list.push(skill)
    wings.set(skill.wing, list)
  }
  return wings
}
