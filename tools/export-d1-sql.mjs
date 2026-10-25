/**
 * 把本地 data/catalog.db 的内容导出成可喂给 Cloudflare D1 的 SQL 脚本。
 *
 *   node tools/export-d1-sql.mjs
 *
 * 产物：data/d1/NN-<table>.sql，每个文件恰含一条 INSERT 语句（≤90 KB，避开 D1 的
 * 100 KB 单语句上限），幂等（INSERT OR REPLACE），可用任意顺序重复执行。
 * 执行顺序需按文件名序号：先 category，再 software，最后 release。
 *
 * 之后逐文件执行：
 *   npx wrangler d1 execute software-catalog-db --remote --file=data/d1/01-category.sql
 *   ...
 */
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DB_FILE = resolve(process.cwd(), process.env.CATALOG_DB || 'data/catalog.db')
const OUT_DIR = resolve(process.cwd(), 'data/d1')
/**
 * 单条 INSERT 语句的字节上限。
 * Cloudflare D1 硬限制单条 SQL 语句 ≤ 100 KB，超出即报
 * `statement too long: SQLITE_TOOBIG`；而 `wrangler d1 execute --file=`
 * 会把整个文件作为一条语句提交，所以每个分片文件都必须小于该阈值。
 * 这里取 90 KB，为语句前缀和转义留出余量。
 */
const MAX_BATCH_BYTES = 90_000

/** 导出顺序即外键依赖顺序 */
const TABLES = [
  { name: 'category', orderBy: 'id' },
  { name: 'software', orderBy: 'id' },
  { name: 'release', orderBy: 'id' },
  { name: 'site_profile', orderBy: 'id' },
  { name: 'crawl_log', orderBy: 'key' }
]

/** SQL 字面量转义：单引号翻倍，其余按类型直出 */
function literal(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'bigint') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  return `'${String(v).replace(/'/g, "''")}'`
}

if (!existsSync(DB_FILE)) {
  console.error(`✗ 找不到数据库：${DB_FILE}`)
  process.exit(1)
}

// 每次重新生成，避免旧分块残留
if (existsSync(OUT_DIR)) {
  for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith('.sql')) rmSync(join(OUT_DIR, f))
  }
}
mkdirSync(OUT_DIR, { recursive: true })

const db = new DatabaseSync(DB_FILE, { readOnly: true })
const summary = []
let seq = 0

for (const table of TABLES) {
  let rows
  try {
    rows = db.prepare(`SELECT * FROM ${table.name} ORDER BY ${table.orderBy}`).all()
  } catch (err) {
    console.warn(`  ! 跳过 ${table.name}：${err.message}`)
    continue
  }
  if (!rows.length) {
    console.log(`  - ${table.name}：无数据，跳过`)
    continue
  }

  const cols = Object.keys(rows[0])
  const prefix = `INSERT OR REPLACE INTO ${table.name} (${cols.join(', ')}) VALUES `

  let batch = []
  let batchBytes = 0
  const batches = []

  // 语句总长按 UTF-8 字节计：D1 的 100 KB 上限以字节为准，
  // 中文约占 3 字节/字，用字符串 length（字符数）会严重低估。
  const OVERHEAD = Buffer.byteLength(prefix, 'utf8') + 2
  let oversized = 0

  for (const row of rows) {
    const tuple = `(${cols.map((c) => literal(row[c])).join(', ')})`
    const tupleBytes = Buffer.byteLength(tuple, 'utf8')
    if (tupleBytes + OVERHEAD > MAX_BATCH_BYTES) {
      oversized += 1
      console.warn(
        `  ! ${table.name} 有一行 ${tupleBytes} 字节，单行即逼近 D1 单语句上限`
      )
    }
    if (batch.length && batchBytes + tupleBytes + 1 + OVERHEAD > MAX_BATCH_BYTES) {
      batches.push(batch)
      batch = []
      batchBytes = 0
    }
    batch.push(tuple)
    batchBytes += tupleBytes + 1
  }
  if (batch.length) batches.push(batch)

  batches.forEach((tuples, i) => {
    seq += 1
    const no = String(seq).padStart(2, '0')
    const file = join(OUT_DIR, `${no}-${table.name}.sql`)
    const head =
      `-- ${table.name}：第 ${i + 1}/${batches.length} 批，共 ${tuples.length} 行\n` +
      `-- 由 tools/export-d1-sql.mjs 生成，幂等（INSERT OR REPLACE）\n\n`
    writeFileSync(file, head + prefix + tuples.join(', ') + ';\n')
    const bytes = tuples.reduce((n, t) => n + Buffer.byteLength(t, 'utf8') + 1, 0)
    summary.push({ file: `${no}-${table.name}.sql`, rows: tuples.length, bytes })
  })

  console.log(`  · ${table.name}：${rows.length} 行 → ${batches.length} 批`)
}

db.close()

console.log('\n产物目录：data/d1/')
let total = 0
for (const s of summary) {
  total += s.bytes
  console.log(`  ${s.file.padEnd(24)} ${String(s.rows).padStart(5)} 行  ${(s.bytes / 1024).toFixed(0)} KB`)
}
console.log(`  合计 ${summary.length} 个文件，${(total / 1024 / 1024).toFixed(2)} MB\n`)

console.log('依次执行（顺序不可颠倒，先建表再灌数据）：')
console.log('  npx wrangler d1 execute software-catalog-db --remote --file=data/schema-d1.sql')
for (const s of summary) {
  console.log(`  npx wrangler d1 execute software-catalog-db --remote --file=data/d1/${s.file}`)
}
