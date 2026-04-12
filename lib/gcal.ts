// lib/gcal.ts
export async function pushEventToGcal(
  _accessToken: string,
  _event: { title: string; date: string; duration: number | null; notes: string | null }
): Promise<string> {
  return ''
}

export async function deleteEventFromGcal(
  _accessToken: string,
  _gcalEventId: string
): Promise<void> {}

export async function getGcalTokens(
  _userId: string
): Promise<{ accessToken: string; hasCalendarScope: boolean } | null> {
  return null
}
