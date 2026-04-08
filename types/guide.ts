export type GuideMode = 'math-cs' | 'humanities'

export interface GuideCardData {
  id: string
  title: string
  createdAt: string
  mode: GuideMode
}

export type ContentElementType = 'heading' | 'paragraph' | 'formula' | 'code' | 'image' | 'timeline'

export interface TimelineEvent {
  date: string
  title: string
  description: string
}

export interface ContentElement {
  id: string
  type: ContentElementType
  content: string
  level?: 2 | 3           // heading level
  language?: string        // code block language
  src?: string             // image URL
  events?: TimelineEvent[] // timeline events
}

export interface GuideSection {
  id: string
  heading: string
  elements: ContentElement[]
}

export interface Guide {
  id: string
  title: string
  mode: GuideMode
  sections: GuideSection[]
  createdAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  contextElementId?: string
  contextElementContent?: string
}
