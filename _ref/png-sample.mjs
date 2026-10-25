// 极简 PNG 解码采样器（无依赖）：用于精确读取截图关键点颜色
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const file = process.argv[2]
const buf = readFileSync(file)
let off = 8
let w = 0, h = 0, bitDepth = 8, colorType = 6
const idat = []
while (off < buf.length - 8) {
  const len = buf.readUInt32BE(off)
  const type = buf.toString('ascii', off + 4, off + 8)
  const data = buf.subarray(off + 8, off + 8 + len)
  if (type === 'IHDR') {
    w = data.readUInt32BE(0); h = data.readUInt32BE(4)
    bitDepth = data[8]; colorType = data[9]
  } else if (type === 'IDAT') idat.push(data)
  else if (type === 'IEND') break
  off += 12 + len
}
const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1
console.log(`# ${file}\n# ${w}x${h} depth=${bitDepth} colorType=${colorType} channels=${ch}`)
const raw = inflateSync(Buffer.concat(idat))
const stride = w * ch
const out = Buffer.alloc(stride * h)
let prev = Buffer.alloc(stride)
for (let y = 0; y < h; y++) {
  const ft = raw[y * (stride + 1)]
  const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
  const cur = Buffer.alloc(stride)
  for (let x = 0; x < stride; x++) {
    const a = x >= ch ? cur[x - ch] : 0
    const b = prev[x]
    const c = x >= ch ? prev[x - ch] : 0
    let v = line[x]
    if (ft === 1) v = (v + a) & 255
    else if (ft === 2) v = (v + b) & 255
    else if (ft === 3) v = (v + ((a + b) >> 1)) & 255
    else if (ft === 4) {
      const p = a + b - c
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255
    }
    cur[x] = v
  }
  cur.copy(out, y * stride)
  prev = cur
}
const px = (x, y) => {
  const i = y * stride + x * ch
  return '#' + [out[i], out[i + 1], out[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')
}
const args = process.argv.slice(3)
if (args[0] === '--scanv') {
  const x = Number(args[1]), from = Number(args[2]), to = Number(args[3]), step = Number(args[4] || 2)
  let last = ''
  for (let y = from; y <= to; y += step) {
    const c = px(x, y)
    if (c !== last) { console.log(`y=${String(y).padStart(4)}  ${c}`); last = c }
  }
} else if (args[0] === '--scanh') {
  const y = Number(args[1]), from = Number(args[2]), to = Number(args[3]), step = Number(args[4] || 4)
  let last = ''
  for (let x = from; x <= to; x += step) {
    const c = px(x, y)
    if (c !== last) { console.log(`x=${String(x).padStart(4)}  ${c}`); last = c }
  }
} else {
  const pts = JSON.parse(args[0] || '[]')
  for (const p of pts) console.log(`${(p.n || '').padEnd(24)} (${p.x},${p.y}) = ${px(p.x, p.y)}`)
}
