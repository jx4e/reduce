// components/elements/index.ts
import React from 'react'
import type { ContentElementType, ContentElement } from '@/types/guide'
import { HeadingElement } from './HeadingElement'
import { ParagraphElement } from './ParagraphElement'
import { FormulaElement } from './FormulaElement'
import { CodeElement } from './CodeElement'
import { ImageElement } from './ImageElement'
import { TimelineElement } from './TimelineElement'

type ElementComponent = React.FC<{ element: ContentElement }>

const elementRegistry: Record<ContentElementType, ElementComponent> = {
  heading: HeadingElement,
  paragraph: ParagraphElement,
  formula: FormulaElement,
  code: CodeElement,
  image: ImageElement,
  timeline: TimelineElement,
}

export function renderElement(element: ContentElement): React.ReactElement | null {
  const Component = elementRegistry[element.type]
  return Component ? React.createElement(Component, { element }) : null
}

export { MarkdownContent } from './MarkdownContent'
