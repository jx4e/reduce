import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import LandingDemo from '@/components/LandingDemo'
import { HeroItem, FadeUp } from '@/components/LandingAnimations'

export default async function LandingPage() {
  const session = await auth()
  if (session) redirect('/app')

  return (
    <div className="flex flex-1 flex-col">

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center text-center px-6 pt-24 pb-20 overflow-hidden">

        {/* Blurred colour orbs */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 20%, transparent), transparent 70%)', filter: 'blur(40px)' }} />
          <div style={{ position: 'absolute', top: '20%', left: '15%', width: 320, height: 320, background: 'radial-gradient(ellipse at center, color-mix(in srgb, #8b5cf6 14%, transparent), transparent 70%)', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', top: '10%', right: '10%', width: 280, height: 280, background: 'radial-gradient(ellipse at center, color-mix(in srgb, #06b6d4 10%, transparent), transparent 70%)', filter: 'blur(60px)' }} />
        </div>

        {/* Dot grid overlay */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--foreground) 8%, transparent) 1px, transparent 1px)', backgroundSize: '28px 28px', maskImage: 'radial-gradient(ellipse 80% 80% at 50% 0%, black 40%, transparent 100%)' }} />

        <HeroItem delay={0}>
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide mb-8"
            style={{ borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            AI study guides
          </span>
        </HeroItem>

        <HeroItem delay={0.1}>
          <h1 style={{ fontSize: 'clamp(42px, 7vw, 76px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.04em', marginBottom: '1.25rem', maxWidth: '680px' }}>
            upload your notes.<br />
            <span style={{ background: 'linear-gradient(135deg, var(--accent), #8b5cf6 50%, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              get the tldr.
            </span>
          </h1>
        </HeroItem>

        <HeroItem delay={0.2}>
          <p style={{ fontSize: 17, color: 'var(--muted)', maxWidth: 400, lineHeight: 1.65, marginBottom: '2.25rem' }}>
            Drop in your lecture notes, slides, or PDFs — get a structured,
            interactive study guide back in seconds.
          </p>
        </HeroItem>

        <HeroItem delay={0.3}>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Link
              href="/register"
              className="rounded-full px-6 py-2.5 text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 0 24px color-mix(in srgb, var(--accent) 50%, transparent)' }}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                className="rounded-xl p-6"
                style={{
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Subtle top-edge accent line */}
                <div style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 1, background: 'linear-gradient(to right, transparent, var(--accent), transparent)', opacity: 0.6 }} />
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: 12, fontFamily: 'var(--font-mono, monospace)' }}>
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
      <section style={{ position: 'relative', padding: '88px 24px', textAlign: 'center', overflow: 'hidden' }}>
        {/* Background gradient */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 70% at 50% 100%, color-mix(in srgb, var(--accent) 10%, transparent), transparent)', pointerEvents: 'none' }} />

        <FadeUp>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>
            ready to study smarter?
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
            Free to get started. No credit card required.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="rounded-full px-7 py-3 text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 0 32px color-mix(in srgb, var(--accent) 45%, transparent)' }}
            >
              Create your first guide →
            </Link>
            <Link href="/login" className="text-sm" style={{ color: 'var(--muted)' }}>
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
