#!/usr/bin/env node
/**
 * 只补下缺失的图标，不重新抓列表页。
 * 用法：node tools/fetch-icons.mjs
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

const MEDIA_DIR = join(ROOT, 'public', 'media')
const softwareFile = join(ROOT, 'data', 'crawl', 'software.json')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const list = JSON.parse(await readFile(softwareFile, 'utf-8'))
await mkdir(MEDIA_DIR, { recursive: true })

const missing = []
for (const s of list) {
  const fileId = (String(s.iconUrl || '').match(/\/media\/([^?]+)/) || [])[1]
  if (!fileId) continue
  const file = join(MEDIA_DIR, `${fileId}.webp`)
  if (existsSync(file)) {
    const st = await stat(file)
    if (st.size > 0) continue
  }
  missing.push({ slug: s.slug, fileId })
}

if (!missing.length) {
  console.log('✓ 所有图标都已存在')
  process.exit(0)
}

console.log(`▶ 需要补下 ${missing.length} 个图标`)

let ok = 0
let failed = 0
for (const item of missing) {
  const url = `${ORIGIN}/media/${item.fileId}?format=webp&preset=logo&v=1`
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'image/*' },
      signal: AbortSignal.timeout(15000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(join(MEDIA_DIR, `${item.fileId}.webp`), buf)
    ok++
  } catch (err) {
    failed++
    console.warn(`  ⚠ ${item.slug} 失败：${err.message}`)
  }
  await sleep(150)
}

console.log(`✓ 补下完成：成功 ${ok}，失败 ${failed}`)
