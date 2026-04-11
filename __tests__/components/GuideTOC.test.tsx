// __tests__/components/GuideTOC.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuideTOC } from '@/components/guide/GuideTOC'
import type { GuideSection } from '@/types/guide'

const sections: GuideSection[] = [
  { id: 's1', heading: 'Introduction', elements: [] },
  { id: 's2', heading: 'Chapter Two', elements: [] },
]

describe('GuideTOC', () => {
  it('renders section links in desktop sidebar', () => {
    render(
      <GuideTOC
        sections={sections}
        activeSection="s1"
        onSectionClick={() => {}}
        mobileOpen={false}
        onMobileClose={() => {}}
      />
    )
    expect(screen.getByText('1. Introduction')).toBeInTheDocument()
    expect(screen.getByText('2. Chapter Two')).toBeInTheDocument()
  })

  it('calls onSectionClick with section id when a link is clicked', async () => {
    const user = userEvent.setup()
    const onSectionClick = jest.fn()
    render(
      <GuideTOC
        sections={sections}
        activeSection="s1"
        onSectionClick={onSectionClick}
        mobileOpen={false}
        onMobileClose={() => {}}
      />
    )
    await user.click(screen.getByText('2. Chapter Two'))
    expect(onSectionClick).toHaveBeenCalledWith('s2')
  })

  it('renders mobile sheet when mobileOpen is true', () => {
    render(
      <GuideTOC
        sections={sections}
        activeSection="s1"
        onSectionClick={() => {}}
        mobileOpen={true}
        onMobileClose={() => {}}
      />
    )
    expect(screen.getByTestId('mobile-toc-section-list')).toBeInTheDocument()
    expect(within(screen.getByTestId('mobile-toc-section-list')).getByText('1. Introduction')).toBeInTheDocument()
  })

  it('calls onMobileClose when a section is clicked in mobile sheet', async () => {
    const user = userEvent.setup()
    const onMobileClose = jest.fn()
    render(
      <GuideTOC
        sections={sections}
        activeSection="s1"
        onSectionClick={() => {}}
        mobileOpen={true}
        onMobileClose={onMobileClose}
      />
    )
    await user.click(within(screen.getByTestId('mobile-toc-section-list')).getByText('1. Introduction'))
    expect(onMobileClose).toHaveBeenCalled()
  })
})
