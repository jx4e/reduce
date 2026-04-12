export type EventType = 'study' | 'exam' | 'assignment' | 'other'

export interface StudyEventData {
  id: string
  title: string
  date: string        // ISO 8601
  duration: number | null  // minutes; null = all-day
  type: EventType
  guideId: string | null
  gcalEventId: string | null
  notes: string | null
  createdAt: string
}

// Returned by the AI extraction endpoint before the user confirms
export interface CandidateEvent {
  title: string
  date: string        // ISO 8601 date or datetime
  type: 'exam' | 'assignment' | 'other'
  duration?: number   // minutes; only set by generate-plan
}

// Payload for creating a single event
export interface CreateEventPayload {
  title: string
  date: string
  duration?: number | null
  type: EventType
  guideId?: string | null
  notes?: string | null
}
