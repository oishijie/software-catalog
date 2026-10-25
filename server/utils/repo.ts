import { useDb, plain, parseJson, nowIso, newId } from './db'
import { normalizeSources, type DownloadSource } from './download-sources'

export type Platform = 'windows' | 'macos' | 'linux' | 'android' | 'ios'

export const PLATFORMS: { key: Platform; label: string; icon: string }[] = [
  { key: 'windows', label: 'Windows', icon: 'i-tabler:brand-windows-filled' },
  { key: 'macos', label: 'macOS', icon: 'i-tabler:brand-apple-filled' },
  { key: 'linux', label: 'Linux', icon: 'i-tabler:brand-ubuntu' },
  { key: 'android', label: 'Android', icon: 'i-tabler:brand-android' },
  { key: 'ios', label: 'iOS', icon: 'i-tabler:brand-apple' }
]

export const SORT_OPTIONS = [
  { key: 'recommended', label: '推荐优先' },
  { key: 'updated', label: '最近更新' },
  { key: 'downloads', label: '下载最多' },
  { key: 'name', label: '名称排序' }
] as const

export type SortKey = (typeof SORT_OPTIONS)[number]['key']

export interface Software {
  id: string
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
  iconAssetId: string
  categoryId: string | null
  categoryName?: string | null
  categorySlug?: string | null
  platforms: Platform[]
  recommended: boolean
  status: string
  downloadCount: number
  revision: number
  source: string
  createdAt: string
  updatedAt: string
}

export interface Release {
  id: string
  softwareId: string
  version: string
  channel: string
  platform: string
  architecture: string
  fileName: string
  downloadUrl: string
  assetId: string
  sizeBytes: number
  sha256: string
  mime: string
  status: string
  publishedAt: string | null
  createdAt: string
  priceCents: number
  currency: string
  /** 规范化后的下载来源（已剔除私有网盘、已补齐 GitHub 镜像站） */
  sources: DownloadSource[]
  downloadConfigUrl: string
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string
  sortOrder: number
}

export interface ListParams {
  page?: number
  size?: number
  categoryId?: string | null
  platform?: string | null
  q?: string | null
  sortBy?: SortKey
  status?: string | null
  recommendedOnly?: boolean
}

function toSoftware(row: any): Software {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary ?? '',
    description: row.description ?? '',
    releaseNotes: row.release_notes ?? '',
    usageInstructions: row.usage_instructions ?? '',
    faq: row.faq ?? '',
    githubUrl: row.github_url ?? '',
    websiteUrl: row.website_url ?? '',
    documentationUrl: row.documentation_url ?? '',
    iconUrl: row.icon_url ?? '',
    iconAssetId: row.icon_asset_id ?? '',
    categoryId: row.category_id ?? null,
    categoryName: row.category_name ?? null,
    categorySlug: row.category_slug ?? null,
    platforms: parseJson<Platform[]>(row.platforms, []),
    recommended: !!row.recommended,
    status: row.status ?? 'active',
    downloadCount: Number(row.download_count ?? 0),
    revision: Number(row.revision ?? 1),
    source: row.source ?? 'manual',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toRelease(row: any): Release {
  return {
    id: row.id,
    softwareId: row.software_id,
    version: row.version ?? '',
    channel: row.channel ?? 'stable',
    platform: row.platform ?? '',
    architecture: row.architecture ?? '',
    fileName: row.file_name ?? '',
    downloadUrl: row.download_url ?? '',
    assetId: row.asset_id ?? '',
    sizeBytes: Number(row.size_bytes ?? 0),
    sha256: row.sha256 ?? '',
    mime: row.mime ?? '',
    status: row.status ?? 'active',
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at,
    priceCents: Number(row.price_cents ?? 0),
    currency: row.currency ?? 'CNY',
    sources: normalizeSources(parseJson<unknown>(row.sources, [])),
    downloadConfigUrl: row.download_config_url ?? ''
  }
}

/* ------------------------------------------------------------------ 分类 */

export async function listCategories(): Promise<(Category & { total: number })[]> {
  const rows = await useDb().all<any>(
    `SELECT c.id, c.name, c.slug, c.icon, c.sort_order,
            (SELECT COUNT(1) FROM software s WHERE s.category_id = c.id AND s.status = 'active') AS total
     FROM category c
     ORDER BY c.sort_order ASC, c.name ASC`
  )
  return rows.map((r) => ({ ...plain<Category>(r), total: Number(r.total ?? 0) }))
}

export async function getCategory(id: string): Promise<Category | null> {
  const row = await useDb().get<any>('SELECT * FROM category WHERE id = ? OR slug = ?', id, id)
  return row ? plain<Category>(row) : null
}

export async function upsertCategory(input: Partial<Category> & { name: string }): Promise<Category> {
  const db = useDb()
  const now = nowIso()
  const id = input.id || newId()
  const slug = input.slug || slugify(input.name)

  await db.run(
    `INSERT INTO category (id, name, slug, icon, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, slug = excluded.slug, icon = excluded.icon,
       sort_order = excluded.sort_order, updated_at = excluded.updated_at`,
    id,
    input.name,
    slug,
    input.icon ?? '',
    input.sortOrder ?? 0,
    now,
    now
  )
  return (await getCategory(id))!
}

export async function deleteCategory(id: string): Promise<void> {
  await useDb().run('DELETE FROM category WHERE id = ?', id)
}

/* ------------------------------------------------------------------ 计数 */

export async function platformCounts(): Promise<Record<string, number>> {
  const rows = await useDb().all<any>(`SELECT platforms FROM software WHERE status = 'active'`)
  const out: Record<string, number> = {}
  for (const p of PLATFORMS) out[p.key] = 0
  for (const r of rows) {
    for (const p of parseJson<string[]>(r.platforms, [])) {
      out[p] = (out[p] ?? 0) + 1
    }
  }
  return out
}

export async function catalogFilterCounts(): Promise<{
  all: number
  categories: Record<string, number>
  platforms: Record<string, number>
}> {
  const db = useDb()
  const total = await db.get<any>(`SELECT COUNT(1) AS n FROM software WHERE status = 'active'`)
  const catRows = await db.all<any>(
    `SELECT category_id AS id, COUNT(1) AS n FROM software
     WHERE status = 'active' AND category_id IS NOT NULL GROUP BY category_id`
  )
  const categories: Record<string, number> = {}
  for (const r of catRows) categories[r.id] = Number(r.n)
  return { all: Number(total?.n ?? 0), categories, platforms: await platformCounts() }
}

/* ------------------------------------------------------------------ 查询 */

function buildWhere(params: ListParams): { sql: string; args: any[] } {
  const clauses: string[] = []
  const args: any[] = []

  // status 传 'all' 表示不限制（后台用）
  const status = params.status
  if (status !== 'all') {
    clauses.push('s.status = ?')
    args.push(status || 'active')
  }

  if (params.categoryId) {
    clauses.push('s.category_id = ?')
    args.push(params.categoryId)
  }
  if (params.platform) {
    clauses.push('s.platforms LIKE ?')
    args.push(`%"${params.platform}"%`)
  }
  if (params.recommendedOnly) {
    clauses.push('s.recommended = 1')
  }
  const q = (params.q || '').trim()
  if (q) {
    clauses.push('(s.name LIKE ? OR s.summary LIKE ? OR s.description LIKE ? OR s.slug LIKE ?)')
    const like = `%${q}%`
    args.push(like, like, like, like)
  }
  return { sql: clauses.join(' AND '), args }
}

function orderBy(sortBy: SortKey | undefined): string {
  switch (sortBy) {
    case 'updated':
      return 's.updated_at DESC'
    case 'downloads':
      return 's.download_count DESC, s.updated_at DESC'
    case 'name':
      return 's.name ASC'
    default:
      return 's.recommended DESC, s.updated_at DESC'
  }
}

export async function countSoftware(params: ListParams): Promise<number> {
  const { sql, args } = buildWhere(params)
  const row = await useDb().get<any>(`SELECT COUNT(1) AS n FROM software s WHERE ${sql}`, ...args)
  return Number(row?.n ?? 0)
}

export async function listSoftware(
  params: ListParams
): Promise<{ items: Software[]; page: number; size: number; total: number }> {
  const page = Math.max(1, Number(params.page) || 1)
  const size = Math.min(96, Math.max(1, Number(params.size) || 24))
  const { sql, args } = buildWhere(params)

  const rows = await useDb().all<any>(
    `SELECT s.*, c.name AS category_name, c.slug AS category_slug
     FROM software s
     LEFT JOIN category c ON c.id = s.category_id
     WHERE ${sql}
     ORDER BY ${orderBy(params.sortBy)}
     LIMIT ? OFFSET ?`,
    ...args,
    size,
    (page - 1) * size
  )

  return {
    items: rows.map(toSoftware),
    page,
    size,
    total: await countSoftware(params)
  }
}

/* ------------------------------------------------- 静态部署支持 */

/** 卡片渲染所需的最小字段集（Software 与 CatalogIndexItem 均满足） */
export interface CatalogCardItem {
  id: string
  slug: string
  name: string
  summary: string
  description?: string
  iconUrl: string
  categoryName?: string | null
  platforms: Platform[]
  downloadCount: number
  updatedAt: string
}

/** 目录页专用：剔除长文本字段的精简投影 */
export interface CatalogIndexItem extends CatalogCardItem {
  categoryId: string | null
  recommended: boolean
}

/**
 * 全量精简目录，供目录页一次性取回后在客户端做筛选 / 排序 / 分页。
 * 长文本（description / release_notes / faq 等）不下发，payload 体积可控。
 */
export async function listCatalogIndex(): Promise<CatalogIndexItem[]> {
  const rows = await useDb().all<any>(
    `SELECT s.id, s.slug, s.name, s.summary, s.icon_url, s.category_id, s.platforms,
            s.recommended, s.download_count, s.updated_at, c.name AS category_name
     FROM software s
     LEFT JOIN category c ON c.id = s.category_id
     WHERE s.status = 'active'
     ORDER BY s.recommended DESC, s.updated_at DESC`
  )

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    summary: r.summary ?? '',
    iconUrl: r.icon_url ?? '',
    categoryId: r.category_id ?? null,
    categoryName: r.category_name ?? null,
    platforms: parseJson<Platform[]>(r.platforms, []),
    recommended: !!r.recommended,
    downloadCount: Number(r.download_count ?? 0),
    updatedAt: r.updated_at
  }))
}

export async function getSoftwareBySlug(slug: string): Promise<Software | null> {
  const row = await useDb().get<any>(
    `SELECT s.*, c.name AS category_name, c.slug AS category_slug
     FROM software s LEFT JOIN category c ON c.id = s.category_id
     WHERE s.slug = ?`,
    slug
  )
  return row ? toSoftware(row) : null
}

export async function getSoftwareById(id: string): Promise<Software | null> {
  const row = await useDb().get<any>(
    `SELECT s.*, c.name AS category_name, c.slug AS category_slug
     FROM software s LEFT JOIN category c ON c.id = s.category_id
     WHERE s.id = ?`,
    id
  )
  return row ? toSoftware(row) : null
}

export async function listReleases(softwareId: string): Promise<Release[]> {
  const rows = await useDb().all<any>(
    `SELECT * FROM release WHERE software_id = ?
     ORDER BY published_at DESC, created_at DESC`,
    softwareId
  )
  return rows.map(toRelease)
}

export async function relatedSoftware(sw: Software, limit = 4): Promise<Software[]> {
  const rows = await useDb().all<any>(
    `SELECT s.*, c.name AS category_name, c.slug AS category_slug
     FROM software s LEFT JOIN category c ON c.id = s.category_id
     WHERE s.status = 'active' AND s.id <> ?
     ORDER BY
       CASE WHEN s.category_id = ? THEN 0 ELSE 1 END,
       s.recommended DESC, s.updated_at DESC
     LIMIT ?`,
    sw.id,
    sw.categoryId ?? '',
    limit
  )
  return rows.map(toSoftware)
}

/* ------------------------------------------------------------------ 写入 */

export interface SoftwareInput {
  id?: string
  slug?: string
  name: string
  summary?: string
  description?: string
  releaseNotes?: string
  usageInstructions?: string
  faq?: string
  githubUrl?: string
  websiteUrl?: string
  documentationUrl?: string
  iconUrl?: string
  iconAssetId?: string
  categoryId?: string | null
  platforms?: string[]
  recommended?: boolean
  status?: string
  downloadCount?: number
  source?: string
}

export async function upsertSoftware(input: SoftwareInput): Promise<Software> {
  const db = useDb()
  const now = nowIso()
  const existing = input.id
    ? await getSoftwareById(input.id)
    : input.slug
      ? await getSoftwareBySlug(input.slug)
      : null

  if (existing) {
    await db.run(
      `UPDATE software SET
         slug = ?, name = ?, summary = ?, description = ?, release_notes = ?,
         usage_instructions = ?, faq = ?, github_url = ?, website_url = ?,
         documentation_url = ?, icon_url = ?, icon_asset_id = ?, category_id = ?,
         platforms = ?, recommended = ?, status = ?, download_count = ?,
         source = ?, revision = revision + 1, updated_at = ?
       WHERE id = ?`,
      input.slug ?? existing.slug,
      input.name,
      input.summary ?? existing.summary,
      input.description ?? existing.description,
      input.releaseNotes ?? existing.releaseNotes,
      input.usageInstructions ?? existing.usageInstructions,
      input.faq ?? existing.faq,
      input.githubUrl ?? existing.githubUrl,
      input.websiteUrl ?? existing.websiteUrl,
      input.documentationUrl ?? existing.documentationUrl,
      input.iconUrl ?? existing.iconUrl,
      input.iconAssetId ?? existing.iconAssetId,
      input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      JSON.stringify(input.platforms ?? existing.platforms),
      (input.recommended ?? existing.recommended) ? 1 : 0,
      input.status ?? existing.status,
      input.downloadCount ?? existing.downloadCount,
      input.source ?? existing.source,
      now,
      existing.id
    )
    return (await getSoftwareById(existing.id))!
  }

  const id = input.id || newId()
  await db.run(
    `INSERT INTO software (
       id, slug, name, summary, description, release_notes, usage_instructions, faq,
       github_url, website_url, documentation_url, icon_url, icon_asset_id, category_id,
       platforms, recommended, status, download_count, revision, source, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    id,
    input.slug || slugify(input.name),
    input.name,
    input.summary ?? '',
    input.description ?? '',
    input.releaseNotes ?? '',
    input.usageInstructions ?? '',
    input.faq ?? '',
    input.githubUrl ?? '',
    input.websiteUrl ?? '',
    input.documentationUrl ?? '',
    input.iconUrl ?? '',
    input.iconAssetId ?? '',
    input.categoryId ?? null,
    JSON.stringify(input.platforms ?? []),
    input.recommended ? 1 : 0,
    input.status ?? 'active',
    input.downloadCount ?? 0,
    input.source ?? 'manual',
    now,
    now
  )
  return (await getSoftwareById(id))!
}

export async function deleteSoftware(id: string): Promise<void> {
  await useDb().run('DELETE FROM software WHERE id = ?', id)
}

export async function incrementDownload(slug: string): Promise<void> {
  await useDb().run('UPDATE software SET download_count = download_count + 1 WHERE slug = ?', slug)
}

export interface ReleaseInput {
  id?: string
  softwareId: string
  version?: string
  channel?: string
  platform?: string
  architecture?: string
  fileName?: string
  downloadUrl?: string
  assetId?: string
  sizeBytes?: number
  sha256?: string
  mime?: string
  status?: string
  publishedAt?: string | null
  sources?: string[]
  downloadConfigUrl?: string
}

export async function upsertRelease(input: ReleaseInput): Promise<Release> {
  const db = useDb()
  const now = nowIso()

  if (input.id) {
    await db.run(
      `UPDATE release SET
         version = ?, channel = ?, platform = ?, architecture = ?, file_name = ?,
         download_url = ?, asset_id = ?, size_bytes = ?, sha256 = ?, mime = ?,
         status = ?, published_at = ?, sources = ?, download_config_url = ?,
         revision = revision + 1
       WHERE id = ?`,
      input.version ?? '',
      input.channel ?? 'stable',
      input.platform ?? '',
      input.architecture ?? '',
      input.fileName ?? '',
      input.downloadUrl ?? '',
      input.assetId ?? '',
      input.sizeBytes ?? 0,
      input.sha256 ?? '',
      input.mime ?? '',
      input.status ?? 'active',
      input.publishedAt ?? null,
      JSON.stringify(input.sources ?? []),
      input.downloadConfigUrl ?? '',
      input.id
    )
    return toRelease(await db.get<any>('SELECT * FROM release WHERE id = ?', input.id))
  }

  const id = newId()
  await db.run(
    `INSERT INTO release (
       id, software_id, version, channel, platform, architecture, file_name, download_url,
       asset_id, size_bytes, sha256, mime, status, revision, published_at, created_at,
       sources, download_config_url
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    id,
    input.softwareId,
    input.version ?? '',
    input.channel ?? 'stable',
    input.platform ?? '',
    input.architecture ?? '',
    input.fileName ?? '',
    input.downloadUrl ?? '',
    input.assetId ?? '',
    input.sizeBytes ?? 0,
    input.sha256 ?? '',
    input.mime ?? '',
    input.status ?? 'active',
    input.publishedAt ?? now,
    now,
    JSON.stringify(input.sources ?? []),
    input.downloadConfigUrl ?? ''
  )
  return toRelease(await db.get<any>('SELECT * FROM release WHERE id = ?', id))
}

export async function deleteRelease(id: string): Promise<void> {
  await useDb().run('DELETE FROM release WHERE id = ?', id)
}

/* ------------------------------------------------------------- 站点配置 */

export async function getSiteProfile(): Promise<any> {
  const row = await useDb().get<any>('SELECT * FROM site_profile WHERE id = 1')
  if (!row) return null
  return { ...parseJson(row.document, {}), revision: row.revision, updatedAt: row.updated_at }
}

export async function setSiteProfile(profile: any): Promise<void> {
  const db = useDb()
  const now = nowIso()
  const cur = await db.get<any>('SELECT revision FROM site_profile WHERE id = 1')
  const revision = Number(cur?.revision ?? 0) + 1
  await db.run(
    `INSERT INTO site_profile (id, document, revision, schema_version, updated_at)
     VALUES (1, ?, ?, 1, ?)
     ON CONFLICT(id) DO UPDATE SET
       document = excluded.document, revision = excluded.revision, updated_at = excluded.updated_at`,
    JSON.stringify(profile),
    revision,
    now
  )
}

/* ------------------------------------------------------------- 工具函数 */

export function slugify(input: string): string {
  const base = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || `software-${Math.random().toString(16).slice(2, 10)}`
}

export async function setCrawlMeta(key: string, value: string): Promise<void> {
  await useDb().run(
    `INSERT INTO crawl_log (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    nowIso()
  )
}

export async function getCrawlMeta(key: string): Promise<string | null> {
  const row = await useDb().get<any>('SELECT value FROM crawl_log WHERE key = ?', key)
  return row?.value ?? null
}
