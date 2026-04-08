'use client'

interface StepperProps {
  stages: string[]
  currentStage: number
}

export default function Stepper({ stages, currentStage }: StepperProps) {
  return (
    <div className="flex items-center gap-0">
      {stages.map((label, i) => {
        const isComplete = i < currentStage
        const isActive = i === currentStage

        return (
          <div key={label} className="flex items-center">
            {/* Connector line (before each stage except the first) */}
            {i > 0 && (
              <div
                className="h-px w-12 transition-colors duration-500"
                style={{ background: isComplete ? 'var(--accent)' : 'var(--border)' }}
              />
            )}

            {/* Stage circle + label */}
            <div className="flex flex-col items-center gap-2">
              <div
                data-testid={`stage-${i}`}
                data-active={isActive ? 'true' : 'false'}
                data-complete={isComplete ? 'true' : 'false'}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500 text-sm font-semibold"
                style={{
                  borderColor: isComplete || isActive ? 'var(--accent)' : 'var(--border)',
                  background: isComplete ? 'var(--accent)' : isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: isComplete ? '#fff' : isActive ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {isComplete ? '✓' : i + 1}
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: isActive ? 'var(--accent)' : isComplete ? 'var(--foreground)' : 'var(--muted)' }}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
