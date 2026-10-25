// 生成「下载区」静态预览页：从 SQLite 读真实数据 + 复用页面结构与设计令牌
// 用途：在不启动 dev server 的前提下检查下载区排版
import { DatabaseSync } from 'node:sqlite'
import { writeFileSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const tabler = require('../node_modules/@iconify-json/tabler/icons.json')
const { normalizeSources } = await import('../server/utils/download-sources.ts')

const db = new DatabaseSync('data/catalog.db', { readOnly: true })
const rows = db
  .prepare(
    `SELECT r.*, s.slug, s.name FROM release r JOIN software s ON s.id = r.software_id
     WHERE r.platform = 'android' AND r.sources LIKE '%github%'
     ORDER BY s.name LIMIT 40`
  )
  .all()

if (!rows.length) throw new Error('没有找到 android + github 来源的样本')
const rel = rows[0]
const sources = normalizeSources(JSON.parse(rel.sources))
const size = (n) => {
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = Number(n) || 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`
}
const svg = (name, size = 20) => {
  const body = tabler.icons[name]?.body || ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
}

const cards = sources
  .map(
    (s) => `
        <div class="source-row">
          <div class="source-name">
            <span class="source-icon">${svg(s.icon.replace('i-tabler:', ''), 20)}</span>
            <div style="min-width:0">
              <div class="source-title">${s.label}</div>
              <div class="source-desc">${s.description}</div>
            </div>
          </div>
          <div class="source-file">
            <div class="source-file-name">${rel.file_name}</div>
            <div class="source-meta">
              <span class="chip">Android 通用版</span>
              <span class="chip">${(rel.file_name.split('.').pop() || '').toUpperCase()}</span>
              <span>${size(rel.size_bytes)}</span>
              <span class="meta-icon">${svg('fingerprint', 14)} SHA256</span>
            </div>
          </div>
          <div class="source-action">
            <span class="badge">${s.badge}</span>
            ${
              s.url
                ? `<a class="btn-outline" href="${s.url}" target="_blank" rel="noopener">${svg('external-link', 16)} 前往下载</a>`
                : `<button class="btn-outline" type="button">${svg('download', 16)} 本站下载</button>`
            }
          </div>
        </div>`
  )
  .join('')

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>下载区预览 · ${rel.name}</title>
<style>
  :root{
    --distribution-canvas:#101722; --distribution-surface:#182131; --distribution-ink:#edf2fc;
    --distribution-muted:#a9b5ca; --distribution-line:#2c394d; --distribution-soft:#22314b;
    --distribution-accent:#8bd2b5; --ui-border-accented:#516383;
  }
  *{box-sizing:border-box}
  body{margin:0;padding:24px;background:var(--distribution-canvas);color:var(--distribution-ink);
       font:14px/1.5 "DM Sans","PingFang SC","Microsoft YaHei",system-ui,sans-serif}
  .wrap{max-width:900px;margin:0 auto}
  .note{color:var(--distribution-muted);font-size:12px;margin:0 0 16px}
  .distribution-panel{background:var(--distribution-surface);border:1px solid var(--distribution-line);border-radius:10px}
  .distribution-download-section{padding:20px}
  h2.title{display:flex;align-items:center;gap:8px;margin:0;font-size:20px;font-weight:600;letter-spacing:-.01em}
  .title svg{color:var(--distribution-accent)}
  .sub{margin:4px 0 0;font-size:13px;color:var(--distribution-muted)}
  .distribution-platform-tabs{margin:16px 0 20px}
  .tablist{display:flex;gap:0;padding:4px;border-radius:8px;background:var(--distribution-soft);overflow-x:auto}
  .tab{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border:0;border-radius:6px;
       background:transparent;color:var(--distribution-muted);font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer}
  .tab[data-state=active]{background:var(--distribution-surface);color:var(--distribution-accent)}
  .group-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 12px}
  .group-head h3{display:flex;align-items:center;gap:6px;margin:0;font-size:14px;font-weight:600}
  .group-head h3 svg{color:var(--distribution-accent)}
  .group-head span{font-size:12px;color:var(--distribution-muted)}
  .group-sub{margin:4px 0 12px;font-size:12px;color:var(--distribution-muted)}
  .source-list{display:grid;gap:12px}
  .source-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;padding:12px;
              border:1px solid var(--distribution-line);border-radius:10px}
  .source-name{display:flex;align-items:center;gap:10px;min-width:0}
  .source-icon{display:grid;place-items:center;flex-shrink:0;width:36px;height:36px;border-radius:9px;
               color:var(--distribution-accent);background:color-mix(in srgb,var(--distribution-accent) 8%,transparent)}
  .source-title{font-size:14px;font-weight:500;color:var(--distribution-ink)}
  .source-desc{margin-top:2px;font-size:12px;color:var(--distribution-muted)}
  .source-file{grid-column:1;min-width:0}
  .source-file-name{font-size:14px;font-weight:500;color:var(--distribution-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .source-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin-top:6px;font-size:12px;color:var(--distribution-muted)}
  .chip{padding:2px 6px;border-radius:4px;background:var(--distribution-soft);font-size:11px}
  .meta-icon{display:inline-flex;align-items:center;gap:4px}
  .source-action{grid-area:1/2/span 2;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;gap:12px}
  .badge{padding:2px 8px;border-radius:4px;background:var(--distribution-soft);color:var(--distribution-muted);font-size:11px}
  .btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:6px 12px;
               border:1px solid var(--ui-border-accented);border-radius:6px;background:transparent;
               color:var(--distribution-ink);font-size:13px;font-weight:500;text-decoration:none;cursor:pointer;white-space:nowrap}
  .btn-outline:hover{background:var(--distribution-soft)}
  .help{display:flex;align-items:flex-start;gap:10px;margin-top:20px;padding:14px;border-radius:10px;
        background:color-mix(in srgb,var(--distribution-accent) 6%,var(--distribution-surface))}
  .help svg{flex-shrink:0;color:var(--distribution-accent)}
  .help p{margin:0;font-size:12px;line-height:1.7;color:var(--distribution-muted)}
</style>
</head>
<body>
<div class="wrap">
  <p class="note">静态预览（真实数据：${rel.name} · ${rel.file_name}）——仅用于核对下载区排版，非运行中的页面。</p>
  <div class="distribution-panel">
    <div class="distribution-download-section">
      <header>
        <h2 class="title">${svg('download', 20)} 下载安装</h2>
        <p class="sub">选择系统和处理器，再选择下载来源。</p>
      </header>

      <div class="distribution-platform-tabs">
        <div class="tablist" role="tablist">
          <button class="tab" role="tab" data-state="active">${svg('brand-android', 16)} Android</button>
        </div>
      </div>

      <section>
        <div class="group-head">
          <h3>${svg('brand-android', 16)} Android 版本下载</h3>
          <span>通用版 · 正式版</span>
        </div>
        <p class="group-sub">适用于 Android · 通用版 · v${rel.version}</p>
        <div class="source-list">${cards}
        </div>
      </section>

      <div class="help">
        ${svg('info-circle', 20)}
        <p>开源项目的文件取自 GitHub Release，并额外提供 GH-Proxy / GHFast 镜像加速。若某个来源不可用，换用其它来源即可。</p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`

writeFileSync('_ref/download-preview.html', html)
console.log(`✓ 已生成 _ref/download-preview.html（样本：${rel.name}，来源 ${sources.length} 条：${sources.map((s) => s.label).join(' / ')}）`)
