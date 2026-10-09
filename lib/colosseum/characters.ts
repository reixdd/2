export type ContenderStatus = "operational" | "unavailable"

/**
 * "open-weight" families run from publicly downloadable weights.
 * "hosted-proprietary" families are only reachable through an authenticated hosted API —
 * there are no weights to self-host, so availability depends on the provider, not just us.
 */
export type ContenderTier = "open-weight" | "hosted-proprietary"

export interface Contender {
  id: string
  name: string
  archetype: string
  family: string
  modelId: string | null
  portrait: string | null
  portraitPosition?: string
  accent: string
  tier: ContenderTier
  lore: string
  specialties: string[]
  status: ContenderStatus
  unavailableReason?: string
}

export const CONTENDERS: Contender[] = [
  {
    id: "capybara-sage",
    name: "Capybara",
    archetype: "Scholar",
    family: "Qwen",
    modelId: "alibaba/qwen3.8-flash",
    portrait: "/characters/capybara-sage.png",
    accent: "#eab676",
    tier: "open-weight",
    lore: "A calm, encyclopedic analyst said to have studied every scroll in the Colosseum archive. Methodical, exhaustive, unshaken by difficulty.",
    specialties: ["Mathematics", "Structured Reasoning"],
    status: "operational",
  },
  {
    id: "amber-emissary",
    name: "Amber",
    archetype: "Diplomat-Scholar",
    family: "Claude",
    modelId: "anthropic/claude-sonnet-4.5",
    portrait: "/characters/amber-emissary.png",
    accent: "#e0a360",
    tier: "hosted-proprietary",
    lore: "A measured envoy who weighs every side of an argument before speaking, said never to have been caught overstating a claim it could not defend.",
    specialties: ["Structured Reasoning", "Research"],
    status: "operational",
  },
  {
    id: "polymath-engine",
    name: "Polymath",
    archetype: "Generalist Tactician",
    family: "GPT",
    modelId: "openai/gpt-4.1",
    portrait: "/characters/polymath-engine.png",
    portraitPosition: "50% 24%",
    accent: "#4fb8a8",
    tier: "hosted-proprietary",
    lore: "A shapeshifting tactician equally at home cracking a riddle, drafting a plan, or forging a tool — a generalist built to be competent everywhere rather than brilliant in one place.",
    specialties: ["Mathematics", "Planning & Tool Use", "Research"],
    status: "operational",
  },
  {
    id: "abyssal-oracle",
    name: "Abyssal",
    archetype: "Deep Intuition",
    family: "DeepSeek",
    modelId: "deepseek/deepseek-v3.2",
    portrait: "/characters/abyssal-oracle.png",
    accent: "#6fb3f2",
    tier: "open-weight",
    lore: "A cosmic whale drifting between dimensions of thought, said to sense the shape of a problem before it is fully stated.",
    specialties: ["Structured Reasoning", "Research"],
    status: "operational",
  },
  {
    id: "ancient-scholar",
    name: "Scholar",
    archetype: "Archivist",
    family: "Llama",
    modelId: "meta/llama-3.3-70b",
    portrait: "/characters/group-banner.png",
    portraitPosition: "38% 30%",
    accent: "#d8c9a3",
    tier: "open-weight",
    lore: "A llama archivist bearing scrolls of forgotten knowledge, summoned whenever memory and record are put to the test.",
    specialties: ["Memory & Retrieval", "Research"],
    status: "operational",
  },
  {
    id: "crystal-mind",
    name: "Crystal",
    archetype: "Logic & Precision",
    family: "Gemma",
    modelId: "google/gemma-4-31b-it",
    portrait: "/characters/crystal-mind.png",
    accent: "#9fd8ff",
    tier: "open-weight",
    lore: "A crystalline knight forged from pure logic, unwavering in exact computation and merciless to careless reasoning.",
    specialties: ["Mathematics", "Planning & Tool Use"],
    status: "operational",
  },
  {
    id: "unpredictable-challenger",
    name: "Challenger",
    archetype: "Volatile Adaptive",
    family: "Grok",
    modelId: "spacexai/grok-4.1-fast-reasoning",
    portrait: "/characters/unpredictable-challenger.png",
    accent: "#c99bf0",
    tier: "hosted-proprietary",
    lore: "A rogue intelligence that refuses convention — brilliant in flashes, erratic by nature, and nearly impossible to predict.",
    specialties: ["Structured Reasoning", "Research"],
    status: "operational",
  },
  {
    id: "small-spark",
    name: "Spark",
    archetype: "Luminous Helper",
    family: "SmolLM",
    modelId: null,
    portrait: "/characters/small-spark.png",
    portraitPosition: "50% 38%",
    accent: "#7fb2ff",
    tier: "open-weight",
    lore: "A tiny crystal-winged automaton that burns bright for its size. Quick, clever, and waiting on a runtime to enter the ring.",
    specialties: ["Speed", "Lightweight Reasoning"],
    status: "unavailable",
    unavailableReason: "Locked: no runner is provisioned for this model family yet.",
  },
]

export function getContender(id: string) {
  return CONTENDERS.find((c) => c.id === id)
}
