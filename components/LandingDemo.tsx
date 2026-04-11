'use client'

import Link from 'next/link'
import GuideElement from '@/components/GuideElement'
import type { ContentElement } from '@/types/guide'

const DEMO_ELEMENTS: ContentElement[] = [
  {
    id: 'demo-heading',
    type: 'heading',
    level: 2,
    content: 'Binary Search Trees',
  },
  {
    id: 'demo-paragraph',
    type: 'paragraph',
    content:
      'A binary search tree (BST) is a node-based data structure where each node has at most two children. For any node, all values in the left subtree are smaller, and all values in the right subtree are larger — this is the BST invariant.',
  },
  {
    id: 'demo-code',
    type: 'code',
    language: 'python',
    content:
      'def search(node, target):\n    if node is None or node.val == target:\n        return node\n    if target < node.val:\n        return search(node.left, target)\n    return search(node.right, target)',
  },
  {
    id: 'demo-formula',
    type: 'formula',
    content: 'T(n) = O(\\log n) \\text{ (average case)}',
  },
]

export default function LandingDemo() {
  return (
    <section className="py-16 px-6" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-8">
        <div className="text-center">
          <div
            className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: 'var(--accent)' }}
          >
            See it in action
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">
            From notes to guide in seconds.
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Here&apos;s a sample guide — right-click any section to ask a question.
          </p>
        </div>

        {/* Guide widget */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {/* Guide header */}
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div
              className="text-xs font-semibold tracking-widest uppercase mb-1"
              style={{ color: 'var(--accent)' }}
            >
              Data Structures — Week 4
            </div>
            <div className="text-base font-bold tracking-tight">BST — Week 4 Guide</div>
            <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              4 elements · right-click any section to ask
            </div>
          </div>

          {/* Elements */}
          <div className="px-6 py-4 flex flex-col gap-1">
            {DEMO_ELEMENTS.map(el => (
              <GuideElement
                key={el.id}
                element={el}
                guideId="demo"
              />
            ))}
          </div>

          {/* Widget footer CTA */}
          <div
            className="px-6 py-3 flex items-center justify-between border-t"
            style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
          >
            <span className="text-xs" style={{ color: 'var(--muted-dark)' }}>
              Upload your own notes to generate a guide like this
            </span>
            <Link
              href="/register"
              className="text-xs font-semibold rounded-full px-4 py-1.5"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Try it free →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
