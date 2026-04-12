import type { Metadata } from 'next'
import { Geist, Geist_Mono, Playfair_Display } from 'next/font/google'
import Navbar from '@/components/Navbar'
import NavigationLoader from '@/components/NavigationLoader'
import './globals.css'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark-dimmed.min.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const playfairDisplay = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'tldr. — AI study guides',
  description:
    'Upload your lecture notes, slides, or PDFs and get a structured, interactive study guide back.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <NavigationLoader />
        <Navbar />
        <main className="flex flex-1 flex-col min-h-0">{children}</main>
      </body>
    </html>
  )
}
