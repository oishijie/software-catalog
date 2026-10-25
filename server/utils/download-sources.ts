/**
 * 下载来源规范化
 *
 * 规则（与原站保持一致的展示口径）：
 *  1. 私有网盘（夸克 / 百度 / 阿里 / 123 / 115 等）一律不收录、不抓取、不展示；
 *  2. 开源项目：只要 release 带 GitHub Release 直链，就统一补齐 GitHub 镜像站
 *     （GH-Proxy / GHFast），链接由直链按镜像站规则派生，不依赖上游是否提供；
 *  3. 原站已存在的镜像来源条目直接丢弃，改由直链统一派生，避免重复与失效链接。
 */

export type SourceKind = 'hosted' | 'github' | 'github_mirror' | 'official'

export interface DownloadSource {
  id: string
  kind: SourceKind
  /** 卡片标题，如 GitHub / GitHub 加速 · GH-Proxy */
  label: string
  /** 卡片描述小字 */
  description: string
  /** 右上角徽章 */
  badge: string
  /** tabler 图标名 */
  icon: string
  /** 下载地址；本站托管的来源为空串 */
  url: string
  /** 展示排序：越小越靠前 */
  priority: number
  /** 是否走本站下载流程（登录 / 计数） */
  hosted: boolean
}

/** GitHub 镜像站清单：顺序即展示顺序 */
export const GITHUB_MIRRORS = [
  {
    id: 'gh-proxy',
    label: 'GitHub 加速 · GH-Proxy',
    description: '通过开发者提供的链接下载。',
    icon: 'i-tabler:link',
    priority: 30,
    /** gh-proxy 保留完整原始地址 */
    rewrite: (url: string) => `https://gh-proxy.com/${url}`
  },
  {
    id: 'ghfast',
    label: 'GitHub 加速 · GHFast',
    description: '通过开发者提供的链接下载。',
    icon: 'i-tabler:link',
    priority: 40,
    /** ghfast 约定去掉协议头 */
    rewrite: (url: string) => `https://ghfast.top/${url.replace(/^https?:\/\//i, '')}`
  }
] as const

const GITHUB_RELEASE_RE = /^https?:\/\/(?:www\.)?github\.com\/[^/]+\/[^/]+\/releases\/download\//i

/** 私有网盘判定：kind / 标题 / 域名任一命中即视为网盘 */
const CLOUD_DRIVE_HOST_RE =
  /^https?:\/\/(?:[a-z0-9-]+\.)*(?:quark\.cn|pan\.baidu\.com|aliyundrive\.com|alipan\.com|123pan\.com|123684\.com|115\.com|weiyun\.com|lanzou[a-z]*\.com|cowtransfer\.com)/i

export function isCloudDrive(kind: string, label: string, url: string): boolean {
  if (kind === 'cloud_drive') return true
  if (/网盘/.test(label)) return true
  if (url && CLOUD_DRIVE_HOST_RE.test(url)) return true
  return false
}

const HOSTED_DEFAULT: Omit<DownloadSource, 'label' | 'description'> = {
  id: 'hosted',
  kind: 'hosted',
  badge: '本站',
  icon: 'i-tabler:cloud-download',
  url: '',
  priority: 10,
  hosted: true
}

/**
 * 把数据库里存的原始 sources（上游 JSON）规范化成可直接渲染的来源列表。
 */
export function normalizeSources(raw: unknown): DownloadSource[] {
  const list = Array.isArray(raw) ? (raw as any[]) : []
  const out: DownloadSource[] = []
  const githubUrls: string[] = []

  for (const s of list) {
    if (!s || typeof s !== 'object') continue

    const url = String(s.delivery?.url ?? '').trim()
    const kind = String(s.kind ?? '')
    const label = String(s.label ?? '')

    // ① 私有网盘：不收录
    if (isCloudDrive(kind, label, url)) continue

    // ② 原站的镜像来源：丢弃，稍后按直链统一派生
    if (/加速/.test(label)) continue

    // ③ 本站托管
    if (kind === 'hosted') {
      out.push({
        ...HOSTED_DEFAULT,
        label: label || '本站下载',
        description: '由本站提供下载，登录后即可获取。'
      })
      continue
    }

    // ④ GitHub 原始直链（开源项目）
    if (kind === 'github' || GITHUB_RELEASE_RE.test(url)) {
      if (!url) continue
      if (!githubUrls.includes(url)) githubUrls.push(url)
      out.push({
        id: 'github',
        kind: 'github',
        label: 'GitHub',
        description: 'GitHub Release 发布的原始文件。',
        badge: '外部源',
        icon: 'i-tabler:brand-github',
        url,
        priority: 20,
        hosted: false
      })
      continue
    }

    // ⑤ 其余外链（软件作者提供的官方下载入口等）
    if (url) {
      out.push({
        id: 'official',
        kind: 'official',
        label: label || '官方下载',
        description: '由软件作者提供的官方下载地址。',
        badge: '外部源',
        icon: 'i-tabler:world-download',
        url,
        priority: 50,
        hosted: false
      })
    }
  }

  // 开源项目：补齐 GitHub 镜像站
  for (const gh of githubUrls) {
    for (const m of GITHUB_MIRRORS) {
      out.push({
        id: m.id,
        kind: 'github_mirror',
        label: m.label,
        description: m.description,
        badge: '外部源',
        icon: m.icon,
        url: m.rewrite(gh),
        priority: m.priority,
        hosted: false
      })
    }
  }

  return out.sort((a, b) => a.priority - b.priority)
}
