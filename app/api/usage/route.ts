import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { computeCostUsd } from '@/lib/tokenCost'

export async function GET(): Promise<Response> {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  try {
    const result = await prisma.tokenUsage.aggregate({
      where: { userId: session.user.id },
      _sum: { inputTokens: true, outputTokens: true },
    })

    const inputTokens = result._sum.inputTokens ?? 0
    const outputTokens = result._sum.outputTokens ?? 0

    return Response.json({
      totalTokens: inputTokens + outputTokens,
      estimatedCostUsd: computeCostUsd(inputTokens, outputTokens),
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
