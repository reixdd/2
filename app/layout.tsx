import type React from "react"
import type { Metadata, Viewport } from "next"
import { ColosseumNav } from "@/components/colosseum/nav"
import { FloatingWorld } from "@/components/colosseum/world"
import "./globals.css"

export const metadata: Metadata = {
  title: "COLOSSEUM — Intelligence Must Be Proven",
  description:
    "COLOSSEUM is a proving ground where real AI models are summoned as contenders, face identical trials, and earn verified evidence of their strengths.",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#f4fafd",
  colorScheme: "light",
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
        <FloatingWorld />
        <ColosseumNav />
        <main className="world-content">{children}</main>
      </body>
    </html>
  )
}
