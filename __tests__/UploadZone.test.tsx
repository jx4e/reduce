import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UploadZone from '@/components/UploadZone'

describe('UploadZone', () => {
  it('renders upload prompt text', () => {
    render(<UploadZone onFilesChange={() => {}} />)
    expect(screen.getByText(/drag & drop or click/i)).toBeInTheDocument()
  })

  it('renders accepted file types hint', () => {
    render(<UploadZone onFilesChange={() => {}} />)
    expect(screen.getByText(/pdf, slides, notes/i)).toBeInTheDocument()
  })

  it('shows selected file names after file input', async () => {
    const user = userEvent.setup()
    const onFilesChange = jest.fn()
    render(<UploadZone onFilesChange={onFilesChange} />)

    const input = screen.getByTestId('file-input')
    const file = new File(['content'], 'notes.pdf', { type: 'application/pdf' })
    await user.upload(input, file)

    expect(onFilesChange).toHaveBeenCalledWith([file])
    expect(screen.getByText('notes.pdf')).toBeInTheDocument()
  })
})
