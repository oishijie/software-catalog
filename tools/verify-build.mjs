#!/usr/bin/env node
/**
 * 校验 Cloudflare Pages 构建产物（nuxt build + cloudflare-pages preset）。
 * 纯只读：不启动任何服务、不修改任何文件。
 *
 *   npx nuxt build
 *   node tools/verify-build.mjs
 */
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
/**
 * cloudflare-pages 预设的输出目录是 ./dist —— _worker.js 与静态资源同处一层。
 * （Node 预设才会输出到 .output/public，那是纯静态化时期的产物，已不适用。）
 */
const OUT = join(ROOT, 'dist')
const SERVER = join(ROOT, '.output', 'server')

/* Cloudflare Pages 限额（免费档） */
const CF_MAX_FILE = 25 * 1024 * 1024
const CF_MAX_FILES = 20000

let fail = 0
let warn = 0
const ok = (m) => console.log(`  ✓ ${m}`)
const bad = (m) => {
  fail++
  console.log(`  ✗ ${m}`)
}
const soft = (m) => {
  warn++
  console.log(`  ! ${m}`)
}
const head = (m) => console.log(`\n${m}`)
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`

if (!existsSync(OUT)) {
  console.error('\n✗ 未找到 dist 目录')
  console.error('  请先执行：pnpm build（cloudflare-pages 预设）\n')
  process.exit(1)
}

/* ------------------------------------------------------- 1. 产物结构 */
head('【1】产物结构')

if (!existsSync(OUT)) bad(`缺少 ${relative(ROOT, OUT)}`)
else ok(`${relative(ROOT, OUT)} 存在`)

if (!existsSync(SERVER)) soft(`缺少 ${relative(ROOT, SERVER)}（cloudflare-pages 会把它并入 _worker.js，可能正常）`)
else ok(`${relative(ROOT, SERVER)} 存在`)

// cloudflare-pages preset 的核心产物：Pages 的 Advanced Mode 入口
const workerFile = join(OUT, '_worker.js')
const workerDirEntry = join(OUT, '_worker.js', 'index.js')
let workerPath = ''
if (existsSync(workerFile) && statSync(workerFile).isFile()) workerPath = workerFile
else if (existsSync(workerDirEntry)) workerPath = workerDirEntry

if (!workerPath) {
  bad('缺少 _worker.js —— 这说明构建没用 cloudflare-pages 预设')
  console.log('     检查 nuxt.config.ts 的 nitro.preset，或构建时是否被 NITRO_PRESET 覆盖')
} else {
  const size = statSync(workerPath).size
  ok(`_worker.js 已生成（${mb(size)}）`)
  if (size > CF_MAX_FILE) bad('_worker.js 超过 25 MiB，会被 Cloudflare 拒绝')
}

/* --------------------------------------------- 2. 工作线程装配正确性 */
head('【2】工作线程装配')

if (workerPath) {
  const code = readFileSync(workerPath, 'utf8')

  // D1 绑定是通过请求上下文读取的，产物里必须能找到这条链路
  if (/cloudflare/.test(code)) ok('产物引用了 cloudflare 请求上下文')
  else bad('产物里找不到 cloudflare 上下文引用，D1 绑定大概率取不到')

  if (/"DB"|'DB'|\bDB\b/.test(code)) soft('产物中出现 DB 字样（无法据此确认绑定名，部署后请实测接口）')

  // node:sqlite 不应出现在边缘执行路径里
  const sqliteHits = (code.match(/node:sqlite/g) || []).length
  if (sqliteHits) soft(`产物中残留 ${sqliteHits} 处 node:sqlite（应为惰性分支，边缘不会执行）`)

  if (/admin_token|x-admin-token/.test(code)) ok('后台鉴权逻辑已打包')
  else soft('产物里未发现后台鉴权代码，确认 /admin 是否仍需要')
}

/* ---------------------------------------------------- 3. D1 准备度 */
head('【3】D1 准备度')

const wranglerFile = ['wrangler.jsonc', 'wrangler.json', 'wrangler.toml'].find((f) =>
  existsSync(join(ROOT, f))
)
if (!wranglerFile) {
  bad('缺少 wrangler 配置文件（Pages 需要它来绑定 D1）')
} else {
  const raw = readFileSync(join(ROOT, wranglerFile), 'utf8')
  ok(`找到 ${wranglerFile}`)

  if (/pages_build_output_dir/.test(raw)) ok('已声明 pages_build_output_dir')
  else bad('缺少 pages_build_output_dir，Pages Direct Upload 无法据此部署')

  if (/d1_databases/.test(raw)) ok('已声明 d1_databases 绑定')
  else bad('未声明 d1_databases，线上接口会拿不到数据库')

  if (/REPLACE_WITH_D1_DATABASE_ID|database_id\s*[:=]\s*["']?\s*["']/.test(raw)) {
    bad('database_id 尚未填写 —— 先跑 wrangler d1 create，把返回的 ID 填进去')
  } else {
    ok('database_id 已填写')
  }

  if (/nodejs_compat/.test(raw)) ok('已启用 nodejs_compat')
  else bad('缺少 compatibility_flags: ["nodejs_compat"]')
}

if (!existsSync(join(ROOT, 'data', 'schema-d1.sql'))) {
  bad('缺少 data/schema-d1.sql（D1 建表脚本）')
} else ok('data/schema-d1.sql 存在')

const d1Dir = join(ROOT, 'data', 'd1')
if (!existsSync(d1Dir)) {
  soft('未找到 data/d1/（尚未导出数据，跑 node tools/export-d1-sql.mjs）')
} else {
  const seeds = readdirSync(d1Dir).filter((f) => f.endsWith('.sql'))
  const bytes = seeds.reduce((n, f) => n + statSync(join(d1Dir, f)).size, 0)
  if (seeds.length) ok(`data/d1/ 有 ${seeds.length} 个数据分片（${mb(bytes)}）`)
  else soft('data/d1/ 为空，需要重新导出')
}

/* ------------------------------------------------------- 4. 静态资源 */
head('【4】静态资源')

const srcMedia = join(ROOT, 'public', 'media')
const outMedia = join(OUT, 'media')
if (!existsSync(outMedia)) bad('产物缺少 media/（图标会全部裂图）')
else {
  const n = readdirSync(outMedia).length
  const srcN = existsSync(srcMedia) ? readdirSync(srcMedia).length : 0
  if (srcN && n >= srcN) ok(`${n} 个图标已随产物输出`)
  else soft(`产物图标 ${n} 个，源目录 ${srcN} 个，可能有遗漏`)
}

if (existsSync(join(OUT, '_nuxt'))) ok('客户端构建产物 _nuxt/ 存在')
else bad('缺少 _nuxt/，前端资源未打包')

/* ------------------------------------------------ 5. 文件数与体积 */
head('【5】Cloudflare 限额')

const allFiles = []
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else allFiles.push(p)
  }
}
walk(OUT)

const totalBytes = allFiles.reduce((n, f) => n + statSync(f).size, 0)
console.log(`  文件总数 ${allFiles.length} · 总体积 ${mb(totalBytes)}`)
if (allFiles.length <= CF_MAX_FILES) ok(`文件数在免费额度内（${allFiles.length} / ${CF_MAX_FILES}）`)
else bad(`文件数超限（${allFiles.length} / ${CF_MAX_FILES}）`)

const oversized = allFiles.filter((f) => statSync(f).size > CF_MAX_FILE)
if (!oversized.length) ok('无单文件超过 25 MiB')
else bad(`${oversized.length} 个文件超 25 MiB：${oversized.slice(0, 3).map((f) => relative(OUT, f)).join(', ')}`)

head('【体积 Top 5】')
for (const t of allFiles
  .map((f) => ({ f: relative(OUT, f).split(sep).join('/'), s: statSync(f).size }))
  .sort((a, b) => b.s - a.s)
  .slice(0, 5)) {
  console.log(`  ${(t.s / 1024).toFixed(0).padStart(6)} KB  ${t.f}`)
}

/* ------------------------------------------------------------ 结论 */
head('【结论】')
if (fail) {
  console.error(`  ✗ ${fail} 项未通过，${warn} 项提醒 —— 建议修复后再部署。\n`)
  process.exit(1)
}
console.log(`  ✓ 全部检查通过${warn ? `（${warn} 项提醒）` : ''} —— 可以部署：`)
console.log('      npx wrangler pages deploy\n')
console.log('  部署后必测（本地代理会让 pages.dev 出现 522 假象，务必加 --noproxy）：')
console.log('      curl -s --noproxy \'*\' -X POST -H "Content-Type: application/json" \\')
console.log('        -d \'{"token":"<你的令牌>"}\' https://<项目>.pages.dev/api/admin/login\n')
