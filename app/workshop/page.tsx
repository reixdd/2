import type { Metadata } from "next"
import { WorkshopView } from "@/components/colosseum/workshop-view"

export const metadata: Metadata = {
  title: "Workshop — COLOSSEUM",
  description: "Equip a skill on any fighter and measure its real effect, live, against a baseline run.",
}

export default function WorkshopPage() {
  return <WorkshopView />
}
