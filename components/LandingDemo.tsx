'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import GuideElement from '@/components/GuideElement'
import type { ContentElement, ChatMessage } from '@/types/guide'

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

const SCRIPTED_RESPONSES: Record<string, string> = {
  'demo-heading':
    'A Binary Search Tree is a fundamental data structure. The key property is that for every node, all values in its left subtree are smaller, and all values in its right subtree are larger. This invariant makes search, insert, and delete operations efficient at O(log n) on average.',
  'demo-paragraph':
    'The BST invariant is what makes the tree useful. Because smaller values always go left and larger values always go right, we can do binary search — at each node we eliminate half the remaining tree. This is why BSTs achieve O(log n) average-case operations.',
  'demo-code':
    "This recursive search function compares the target to the current node's value. If the target is smaller, go left; if larger, go right. Base cases: node is null (not found) or node.val equals target (found). Time complexity is O(h) where h is the height of the tree.",
  'demo-formula':
    'O(log n) average-case complexity assumes the tree is reasonably balanced. In the worst case — a sorted input creating a degenerate linear tree — operations degrade to O(n). This is why self-balancing variants like AVL trees and Red-Black trees exist.',
}

export default function LandingDemo() {
  const msgIdCounter = useRef(0)
  const [elementChats, setElementChats] = useState<Map<string, ChatMessage[]>>(new Map())
  const [elementNotes, setElementNotes] = useState<Map<string, string>>(new Map())
  const [loadingElementId, setLoadingElementId] = useState<string | null>(null)

  function handleAsk(element: ContentElement, question: string) {
    const userMsg: ChatMessage = {
      id: `demo-msg-${++msgIdCounter.current}`,
      role: 'user',
      content: question,
      contextElementId: element.id,
    }
    setElementChats(prev => {
      const next = new Map(prev)
      next.set(element.id, [...(prev.get(element.id) ?? []), userMsg])
      return next
    })

    setLoadingElementId(element.id)

    const response = SCRIPTED_RESPONSES[element.id] ?? 'Great question! This is a key concept in the material.'
    const assistantMsgId = `demo-msg-${++msgIdCounter.current}`

    // Seed an empty assistant message
    setElementChats(prev => {
      const next = new Map(prev)
      const existing = prev.get(element.id) ?? []
      const assistantMsg: ChatMessage = { id: assistantMsgId, role: 'assistant', content: '' }
      next.set(element.id, [...existing, assistantMsg])
      return next
    })

    // Stream characters one at a time
    let i = 0
    const interval = setInterval(() => {
      i++
      setElementChats(prev => {
        const next = new Map(prev)
        const msgs = prev.get(element.id) ?? []
        next.set(
          element.id,
          msgs.map(m => m.id === assistantMsgId ? { ...m, content: response.slice(0, i) } : m),
        )
        return next
      })
      if (i >= response.length) {
        clearInterval(interval)
        setLoadingElementId(null)
      }
    }, 20)
  }

  function handleNoteChange(elementId: string, note: string) {
    setElementNotes(prev => new Map(prev).set(elementId, note))
  }

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
                messages={elementChats.get(el.id) ?? []}
                note={elementNotes.get(el.id) ?? ''}
                loading={loadingElementId === el.id}
                onAsk={handleAsk}
                onNoteChange={handleNoteChange}
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
