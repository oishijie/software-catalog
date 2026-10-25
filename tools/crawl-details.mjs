// 抓取原站每个软件的详情页 payload（含 releases 版本记录）
// 原站对连续请求有限流，故串行 + 延时 + 多轮补齐，支持断点续传。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { stripSources } from './lib/normalize-sources.mjs'

const ORIGIN = 'https://apps.yuelili.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ROOT = process.cwd()
const CRAWL = join(ROOT, 'data/crawl')
const OUT = join(CRAWL, 'details.json')

const args = process.argv.slice(2)
const flag = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : d
}
const DELAY = Number(flag('delay', 900))
const LIMIT = Number(flag('limit', 0))
const ROUNDS = Number(flag('rounds', 4))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 解析 Nuxt 的 devalue 扁平数组 payload（数字均为索引） */
function parsePayload(html) {
  const m = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) throw new Error('页面中没有 payload')
  const arr = JSON.parse(m[1])
  const memo = new Map()
  function res(i) {
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= arr.length) return i
    if (memo.has(i)) return memo.get(i)
    const v = arr[i]
    let o
    if (Array.isArray(v)) {
      const t = v[0]
      if (t === 'ShallowReactive' || t === 'Reactive' || t === 'Ref' || t === 'ShallowRef') o = res(v[1])
      else if (t === 'null') o = null
      else if (t === 'undefined') o = undefined
      else o = v.map(res)
    } else if (v && typeof v === 'object') {
      o = {}
      for (const k of Object.keys(v)) o[k] = res(v[k])
    } else o = v
    memo.set(i, o)
    return o
  }
  return res(res(1).data)
}

async function fetchText(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(20000)
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.text()
    } catch (err) {
      if (i === tries - 1) throw err
      await sleep(800 * (i + 1))
    }
  }
}

const list = JSON.parse(readFileSync(join(CRAWL, 'software.json'), 'utf8'))
const slugs = list.map((s) => s.slug).filter(Boolean)
const store = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}

console.log(`▶ 目标 ${slugs.length} 个软件；已有 ${Object.keys(store).length} 个`)

let todo = slugs.filter((s) => !store[s] || !Array.isArray(store[s].releases) || !store[s].releases.length)
if (LIMIT) todo = todo.slice(0, LIMIT)
console.log(`▶ 本轮待抓 ${todo.length} 个（延时 ${DELAY}ms，最多 ${ROUNDS} 轮）`)

for (let round = 1; round <= ROUNDS; round++) {
  if (!todo.length) break
  const failed = []
  for (let i = 0; i < todo.length; i++) {
    const slug = todo[i]
    try {
      const html = await fetchText(`${ORIGIN}/software/${slug}`)
      const data = parsePayload(html)
      const block = data[`distribution-software-${slug}`]
      if (!block || !block.software) throw new Error('缺少数据块')
      store[slug] = { software: block.software, releases: block.releases || [] }
    } catch (err) {
      failed.push(slug)
    }
    const ok = Object.keys(store).length
    process.stdout.write(`\r  第 ${round} 轮 ${i + 1}/${todo.length} · 累计 ${ok} · 失败 ${failed.length}   `)
    await sleep(DELAY)
  }
  process.stdout.write('\n')
  todo = failed
  if (failed.length) {
    console.log(`  ⚠ 第 ${round} 轮失败 ${failed.length} 个，稍后重试`)
    await sleep(5000)
  }
}

mkdirSync(dirname(OUT), { recursive: true })

// 落盘前清洗：私有网盘不再收录；原站镜像条目丢弃，改由服务端按 Release 直链统一派生
let droppedSources = 0
for (const entry of Object.values(store)) {
  for (const r of entry.releases || []) {
    if (!Array.isArray(r.sources)) continue
    const kept = stripSources(r.sources)
    droppedSources += r.sources.length - kept.length
    r.sources = kept
  }
}

writeFileSync(OUT, JSON.stringify(store))
const withRel = Object.values(store).filter((v) => v.releases && v.releases.length).length
console.log(`✓ 写入 ${OUT}`)
console.log(`  已抓 ${Object.keys(store).length}/${slugs.length} 个，其中 ${withRel} 个带版本记录`)
if (droppedSources) console.log(`  已剔除 ${droppedSources} 条来源（私有网盘 / 上游镜像条目）`)
