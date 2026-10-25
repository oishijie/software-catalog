/**
 * 只读诊断：解析一组 WebP 的像素尺寸与体积分布，用于评估压缩空间。
 *   node _ref/img-size.mjs dist/media
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] || 'dist/media'

/** 从 WebP 容器里取出宽高（支持 VP8 / VP8L / VP8X 三种块） */
function dims(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null
  let off = 12
  while (off + 8 <= buf.length) {
    const fourcc = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (fourcc === 'VP8X') {
      // payload: flags(1) + reserved(3) + canvasW-1(3) + canvasH-1(3)
      return {
        w: 1 + buf.readUIntLE(off + 12, 3),
        h: 1 + buf.readUIntLE(off + 15, 3),
        type: 'VP8X'
      }
    }
    if (fourcc === 'VP8 ') {
      const p = off + 8 + 6
      return {
        w: buf.readUInt16LE(p) & 0x3fff,
        h: buf.readUInt16LE(p + 2) & 0x3fff,
        type: 'VP8'
      }
    }
    if (fourcc === 'VP8L') {
      if (buf[off + 8] !== 0x2f) return null
      const bits = buf.readUInt32LE(off + 9)
      return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >> 14) & 0x3fff), type: 'VP8L' }
    }
    off += 8 + size + (size & 1)
  }
  return null
}

const files = readdirSync(dir).filter((f) => /\.webp$/i.test(f))
const bySize = new Map()
const byType = new Map()
let total = 0
let unknown = 0

for (const f of files) {
  const buf = readFileSync(join(dir, f))
  total += buf.length
  const d = dims(buf)
  if (!d) {
    unknown++
    continue
  }
  const k = `${d.w}x${d.h}`
  const e = bySize.get(k) || { n: 0, bytes: 0 }
  e.n++
  e.bytes += buf.length
  bySize.set(k, e)
  byType.set(d.type, (byType.get(d.type) || 0) + 1)
}

console.log(`目录：${dir}`)
console.log(`文件数 ${files.length} · 合计 ${(total / 1048576).toFixed(1)} MB · 平均 ${(total / files.length / 1024).toFixed(0)} KB\n`)

console.log('按像素尺寸分组（降序）：')
for (const [k, v] of [...bySize.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log(
    `  ${k.padEnd(12)} ${String(v.n).padStart(4)} 个  ${(v.bytes / 1048576).toFixed(1).padStart(6)} MB  平均 ${(v.bytes / v.n / 1024).toFixed(0).padStart(4)} KB`
  )
}
console.log('\n编码类型：', [...byType.entries()].map(([k, v]) => `${k}×${v}`).join('  '))
if (unknown) console.log(`未能解析：${unknown} 个`)
