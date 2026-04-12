const INPUT_COST_PER_M = 3.0   // $3.00 per million input tokens (claude-sonnet-4-6)
const OUTPUT_COST_PER_M = 15.0 // $15.00 per million output tokens (claude-sonnet-4-6)

export function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_COST_PER_M + outputTokens * OUTPUT_COST_PER_M) / 1_000_000
}
