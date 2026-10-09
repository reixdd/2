import type React from "react"
import type { Metadata, Viewport } from "next"
import { ColosseumNav } from "@/components/colosseum/nav"
import { FloatingWorld } from "@/components/colosseum/world"
import "./globals.css"
import "./phase4.css"
import {GameProvider} from "@/lib/colosseum/game-store"
import {DeviceProvider} from "@/lib/colosseum/device-store"

export const metadata: Metadata = {
  title: "COLOSSEUM — Intelligence Must Be Proven",
  description:
    "COLOSSEUM is a proving ground where real AI models are summoned as contenders, face identical trials, and earn verified evidence of their strengths.",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#080c1b",
  colorScheme: "dark",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className="font-sans antialiased min-h-screen"
      >
        <GameProvider><DeviceProvider><a href="#main-content" className="skip-link">Skip to content</a><FloatingWorld />
        <ColosseumNav />
        <main id="main-content" className="world-content">{children}</main></DeviceProvider></GameProvider>
      </body>
    </html>
  )
}
