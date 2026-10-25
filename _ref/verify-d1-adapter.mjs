/**
 * 验证 D1 适配分支。
 *
 * 思路：db.ts 通过全局 useEvent() 取 Cloudflare 绑定。这里在 globalThis 上挂一个
 * useEvent，返回的 D1 对象由 node:sqlite 真实驱动 —— 于是 D1 适配器的 .bind/.all/first/run
 * 四条分支都用真 SQL 引擎跑一遍，而不是空壳 mock。
 */
import ts from 'typescript'
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const TMP = resolve(process.cwd(), '_ref/tmp-d1')
const TEST_DB = resolve(process.cwd(), '_ref/tmp-d1-test.db')

rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
for (const f of ['tmp-d1-test.db', 'tmp-d1-test.db-wal', 'tmp-d1-test.db-shm']) {
  try {
    rmSync(resolve(process.cwd(), '_ref', f), { force: true })
  } catch {
    /* 上轮句柄未释放 */
  }
}
copyFileSync(resolve(process.cwd(), 'data/catalog.db'), TEST_DB)

for (const f of ['db', 'download-sources', 'repo']) {
  const src = readFileSync(resolve(process.cwd(), `server/utils/${f}.ts`), 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext }
  }).outputText
  writeFileSync(join(TMP, `${f}.js`), out.replace(/from ['"]\.\/([a-z0-9-]+)['"]/g, "from './$1.js'"))
}

/* ---- 用真实 SQL 引擎实现 Cloudflare D1 的接口形状 ---- */
const sqlEngine = new DatabaseSync(TEST_DB)
let bindCount = 0
let undefinedSeen = 0

const mockD1 = {
  prepare(sql) {
    let args = []
    return {
      bind(...a) {
        bindCount++
        undefinedSeen += a.filter((v) => v === undefined).length
        args = a
        return this
      },
      async all() {
        return { results: sqlEngine.prepare(sql).all(...args), success: true, meta: {} }
      },
      async first() {
        return sqlEngine.prepare(sql).get(...args) ?? null
      },
      async run() {
        const r = sqlEngine.prepare(sql).run(...args)
        return { success: true, meta: { changes: Number(r.changes ?? 0), last_row_id: Number(r.lastInsertRowid ?? 0) } }
      }
    }
  }
}

// 关键一步：让 db.ts 认为当前运行在 Cloudflare 请求上下文里
globalThis.useEvent = () => ({ context: { cloudflare: { env: { DB: mockD1 } } } })

const repo = await import(`file://${join(TMP, 'repo.js')}`)
const dbmod = await import(`file://${join(TMP, 'db.js')}`)

let failed = 0
const check = (label, cond, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label.padEnd(24)} ${detail}`)
  if (!cond) failed++
}

console.log('\n[D1 分支]')
check('usingD1() 应识别为 true', dbmod.usingD1() === true, `usingD1() = ${dbmod.usingD1()}`)

const cats = await repo.listCategories()
check('listCategories', cats.length === 17, `${cats.length} 个`)

const page = await repo.listSoftware({ page: 2, size: 5, sortBy: 'name' })
check('listSoftware(分页+排序)', page.items.length === 5 && page.page === 2, `page=${page.page} total=${page.total}`)

const sw = await repo.getSoftwareBySlug('ffmpeg')
check('getSoftwareBySlug', sw?.slug === 'ffmpeg', sw?.name)

const miss = await repo.getSoftwareBySlug('__no_such_slug__')
check('first() 无结果应返回 null', miss === null, String(miss))

const rel = await repo.listReleases(sw.id)
check('listReleases', rel.length > 0, `${rel.length} 个版本`)

const idx = await repo.listCatalogIndex()
check('listCatalogIndex', idx.length === 519, `${idx.length} 行`)

const counts = await repo.catalogFilterCounts()
check('catalogFilterCounts', counts.all === 519, `all=${counts.all} 平台=${Object.keys(counts.platforms).length}`)

const kw = await repo.listSoftware({ q: 'ffmpeg', page: 1, size: 3 })
check('LIKE 搜索', kw.items.length > 0, `${kw.items.length} 条命中`)

const plat = await repo.listSoftware({ platform: 'macos', page: 1, size: 3 })
check('platform LIKE 过滤', plat.items.every((i) => i.platforms.includes('macos')), `${plat.items.length} 条`)

const related = await repo.relatedSoftware(sw, 4)
check('relatedSoftware', related.length === 4, `${related.length} 个`)

console.log('\n[D1 写路径 · 副本]')
const created = await repo.upsertSoftware({ name: 'ZZ-d1-temp', slug: 'zz-d1-temp', platforms: ['windows'] })
check('insert 软件', created.slug === 'zz-d1-temp', created.id.slice(0, 8))
const upd = await repo.upsertSoftware({ id: created.id, name: 'ZZ-d1-temp-2' })
check('update 软件(revision++)', upd.revision === 2, `revision=${upd.revision}`)

// 传 undefined 的参数必须被折叠成 null，否则 D1 会直接报错
await repo.upsertRelease({ softwareId: created.id, version: '1.0.0', publishedAt: undefined })
const rels = await repo.listReleases(created.id)
check('undefined 参数折叠', rels.length === 1, `写入 ${rels.length} 条，undefined 出现次数 ${undefinedSeen}`)

await repo.incrementDownload('zz-d1-temp')
check('incrementDownload', (await repo.getSoftwareBySlug('zz-d1-temp')).downloadCount === 1, 'count=1')

await repo.deleteRelease(rels[0].id)
await repo.deleteSoftware(created.id)
check('删除软件及其版本', (await repo.getSoftwareBySlug('zz-d1-temp')) === null, `${(await repo.listReleases(created.id)).length} 个残留版本`)

const profBefore = await repo.getSiteProfile()
await repo.setSiteProfile({ brand: 'ZZ', n: 1 })
const profAfter = await repo.getSiteProfile()
await repo.setSiteProfile(profBefore ?? {})
check('setSiteProfile(revision++)', profAfter.revision === (profBefore?.revision ?? 0) + 1, `revision=${profAfter.revision}`)

check('bind() 被调用', bindCount > 20, `${bindCount} 次`)

sqlEngine.close()
for (const f of ['tmp-d1-test.db', 'tmp-d1-test.db-wal', 'tmp-d1-test.db-shm']) {
  try {
    rmSync(resolve(process.cwd(), '_ref', f), { force: true })
  } catch {
    /* 忽略 */
  }
}
try {
  rmSync(TMP, { recursive: true, force: true })
} catch {
  /* 忽略 */
}

console.log(`\n失败项：${failed}\n`)
process.exit(failed ? 1 : 0)
