#!/usr/bin/env node
/**
 * 把 data/crawl/*.json 导入本地 SQLite。
 *
 * 用法：node tools/import-json.mjs
 * 幂等：重复执行只会更新，不会产生重复数据。
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DB_PATH = process.env.CATALOG_DB || join(ROOT, 'data', 'catalog.db')
const CRAWL_DIR = join(ROOT, 'data', 'crawl')
const MEDIA_DIR = join(ROOT, 'public', 'media')

const readJson = (f) => {
  const p = join(CRAWL_DIR, f)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf-8'))
}

const now = () => new Date().toISOString()

function slugify(input) {
  const s = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || `software-${Math.random().toString(16).slice(2, 10)}`
}

mkdirSync(dirname(DB_PATH), { recursive: true })
const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')
db.exec(readFileSync(join(ROOT, 'data', 'schema.sql'), 'utf-8'))

/* ------------------------------------------------------------ 分类 */

const categories = readJson('categories.json') || []
let catCount = 0
{
  const stmt = db.prepare(
    `INSERT INTO category (id, name, slug, icon, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, slug = excluded.slug, icon = excluded.icon,
       sort_order = excluded.sort_order, updated_at = excluded.updated_at`
  )
  categories.forEach((c, i) => {
    if (!c?.id || !c?.name) return
    stmt.run(c.id, c.name, c.slug || slugify(c.name), c.icon ?? '', c.sortOrder ?? i, now(), now())
    catCount++
  })
}
console.log(`✓ 分类 ${catCount} 个`)

/* ------------------------------------------------------------ 软件 */

const software = readJson('software.json') || []
const catIds = new Set(categories.map((c) => c.id))

const insertSw = db.prepare(
  `INSERT INTO software (
     id, slug, name, summary, description, release_notes, usage_instructions, faq,
     github_url, website_url, documentation_url, icon_url, icon_asset_id, category_id,
     platforms, recommended, status, download_count, revision, source, created_at, updated_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET
     slug = excluded.slug, name = excluded.name, summary = excluded.summary,
     description = excluded.description, release_notes = excluded.release_notes,
     usage_instructions = excluded.usage_instructions, faq = excluded.faq,
     github_url = excluded.github_url, website_url = excluded.website_url,
     documentation_url = excluded.documentation_url, icon_url = excluded.icon_url,
     icon_asset_id = excluded.icon_asset_id, category_id = excluded.category_id,
     platforms = excluded.platforms, recommended = excluded.recommended,
     status = excluded.status, download_count = excluded.download_count,
     source = excluded.source, updated_at = excluded.updated_at`
)

function iconUrlFor(s) {
  const raw = s.iconUrl || ''
  const fileId = (raw.match(/\/media\/([^?]+)/) || [])[1]
  // 本地已下载过就用本地文件，否则指回原站
  if (fileId && existsSync(join(MEDIA_DIR, `${fileId}.webp`))) return `/media/${fileId}.webp`
  if (raw) return `https://apps.yuelili.com${raw}`
  return ''
}

let swCount = 0
let missingCat = 0
for (const s of software) {
  if (!s?.id || !s?.name) continue
  const categoryId = s.categoryId && catIds.has(s.categoryId) ? s.categoryId : null
  if (s.categoryId && !catIds.has(s.categoryId)) missingCat++
  insertSw.run(
    s.id,
    s.slug || slugify(s.name),
    s.name,
    s.summary ?? '',
    s.description ?? '',
    s.releaseNotes ?? '',
    s.usageInstructions ?? '',
    s.faq ?? '',
    s.githubUrl ?? '',
    s.websiteUrl ?? '',
    s.documentationUrl ?? '',
    iconUrlFor(s),
    s.iconAssetId ?? '',
    categoryId,
    JSON.stringify(Array.isArray(s.platforms) ? s.platforms : []),
    s.recommended ? 1 : 0,
    s.status || 'active',
    Number(s.downloadCount) || 0,
    Number(s.revision) || 1,
    'crawl',
    s.createdAt || now(),
    s.updatedAt || now()
  )
  swCount++
}
console.log(`✓ 软件 ${swCount} 条${missingCat ? `（${missingCat} 条分类未匹配）` : ''}`)

/* ------------------------------------------------------------ 版本 */

const releases = readJson('releases.json')
let relCount = 0
if (releases) {
  const swBySlug = new Map(software.map((s) => [s.slug, s]))
  const insertRel = db.prepare(
    `INSERT INTO release (
       id, software_id, version, channel, platform, architecture, file_name, download_url,
       asset_id, size_bytes, sha256, mime, status, revision, published_at, created_at,
       price_cents, currency, sources, download_config_url
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       version = excluded.version, channel = excluded.channel, platform = excluded.platform,
       architecture = excluded.architecture, file_name = excluded.file_name,
       download_url = excluded.download_url, asset_id = excluded.asset_id,
       size_bytes = excluded.size_bytes, sha256 = excluded.sha256, mime = excluded.mime,
       status = excluded.status, published_at = excluded.published_at,
       sources = excluded.sources, download_config_url = excluded.download_config_url`
  )
  for (const item of releases) {
    const sw = swBySlug.get(item.slug)
    if (!sw) continue
    for (const r of item.releases ?? []) {
      if (!r?.id) continue
      insertRel.run(
        r.id,
        sw.id,
        r.version ?? '',
        r.channel ?? 'stable',
        r.platform ?? '',
        r.architecture ?? '',
        r.fileName ?? '',
        r.downloadUrl ?? '',
        r.assetId ?? '',
        Number(r.sizeBytes) || 0,
        r.sha256 ?? '',
        r.mime ?? '',
        r.status ?? 'active',
        Number(r.revision) || 1,
        r.publishedAt ?? null,
        r.createdAt ?? now(),
        Number(r.priceCents) || 0,
        r.currency ?? 'CNY',
        JSON.stringify(Array.isArray(r.sources) ? r.sources : []),
        r.downloadConfigUrl ?? ''
      )
      relCount++
    }
  }
  console.log(`✓ 版本 ${relCount} 条`)
} else {
  console.log('· 跳过版本（未抓取 releases.json，可用 --with-releases 重跑抓取）')
}

/* --------------------------------------------------------- 站点配置 */

const profile = readJson('site-profile.json')
if (profile) {
  const cur = db.prepare('SELECT revision FROM site_profile WHERE id = 1').get()
  db.prepare(
    `INSERT INTO site_profile (id, document, revision, schema_version, updated_at)
     VALUES (1, ?, ?, 1, ?)
     ON CONFLICT(id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at`
  ).run(JSON.stringify(profile), Number(cur?.revision ?? 0) + 1, now())
  console.log('✓ 站点配置已导入')
}

/* -------------------------------------------------------- 抓取元信息 */

const meta = readJson('crawl-meta.json')
if (meta) {
  db.prepare(
    `INSERT INTO crawl_log (key, value, updated_at) VALUES ('last-crawl', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(JSON.stringify(meta), now())
}

console.log(`\n完成。数据库：${DB_PATH}`)
db.close()
