import GuideClientLoader from './GuideClientLoader'

export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GuideClientLoader id={id} />
}
