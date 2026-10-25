export function formatBytes(bytes?: number | null): string {
  const n = Number(bytes) || 0
  if (n <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

export function formatDate(input?: string | null, withTime = false): string {
  if (!input) return ''
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  const base = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  return withTime ? `${base} ${p(d.getHours())}:${p(d.getMinutes())}` : base
}

/** 原站详情页日期格式：2026/10/10 */
export function formatDateSlash(input?: string | null): string {
  if (!input) return ''
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`
}

export function formatCount(n?: number | null): string {
  const v = Number(n) || 0
  if (v >= 10000) return `${(v / 10000).toFixed(v >= 100000 ? 0 : 1)} 万`
  if (v >= 1000) return v.toLocaleString('zh-CN')
  return String(v)
}

export const PLATFORM_LABEL: Record<string, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  android: 'Android',
  ios: 'iOS'
}

export const PLATFORM_ICON: Record<string, string> = {
  windows: 'i-tabler:brand-windows-filled',
  macos: 'i-tabler:brand-apple-filled',
  linux: 'i-tabler:brand-ubuntu',
  android: 'i-tabler:brand-android',
  ios: 'i-tabler:brand-apple'
}
