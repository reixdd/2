import dataset from "@/data/public-trials.json"
import { loadPublicTrials } from "./public-trials"

/** Validated once at module load. Records that fail validation are excluded, never displayed. */
export const PUBLIC_DATA = loadPublicTrials(dataset)
