import type { Metadata } from "next"
import { Space_Grotesk, JetBrains_Mono } from "next/font/google"
import { Providers } from "@/components/providers"
import { cn } from "@/lib/utils"
import "./globals.css"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-face",
})

export const metadata: Metadata = {
  title: "Writr",
  description: "Local author workspace for notes, drafts, and agents",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={cn(
        "h-full overflow-hidden antialiased font-sans",
        spaceGrotesk.variable,
        jetbrainsMono.variable
      )}
    >
      <body className="flex h-full max-h-full flex-col overflow-hidden bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
