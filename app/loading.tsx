export default function Loading() {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'var(--background)' }}
    >
      <span
        className="text-2xl font-bold tracking-tight"
        style={{ color: 'var(--foreground)', animation: 'loading-pulse 1.2s ease-in-out infinite' }}
      >
        tldr.
      </span>
    </div>
  )
}
