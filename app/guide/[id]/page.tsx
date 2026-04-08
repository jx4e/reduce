import GuideClientLoader from './GuideClientLoader'

export default async function GuidePage(props: PageProps<'/guide/[id]'>) {
  const { id } = await props.params
  return <GuideClientLoader id={id} />
}
