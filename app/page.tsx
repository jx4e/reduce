import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import LandingDemo from '@/components/LandingDemo'

export default async function LandingPage() {
  const session = await auth()
  if (session) redirect('/app')

  return (
    <div className="flex flex-1 flex-col">

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-16">
        <div
          className="text-xs font-semibold tracking-widest uppercase mb-5"
          style={{ color: 'var(--accent)' }}
        >
          AI study guides
        </div>
        <h1 className="text-5xl font-bold tracking-tight leading-tight mb-5 max-w-xl">
          upload your notes.<br />
          <span style={{ color: 'var(--accent)' }}>get the tldr.</span>
        </h1>
        <p className="text-base mb-9 max-w-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Drop in your lecture notes, slides, or PDFs — get a structured,
          interactive study guide back in seconds.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/register"
            className="rounded-full px-6 py-2.5 text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Start studying free →
          </Link>
          <a
            href="#demo"
            className="text-sm"
            style={{ color: 'var(--muted)' }}
          >
            See how it works ↓
          </a>
        </div>
        <p className="mt-5 text-xs" style={{ color: 'var(--muted-dark)' }}>
          No credit card. Works with PDFs, slides, and plain text.
        </p>
      </section>

      {/* Demo */}
      <div id="demo">
        <LandingDemo />
      </div>

      {/* Features */}
      <section className="py-16 px-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-full max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div
              className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: 'var(--accent)' }}
            >
              How it works
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Three steps to a better study session.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                emoji: '📄',
                title: 'Upload your material',
                body: 'PDFs, slides, lecture notes, or plain text. Any format, any subject.',
              },
              {
                emoji: '✨',
                title: 'Get a structured guide',
                body: 'AI breaks it into sections with explanations, formulas, code blocks, and timelines.',
              },
              {
                emoji: '💬',
                title: 'Ask about anything',
                body: 'Right-click any section and ask questions. The AI explains using your own material.',
              },
            ].map(({ emoji, title, body }) => (
              <div
                key={title}
                className="rounded-xl border p-6"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <div className="text-2xl mb-4">{emoji}</div>
                <div className="text-sm font-bold mb-2">{title}</div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-4">
          ready to study smarter?
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Free to get started. No credit card required.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-full px-7 py-3 text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Create your first guide →
          </Link>
          <Link href="/login" className="text-sm" style={{ color: 'var(--muted)' }}>
            Sign in
          </Link>
        </div>
      </section>

    </div>
  )
}
