import type { Metadata } from "next"
import { LineageView } from "@/components/colosseum/lineage-view"

export const metadata: Metadata = {
  title: "Lineage — COLOSSEUM",
  description: "Model families behind each contender and their measured trial record.",
}

export default function LineagePage() {
  return <LineageView />
}
