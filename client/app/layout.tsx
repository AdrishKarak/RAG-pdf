import type { Metadata } from 'next'
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { Sparkles } from 'lucide-react'
import './globals.css'

export const metadata: Metadata = {
  title: 'PDF RAG Chat',
  description: 'Chat with uploaded PDF documents',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-700 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              PDF RAG
            </div>
            <div className="flex items-center gap-3">
              <Show when="signed-out">
                <SignInButton />
                <SignUpButton>
                  <button className="h-9 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-[background-color,transform] duration-150 ease-out active:scale-[0.98]">
                    Sign Up
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
