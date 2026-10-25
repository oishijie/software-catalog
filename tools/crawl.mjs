#!/usr/bin/env node
/**
 * 抓取原站（apps.yuelili.com）的公开软件元数据。
 *
 * 用法：
 *   node tools/crawl.mjs                      # 列表 + 分类 + 站点配置
 *   node tools/crawl.mjs --with-icons         # 额外下载软件图标
 *   node tools/crawl.mjs --with-releases      # 额外抓取每个软件的版本记录（较慢）
 *   node tools/crawl.mjs --all                # 全部抓取
 *
 * 输出：data/crawl/software.json / categories.json / site-profile.json / filter-counts.json
 *      public/media/*.webp（--with-icons 时）
 */
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const ORIGIN = 'https://apps.yuelili.com'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const args = process.argv.slice(2)
const FLAGS = {
  icons: args.includes('--with-icons') || args.includes('--all'),
  releases: args.includes('--with-releases') || args.includes('--all'),
  concurrency: Number((args.find((a) => a.startsWith('--concurrency=')) || '').split('=')[1]) || 4,
  delay: Number((args.find((a) => a.startsWith('--delay=')) || '').split('=')[1]) || 800
}

const OUT_DIR = join(ROOT, 'data', 'crawl')
const MEDIA_DIR = join(ROOT, 'public', 'media')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ 抓取 */

async function fetchText(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(20000)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (err) {
      if (i === tries - 1) throw new Error(`抓取失败 ${url} :: ${err.message}`)
      await sleep(600 * (i + 1))
    }
  }
}

async function fetchBuffer(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'image/*' },
        signal: AbortSignal.timeout(15000)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      if (i === tries - 1) throw new Error(`抓取失败 ${url} :: ${err.message}`)
      await sleep(500 * (i + 1))
    }
  }
}

/**
 * 从渲染后的 HTML 里提取 slug → 图标地址 的映射。
 * 注意：图标地址里的文件 ID 既不是 software.id 也不是 iconAssetId，
 * 只能从 <img src="/media/…"> 里取。
 */
function extractIcons(html) {
  const map = {}
  const re =
    /<a href="\/software\/([^"/]+)"[^>]*class="[^"]*catalog-card[^"]*"[^>]*>([\s\S]*?)<\/a>/g
  let m
  while ((m = re.exec(html))) {
    const slug = m[1]
    const img = m[2].match(/<img[^>]+src="([^"]+)"/)
    if (img) map[slug] = img[1].replace(/&amp;/g, '&')
  }
  return map
}

/* ------------------------------------------------- Nuxt payload 反序列化 */

/**
 * Nuxt 的 __NUXT_DATA__ 是基于 devalue 的扁平数组：所有值都存在数组里，
 * 通过索引互相引用。下面按 devalue 的约定还原。
 */
export function parsePayload(html) {
  const m = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) throw new Error('页面中没有找到 Nuxt payload')
  const arr = JSON.parse(m[1])
  const memo = new Map()

  function res(i) {
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= arr.length) return i
    if (memo.has(i)) return memo.get(i)

    const v = arr[i]
    let out

    if (Array.isArray(v)) {
      const tag = v[0]
      if (tag === 'ShallowReactive' || tag === 'Reactive' || tag === 'Ref' || tag === 'ShallowRef') {
        out = res(v[1])
      } else if (tag === 'EmptyRef' || tag === 'EmptyShallowRef') {
        out = undefined
      } else if (tag === 'Date') {
        out = v[1]
      } else if (tag === 'Set') {
        out = v.slice(1).map(res)
      } else if (tag === 'Map') {
        out = {}
        for (let k = 1; k < v.length; k += 2) out[String(res(v[k]))] = res(v[k + 1])
      } else if (tag === 'null') {
        out = null
      } else if (tag === 'undefined') {
        out = undefined
      } else {
        out = v.map(res)
      }
    } else if (v && typeof v === 'object') {
      out = {}
      for (const k of Object.keys(v)) out[k] = res(v[k])
    } else {
      out = v
    }

    memo.set(i, out)
    return out
  }

  return res
}

function extractData(html) {
  const res = parsePayload(html)
  const root = res(1)
  return res(root.data)
}

/* -------------------------------------------------------------- 并发池 */

async function pool(items, limit, worker, onProgress) {
  const results = new Array(items.length)
  let cursor = 0
  let done = 0

  async function run() {
    while (cursor < items.length) {
      const idx = cursor++
      try {
        results[idx] = await worker(items[idx], idx)
      } catch (err) {
        results[idx] = { __error: err.message }
      }
      done++
      if (onProgress && (done % 10 === 0 || done === items.length)) onProgress(done, items.length)
      if (FLAGS.delay) await sleep(FLAGS.delay)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

/* ------------------------------------------------------------------ 主流程 */

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  if (FLAGS.icons) await mkdir(MEDIA_DIR, { recursive: true })

  console.log('▶ 抓取第 1 页以确定总数…')
  const firstHtml = await fetchText(`${ORIGIN}/software?page=1`)
  const first = extractData(firstHtml)
  const iconMap = extractIcons(firstHtml)
  const meta = first['distribution-software']
  const total = meta.total
  const size = meta.size
  const pages = Math.ceil(total / size)
  console.log(`  共 ${total} 条，每页 ${size}，需抓取 ${pages} 页`)

  const all = [...meta.items]

  // 原站会限流：并发或过快请求会得到重复页甚至空页。
  // 因此列表页串行 + 多轮补齐，并且每轮都与已有结果合并，跑多次可以逐步凑齐。
  const pageNums = Array.from({ length: pages }, (_, i) => i + 1)
  const byPage = new Map([[1, meta.items]])

  for (let round = 1; round <= 4; round++) {
    const targets = pageNums.filter((p) => !byPage.has(p))
    if (!targets.length) break
    if (round > 1) {
      const wait = 4000 * (round - 1)
      console.log(`\n  等待 ${wait / 1000}s 后重试 ${targets.length} 个缺失页…`)
      await sleep(wait)
    }
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i]
      try {
        const html = await fetchText(`${ORIGIN}/software?page=${p}`)
        const d = extractData(html)
        Object.assign(iconMap, extractIcons(html))
        const items = d['distribution-software']?.items ?? []
        if (!items.length) throw new Error('返回空页')
        byPage.set(p, items)
      } catch (err) {
        console.warn(`\n  ⚠ 第 ${p} 页抓取失败：${err.message}`)
      }
      process.stdout.write(`\r  列表页 ${i + 1}/${targets.length}（第 ${round} 轮）`)
      if (FLAGS.delay) await sleep(FLAGS.delay)
    }
    process.stdout.write('\n')
  }

  for (const [p, items] of byPage) {
    if (p === 1) continue
    all.push(...items)
  }

  // 与上一次的结果合并：原站限流时单次跑不满，跑多次可以逐步补齐
  const byId = new Map()
  const prevFile = join(OUT_DIR, 'software.json')
  if (existsSync(prevFile)) {
    try {
      const prev = JSON.parse(await readFile(prevFile, 'utf-8'))
      for (const s of prev) if (s && s.id) byId.set(s.id, s)
    } catch {
      /* 忽略损坏的旧文件 */
    }
  }
  for (const s of all) if (s && s.id) byId.set(s.id, s)

  // 图标映射同样累积，避免本轮没抓到的页丢掉 iconUrl
  const iconFile = join(OUT_DIR, 'icons.json')
  let iconIndex = {}
  if (existsSync(iconFile)) {
    try {
      iconIndex = JSON.parse(await readFile(iconFile, 'utf-8'))
    } catch {
      /* ignore */
    }
  }
  Object.assign(iconIndex, iconMap)
  await writeFile(iconFile, JSON.stringify(iconIndex, null, 2), 'utf-8')

  const software = [...byId.values()].map((s) => ({
    ...s,
    iconUrl: iconIndex[s.slug] || s.iconUrl || ''
  }))
  const withIconCount = software.filter((s) => s.iconUrl).length
  console.log(`✓ 软件元数据 ${software.length} 条，其中 ${withIconCount} 条带图标`)
  if (software.length < total) {
    console.warn(`  ⚠ 比站点声明的 ${total} 条少 ${total - software.length} 条，可重跑本脚本补齐`)
  }

  const categories = first['distribution-categories']?.items ?? []
  const filterCounts = first['distribution-catalog-filter-counts'] ?? null
  const profile = first['distribution-site-profile']?.snapshot ?? null

  await writeFile(join(OUT_DIR, 'software.json'), JSON.stringify(software, null, 2), 'utf-8')
  await writeFile(join(OUT_DIR, 'categories.json'), JSON.stringify(categories, null, 2), 'utf-8')
  await writeFile(join(OUT_DIR, 'filter-counts.json'), JSON.stringify(filterCounts, null, 2), 'utf-8')
  await writeFile(join(OUT_DIR, 'site-profile.json'), JSON.stringify(profile, null, 2), 'utf-8')
  await writeFile(
    join(OUT_DIR, 'crawl-meta.json'),
    JSON.stringify(
      { total, size, pages, crawledAt: new Date().toISOString(), origin: ORIGIN, counts: softwares(software) },
      null,
      2
    ),
    'utf-8'
  )
  console.log(`✓ 已写入 ${OUT_DIR}`)

  /* --------------------------------------------------------- 图标下载 */
  if (FLAGS.icons) {
    const withIcon = software.filter((s) => s.iconUrl)
    console.log(`▶ 下载 ${withIcon.length} 个软件图标…`)
    const results = await pool(
      withIcon,
      FLAGS.concurrency,
      async (s) => {
        const fileId = (s.iconUrl.match(/\/media\/([^?]+)/) || [])[1]
        if (!fileId) throw new Error('无法解析图标文件名')
        const file = join(MEDIA_DIR, `${fileId}.webp`)
        if (existsSync(file)) {
          const st = await stat(file)
          if (st.size > 0) return { id: fileId, skipped: true }
        }
        const buf = await fetchBuffer(`${ORIGIN}${s.iconUrl}`)
        await writeFile(file, buf)
        return { id: fileId, bytes: buf.length }
      },
      (done, len) => process.stdout.write(`\r  图标进度 ${done}/${len}`)
    )
    process.stdout.write('\n')
    const ok = results.filter((r) => r && !r.__error).length
    const failed = results.filter((r) => r && r.__error)
    console.log(`✓ 图标完成 ${ok}/${withIcon.length}${failed.length ? `，失败 ${failed.length}` : ''}`)
  }

  /* ------------------------------------------------------- 版本记录 */
  if (FLAGS.releases) {
    console.log(`▶ 抓取 ${software.length} 个软件的版本记录…`)
    const releases = await pool(
      software,
      FLAGS.concurrency,
      async (s) => {
        const html = await fetchText(`${ORIGIN}/software/${s.slug}`)
        const d = extractData(html)
        const block = d[`distribution-software-${s.slug}`] || d[`distribution-software-${s.slug.replace(/-/g, '_')}`]
        return { slug: s.slug, releases: block?.releases ?? [] }
      },
      (done, len) => process.stdout.write(`\r  版本进度 ${done}/${len}`)
    )
    process.stdout.write('\n')
    const flat = releases.filter((r) => r && !r.__error)
    await writeFile(join(OUT_DIR, 'releases.json'), JSON.stringify(flat, null, 2), 'utf-8')
    const count = flat.reduce((n, r) => n + (r.releases?.length ?? 0), 0)
    console.log(`✓ 版本记录 ${count} 条（${flat.length} 个软件）`)
  }

  console.log('\n完成。下一步：node tools/import-json.mjs')
}

function softwares(list) {
  const platforms = {}
  for (const s of list) {
    for (const p of s.platforms ?? []) platforms[p] = (platforms[p] ?? 0) + 1
  }
  return { total: list.length, platforms }
}

main().catch((err) => {
  console.error('\n✗ 抓取失败：', err.message)
  process.exit(1)
})
