import GroupPageClient from './GroupPageClient'

type Props = { params: Promise<{ id: string }> }

export default async function GroupPage({ params }: Props) {
  const { id } = await params
  return <GroupPageClient projectId={id} />
}
