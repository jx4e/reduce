'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Stepper from '@/components/Stepper'

const STAGES = ['Parsing', 'Analyzing', 'Writing', 'Rendering']
const MOCK_GUIDE_ID = '1'

export default function GeneratePage() {
  const router = useRouter()
  const [currentStage, setCurrentStage] = useState(0)

  useEffect(() => {
    if (currentStage >= STAGES.length) {
      router.push(`/guide/${MOCK_GUIDE_ID}`)
      return
    }
    const timer = setTimeout(() => setCurrentStage(s => s + 1), 1500)
    return () => clearTimeout(timer)
  }, [currentStage, router])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Generating your guide…
      </p>
      <Stepper stages={STAGES} currentStage={Math.min(currentStage, STAGES.length - 1)} />
    </div>
  )
}
