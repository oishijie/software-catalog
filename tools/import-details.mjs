// 把 data/crawl/details.json 导入 SQLite：更新 software 详情字段 + 写入 release 版本记录
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { stripSources } from './lib/normalize-sources.mjs'

const ROOT = process.cwd()
const DB = join(ROOT, 'data/catalog.db')
const DETAILS = join(ROOT, 'data/crawl/details.json')

if (!existsSync(DETAILS)) {
  console.error('✗ 找不到 data/crawl/details.json，请先运行 tools/crawl-details.mjs')
  process.exit(1)
}
if (!existsSync(DB)) {
  console.error('✗ 找不到 data/catalog.db')
  process.exit(1)
}

const details = JSON.parse(readFileSync(DETAILS, 'utf8'))
const db = new DatabaseSync(DB)
db.exec('PRAGMA foreign_keys = ON')

/** 从 sources 里挑一个可直接下载的直链：优先 github，其次其它非网盘来源 */
function pickDownloadUrl(sources) {
  if (!Array.isArray(sources) || !sources.length) return ''
  const flat = stripSources(sources)
    .map((s) => ({
      kind: s?.kind || '',
      url: s?.delivery?.url || ''
    }))
    .filter((s) => s.url)
  const byKind = (k) => flat.find((s) => s.kind === k)?.url || ''
  return byKind('github') || byKind('direct') || flat[0]?.url || ''
}

const updSoftware = db.prepare(`
  UPDATE software SET
    summary = ?, description = ?, release_notes = ?, usage_instructions = ?, faq = ?,
    github_url = ?, website_url = ?, documentation_url = ?,
    download_count = ?, recommended = ?, updated_at = ?
  WHERE slug = ?
`)
const findId = db.prepare('SELECT id FROM software WHERE slug = ?')
const insRelease = db.prepare(`
  INSERT INTO release (
    id, software_id, version, channel, platform, architecture, file_name, download_url,
    asset_id, size_bytes, sha256, mime, status, revision, published_at, created_at,
    price_cents, currency, sources, download_config_url
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET
    version = excluded.version,
    channel = excluded.channel,
    platform = excluded.platform,
    architecture = excluded.architecture,
    file_name = excluded.file_name,
    download_url = excluded.download_url,
    asset_id = excluded.asset_id,
    size_bytes = excluded.size_bytes,
    sha256 = excluded.sha256,
    mime = excluded.mime,
    status = excluded.status,
    published_at = excluded.published_at,
    price_cents = excluded.price_cents,
    currency = excluded.currency,
    sources = excluded.sources,
    download_config_url = excluded.download_config_url
`)

const now = new Date().toISOString()
let swUpdated = 0
let relInserted = 0
let skipped = 0

db.exec('BEGIN')
try {
  for (const [slug, entry] of Object.entries(details)) {
    const row = findId.get(slug)
    if (!row) {
      skipped++
      continue
    }
    const s = entry.software || {}
    updSoftware.run(
      s.summary ?? '',
      s.description ?? '',
      s.releaseNotes ?? '',
      s.usageInstructions ?? '',
      s.faq ?? '',
      s.githubUrl ?? '',
      s.websiteUrl ?? '',
      s.documentationUrl ?? '',
      Number(s.downloadCount) || 0,
      s.recommended ? 1 : 0,
      s.updatedAt || now,
      slug
    )
    swUpdated++

    for (const r of entry.releases || []) {
      if (!r || !r.id) continue
      insRelease.run(
        r.id,
        row.id,
        r.version ?? '',
        r.channel ?? 'stable',
        r.platform ?? '',
        r.architecture ?? '',
        r.fileName ?? '',
        pickDownloadUrl(r.sources),
        r.assetId ?? '',
        Number(r.sizeBytes) || 0,
        r.sha256 ?? '',
        r.mime ?? '',
        r.status === 'published' ? 'active' : (r.status ?? 'active'),
        Number(r.revision) || 1,
        r.publishedAt ?? null,
        r.createdAt ?? now,
        Number(r.priceCents) || 0,
        r.currency ?? 'CNY',
        JSON.stringify(stripSources(r.sources ?? [])),
        r.downloadConfigUrl ?? ''
      )
      relInserted++
    }
  }
  db.exec('COMMIT')
} catch (err) {
  db.exec('ROLLBACK')
  console.error('✗ 导入失败，已回滚：', err.message)
  process.exit(1)
}

const stat = db.prepare('SELECT count(*) c FROM release').get().c
const withRel = db.prepare('SELECT count(DISTINCT software_id) c FROM release').get().c
console.log(`✓ 更新软件 ${swUpdated} 条，写入版本记录 ${relInserted} 条${skipped ? `，跳过 ${skipped} 条（库中无此 slug）` : ''}`)
console.log(`  现库中：release 共 ${stat} 行，覆盖 ${withRel} 个软件`)
