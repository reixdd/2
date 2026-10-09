/** Client-safe constants for free public mode. Nothing in this file may read secrets. */

export const LIVE_INFERENCE_ENV = "COLOSSEUM_LIVE_INFERENCE"
export const ADMIN_TOKEN_ENV = "COLOSSEUM_ADMIN_TOKEN"
export const ADMIN_HEADER = "x-colosseum-admin"

/** The only value that turns live inference on. Anything else, including unset, keeps the site free. */
export const LIVE_INFERENCE_ENABLED_VALUE = "enabled"
export const MIN_ADMIN_TOKEN_LENGTH = 24

export interface PublicMode {
  /** True only when live inference is switched on AND an admin credential is configured server-side. */
  live: boolean
}

export const FREE_MODE_DEFAULT: PublicMode = { live: false }

export const FREE_MODE_MESSAGE =
  "Live model requests are disabled in free public mode. Recorded trials and the interactive tutorial remain available."

export const RECORDED_TRIAL_LABEL = "RECORDED TRIAL — NO LIVE MODEL REQUEST"
export const TUTORIAL_LABEL = "INTERACTIVE TUTORIAL — NOT AN AI MODEL RUN"
export const NOT_YET_TESTED_LABEL = "NOT YET TESTED"
