import type { Metadata } from "next"
import "./globals.scss"

export const metadata: Metadata = {
  title: "AI OFM Studio",
  description: "Personal Gemini image generation studio with profile history.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='ru'>
      <body>{children}</body>
    </html>
  )
}
