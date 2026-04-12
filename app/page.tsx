import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import LandingDemo from '@/components/LandingDemo'
import { HeroItem, FadeUp } from '@/components/LandingAnimations'

export default async function LandingPage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <div className="flex flex-1 flex-col">

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-20" style={{ borderBottom: '1px solid var(--border)' }}>

        <HeroItem delay={0}>
          <div
            className="text-xs font-semibold tracking-widest uppercase mb-8"
            style={{ color: 'var(--muted)' }}
          >
            tl;dr
          </div>
        </HeroItem>

        <HeroItem delay={0.1}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(42px, 7vw, 76px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '1.25rem', maxWidth: '680px' }}>
            study less.<br />
            <em>remember more.</em>
          </h1>
        </HeroItem>

        <HeroItem delay={0.2}>
          <p style={{ fontSize: 17, color: 'var(--muted)', maxWidth: 400, lineHeight: 1.65, marginBottom: '2.25rem' }}>
            AI turns your lecture notes into a structured guide
            you&apos;ll actually read.
          </p>
        </HeroItem>

        <HeroItem delay={0.3}>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Link
              href="/register"
              className="px-6 py-2.5 text-sm font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--background)', borderRadius: 3 }}
            >
              Start studying free →
            </Link>
            <a href="#demo" className="text-sm" style={{ color: 'var(--muted)' }}>
              See how it works ↓
            </a>
          </div>
        </HeroItem>

        <HeroItem delay={0.4}>
          <p className="mt-5 text-xs" style={{ color: 'var(--muted-dark)' }}>
            No credit card. Works with PDFs, slides, and plain text.
          </p>
        </HeroItem>
      </section>

      {/* ── Demo ────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(to bottom, var(--background), var(--surface))', borderTop: '1px solid var(--border)' }}>
        <FadeUp>
          <div id="demo">
            <LandingDemo />
          </div>
        </FadeUp>
      </div>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '72px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <FadeUp className="text-center" style={{ marginBottom: 48 }}>
            <div className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--accent)' }}>
              How it works
            </div>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Three steps to a better study session.
            </h2>
          </FadeUp>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {[
              {
                num: '01',
                title: 'Upload your material',
                body: 'PDFs, slides, lecture notes, or plain text. Any format, any subject.',
              },
              {
                num: '02',
                title: 'Get a structured guide',
                body: 'AI breaks it into sections with explanations, formulas, code blocks, and timelines.',
              },
              {
                num: '03',
                title: 'Ask about anything',
                body: 'Right-click any section and ask questions. The AI explains using your own material.',
              },
            ].map(({ num, title, body }, i) => (
              <FadeUp
                key={title}
                delay={i * 0.1}
                style={{ background: 'var(--background)', padding: '24px 20px' }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted-dark)', marginBottom: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                  {num}
                </div>
                <div className="text-sm font-bold mb-2">{title}</div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{body}</div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--accent)', padding: '88px 24px', textAlign: 'center' }}>
        <FadeUp>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--background)' }}>
            ready to study smarter?
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--muted-dark)' }}>
            Free to get started. No credit card required.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="px-7 py-3 text-sm font-semibold"
              style={{ background: 'var(--background)', color: 'var(--accent)', borderRadius: 3 }}
            >
              Create your first guide →
            </Link>
            <Link href="/login" className="text-sm" style={{ color: 'var(--muted-dark)' }}>
              Sign in
            </Link>
          </div>
        </FadeUp>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer
        className="px-6 py-7 flex items-center justify-between text-xs"
        style={{ borderTop: '1px solid var(--border)', color: 'var(--muted-dark)' }}
      >
        <span>© {new Date().getFullYear()} tldr.</span>
        <div className="flex items-center gap-5">
          <Link href="/login" style={{ color: 'var(--muted-dark)' }}>Sign in</Link>
          <Link href="/register" style={{ color: 'var(--muted-dark)' }}>Get started</Link>
        </div>
      </footer>

    </div>
  )
}
