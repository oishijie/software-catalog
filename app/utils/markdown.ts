/**
 * 极简 Markdown → HTML 渲染。
 * 只覆盖软件说明/更新日志里实际会用到的语法：
 * 标题、无序/有序列表、粗体、斜体、行内代码、链接、代码块、引用、分隔线、段落。
 * 输出前统一转义 HTML，避免注入。
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(text: string): string {
  let out = escapeHtml(text)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  )
  out = out.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
  )
  return out
}

export function renderMarkdown(input?: string | null): string {
  if (!input) return ''
  const lines = String(input).replace(/\r\n?/g, '\n').split('\n')
  const html: string[] = []
  let inCode = false
  let codeBuf: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let para: string[] = []

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(' '))}</p>`)
      para = []
    }
  }
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`)
      listType = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (/^```/.test(line)) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
        codeBuf = []
        inCode = false
      } else {
        flushPara()
        closeList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(raw)
      continue
    }

    if (!line.trim()) {
      flushPara()
      closeList()
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      flushPara()
      closeList()
      const level = Math.min(4, heading[1].length)
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }

    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      flushPara()
      closeList()
      html.push('<hr />')
      continue
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      flushPara()
      closeList()
      html.push(`<blockquote>${inline(quote[1])}</blockquote>`)
      continue
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ul || ol) {
      flushPara()
      const want: 'ul' | 'ol' = ul ? 'ul' : 'ol'
      if (listType !== want) {
        closeList()
        html.push(`<${want}>`)
        listType = want
      }
      html.push(`<li>${inline((ul ? ul[1] : ol![1]).trim())}</li>`)
      continue
    }

    closeList()
    para.push(line.trim())
  }

  if (inCode && codeBuf.length) {
    html.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  }
  flushPara()
  closeList()
  return html.join('\n')
}

/** 摘取纯文本前 n 个字符，用于 meta description */
export function plainText(input?: string | null, max = 150): string {
  const s = String(input || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*>`_\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}
