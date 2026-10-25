/**
 * 异步化改造的端到端验证（只读真实库 + 副本上跑写路径）。
 * 把 server/utils 下改动的 TS 转译到临时目录，在纯 Node 里实际调用仓库层。
 */
import ts from 'typescript'
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const TMP = resolve(process.cwd(), '_ref/tmp-server')
const TEST_DB = resolve(process.cwd(), '_ref/tmp-test.db')

rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
for (const f of ['tmp-test.db', 'tmp-test.db-wal', 'tmp-test.db-shm']) {
  rmSync(resolve(process.cwd(), '_ref', f), { force: true })
}
copyFileSync(resolve(process.cwd(), 'data/catalog.db'), TEST_DB)

// 让 db.ts 走副本，绝不碰真实库
process.env.CATALOG_DB = TEST_DB

for (const f of ['db', 'download-sources', 'repo']) {
  const src = readFileSync(resolve(process.cwd(), `server/utils/${f}.ts`), 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext }
  }).outputText
  // Node ESM 要求显式扩展名
  const fixed = out.replace(/from ['"]\.\/([a-z0-9-]+)['"]/g, "from './$1.js'")
  writeFileSync(join(TMP, `${f}.js`), fixed)
}

const repo = await import(`file://${join(TMP, 'repo.js')}`)

const log = (label, value) => console.log(`  ${label.padEnd(20)} ${value}`)
let failed = 0
const check = (label, cond, detail = '') => {
  if (cond) log(`✓ ${label}`, detail)
  else {
    failed++
    log(`✗ ${label}`, detail)
  }
}

console.log('\n[读路径]')
const cats = await repo.listCategories()
check('listCategories', cats.length === 17, `${cats.length} 个分类`)
const page = await repo.listSoftware({ page: 1, size: 5 })
check('listSoftware', page.items.length === 5 && page.total > 500, `${page.items.length} 条 / 共 ${page.total}`)
const sw = await repo.getSoftwareBySlug('ffmpeg')
check('getSoftwareBySlug', !!sw && sw.slug === 'ffmpeg', sw ? `${sw.name} · 平台 ${sw.platforms.join('/')}` : 'null')
const rel = await repo.listReleases(sw.id)
check(
  'listReleases',
  rel.length > 0 && Array.isArray(rel[0].sources),
  `${rel.length} 个版本，首个来源 ${rel[0]?.sources?.length ?? 0} 条`
)
const mirrorKinds = new Set()
for (const r of rel) for (const s of r.sources) mirrorKinds.add(s.kind)
check('sources 规范化', !mirrorKinds.has('cloud_drive'), `kind = ${[...mirrorKinds].join(', ')}`)
const idx = await repo.listCatalogIndex()
check('listCatalogIndex', idx.length > 500, `${idx.length} 行`)
const counts = await repo.catalogFilterCounts()
check(
  'catalogFilterCounts',
  counts.all === idx.length && Object.keys(counts.categories).length > 10,
  `all=${counts.all} 分类=${Object.keys(counts.categories).length} 平台=${Object.keys(counts.platforms).length}`
)
const related = await repo.relatedSoftware(sw, 4)
check('relatedSoftware', related.length === 4, `${related.length} 个`)
const prof = await repo.getSiteProfile()
check('getSiteProfile', prof !== undefined, prof ? '有配置' : '空（表内无记录）')

console.log('\n[写路径 · 在副本上]')
const created = await repo.upsertSoftware({
  name: 'ZZ-verify-temp',
  slug: 'zz-verify-temp',
  platforms: ['windows']
})
check('upsertSoftware(insert)', created.slug === 'zz-verify-temp' && created.revision === 1, created.id.slice(0, 8))
const updated = await repo.upsertSoftware({ id: created.id, name: 'ZZ-verify-temp-2' })
check('upsertSoftware(update)', updated.name === 'ZZ-verify-temp-2' && updated.revision === 2, `revision=${updated.revision}`)
await repo.incrementDownload('zz-verify-temp')
const after = await repo.getSoftwareBySlug('zz-verify-temp')
check('incrementDownload', after.downloadCount === 1, `download_count=${after.downloadCount}`)
const r = await repo.upsertRelease({ softwareId: created.id, version: '1.0.0', platform: 'windows' })
check('upsertRelease(insert)', r.version === '1.0.0', r.id.slice(0, 8))
const r2 = await repo.upsertRelease({ id: r.id, softwareId: created.id, version: '1.0.1' })
check('upsertRelease(update)', r2.version === '1.0.1', `version=${r2.version}`)
await repo.deleteRelease(r.id)
check('deleteRelease', (await repo.listReleases(created.id)).length === 0)
const cat = await repo.upsertCategory({ name: 'ZZ验证分类', slug: 'zz-verify-cat' })
check('upsertCategory', !!cat.id, cat.slug)
await repo.deleteCategory(cat.id)
check('deleteCategory', (await repo.getCategory(cat.slug)) === null)
await repo.deleteSoftware(created.id)
check('deleteSoftware', (await repo.getSoftwareBySlug('zz-verify-temp')) === null)

console.log('\n[环境判定]')
const dbmod = await import(`file://${join(TMP, 'db.js')}`)
// 关键：没有请求上下文时（本地 dev / 构建期预渲染）必须回退到 SQLite
check('usingD1() 本地应为 false', dbmod.usingD1() === false, `usingD1() = ${dbmod.usingD1()}`)

// 清理（SQLite 句柄随进程退出释放，这里容忍占用）
for (const f of ['tmp-test.db', 'tmp-test.db-wal', 'tmp-test.db-shm']) {
  try {
    rmSync(resolve(process.cwd(), '_ref', f), { force: true })
  } catch {
    /* 文件句柄未释放，留待下次运行前清理 */
  }
}
try {
  rmSync(TMP, { recursive: true, force: true })
} catch {
  /* 同上 */
}
console.log(`\n失败项：${failed}\n`)
process.exit(failed ? 1 : 0)
