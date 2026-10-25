#!/usr/bin/env node
/**
 * 轻量语法自检：用 TypeScript 解析器检查所有 .ts 与 .vue 的脚本块。
 * 只做语法解析，不做类型检查，不需要启动 dev server 或 build。
 *
 * 用法：node tools/check-syntax.mjs
 */
import ts from 'typescript'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SKIP_DIRS = new Set(['node_modules', '.nuxt', '.output', '.git', 'public', 'data', '_ref'])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function extractVueScripts(source) {
  const blocks = []
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(source))) {
    const attrs = m[1]
    if (/lang\s*=\s*["']ts["']/.test(attrs) || !/lang\s*=/.test(attrs)) {
      blocks.push({ code: m[2] })
    }
  }
  return blocks
}

const files = walk(ROOT).filter((f) => {
  const ext = extname(f)
  if (ext === '.ts') return true
  if (ext === '.vue') return true
  if (ext === '.mjs') return true
  return false
})

let checked = 0
let errors = 0

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const source = readFileSync(file, 'utf-8')

  const units = []
  if (file.endsWith('.vue')) {
    for (const block of extractVueScripts(source)) units.push({ label: rel, code: block.code })
  } else {
    units.push({ label: rel, code: source })
  }

  for (const unit of units) {
    const sf = ts.createSourceFile(unit.label, unit.code, ts.ScriptTarget.Latest, true)
    const diags = sf.parseDiagnostics ?? []
    checked++
    if (diags.length) {
      errors += diags.length
      for (const d of diags.slice(0, 5)) {
        const pos = sf.getLineAndCharacterOfPosition(d.start ?? 0)
        const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ')
        console.log(`✗ ${unit.label}:${pos.line + 1}:${pos.character + 1}  ${msg}`)
      }
    }
  }
}

console.log(`\n检查 ${checked} 个脚本单元（${files.length} 个文件），语法错误 ${errors} 个`)
process.exit(errors ? 1 : 0)
