import type { GuideCardData } from './guide'

export interface ProjectFile {
  id: string
  projectId: string
  name: string
  size: number
  mimeType: string
  uploadedAt: string
}

export interface ProjectCardData {
  id: string
  name: string
  createdAt: string
  fileCount: number
  guideCount: number
}

export interface ProjectDetail {
  id: string
  name: string
  createdAt: string
  files: ProjectFile[]
  guides: GuideCardData[]
}
