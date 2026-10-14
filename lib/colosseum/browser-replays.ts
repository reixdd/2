import captures from '@/data/browser-verified-captures.json'
import {validateLocalEvidence} from './battle-evidence'
/** Owner-curated genuine release captures; these do not initialize a visitor's device. */
export const BROWSER_REPLAYS=captures.records.map(validateLocalEvidence)
