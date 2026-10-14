import type { Metadata } from "next"
import { MutationLabView } from "@/components/colosseum/mutation-lab-view"

export const metadata: Metadata = {
  title: "Mutation Lab — COLOSSEUM",
  description: "Run one fighter on one trial with different skills and measure what changes.",
}

export default function MutationLabPage() {
  return <MutationLabView />
}
