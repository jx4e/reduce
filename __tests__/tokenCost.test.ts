import { computeCostUsd } from '@/lib/tokenCost'

describe('computeCostUsd', () => {
  it('returns 0 for zero tokens', () => {
    expect(computeCostUsd(0, 0)).toBe(0)
  })

  it('calculates input token cost at $3 per million', () => {
    expect(computeCostUsd(1_000_000, 0)).toBeCloseTo(3.0, 6)
  })

  it('calculates output token cost at $15 per million', () => {
    expect(computeCostUsd(0, 1_000_000)).toBeCloseTo(15.0, 6)
  })

  it('combines input and output costs', () => {
    // 500k input ($1.50) + 100k output ($1.50) = $3.00
    expect(computeCostUsd(500_000, 100_000)).toBeCloseTo(3.0, 6)
  })

  it('handles small token counts precisely', () => {
    // 1000 input ($0.003) + 500 output ($0.0075) = $0.0105
    expect(computeCostUsd(1000, 500)).toBeCloseTo(0.0105, 6)
  })
})
