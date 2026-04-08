import { render, screen } from '@testing-library/react'
import Stepper from '@/components/Stepper'

const STAGES = ['Parsing', 'Analyzing', 'Writing', 'Rendering']

describe('Stepper', () => {
  it('renders all stage labels', () => {
    render(<Stepper stages={STAGES} currentStage={0} />)
    STAGES.forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('marks the current stage as active', () => {
    render(<Stepper stages={STAGES} currentStage={1} />)
    const active = screen.getByTestId('stage-1')
    expect(active).toHaveAttribute('data-active', 'true')
  })

  it('marks previous stages as complete', () => {
    render(<Stepper stages={STAGES} currentStage={2} />)
    expect(screen.getByTestId('stage-0')).toHaveAttribute('data-complete', 'true')
    expect(screen.getByTestId('stage-1')).toHaveAttribute('data-complete', 'true')
  })
})
