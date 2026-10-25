/** 后台软件表单的数据形状 */
export interface SoftwareFormValue {
  id?: string
  slug: string
  name: string
  summary: string
  description: string
  releaseNotes: string
  usageInstructions: string
  faq: string
  githubUrl: string
  websiteUrl: string
  documentationUrl: string
  iconUrl: string
  categoryId: string | null
  platforms: string[]
  recommended: boolean
  status: string
}

export function emptySoftwareForm(): SoftwareFormValue {
  return {
    slug: '',
    name: '',
    summary: '',
    description: '',
    releaseNotes: '',
    usageInstructions: '',
    faq: '',
    githubUrl: '',
    websiteUrl: '',
    documentationUrl: '',
    iconUrl: '',
    categoryId: null,
    platforms: [],
    recommended: false,
    status: 'active'
  }
}

/** 后台版本表单 */
export interface ReleaseFormValue {
  id?: string
  version: string
  channel: string
  platform: string
  architecture: string
  fileName: string
  downloadUrl: string
  sizeBytes: number | ''
  sha256: string
  status: string
}

export function emptyReleaseForm(): ReleaseFormValue {
  return {
    version: '',
    channel: 'stable',
    platform: 'windows',
    architecture: '',
    fileName: '',
    downloadUrl: '',
    sizeBytes: '',
    sha256: '',
    status: 'active'
  }
}
