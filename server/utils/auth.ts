import type { H3Event } from 'h3'
import { usingD1 } from './db'

/**
 * 解析当前生效的管理令牌。
 *
 * 线上（Cloudflare 运行时）必须显式配置 `NUXT_ADMIN_TOKEN`，否则直接拒绝 ——
 * 避免默认口令在公网裸奔（后台可以改数据、删软件）。
 * 本地开发未配置时回退到 `admin`，保持开发便利。
 */
export function resolveAdminToken(event: H3Event): string {
  const configured = String(useRuntimeConfig(event).adminToken || '').trim()
  if (configured) return configured

  if (usingD1()) {
    throw createError({
      statusCode: 503,
      statusMessage: '未配置管理令牌',
      message: '线上后台需先在 Cloudflare Pages 设置环境变量 NUXT_ADMIN_TOKEN 才能登录'
    })
  }
  return 'admin'
}

/** 管理后台鉴权：请求头 x-admin-token 或 admin_token cookie 需匹配 */
export function requireAdmin(event: H3Event): void {
  const expected = resolveAdminToken(event)
  const header = getRequestHeader(event, 'x-admin-token')
  const cookie = getCookie(event, 'admin_token')
  const provided = header || cookie

  if (!provided || provided !== expected) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: '需要管理权限，请先登录后台'
    })
  }
}

/** 校验并返回字符串查询参数 */
export function qstr(event: H3Event, key: string): string | null {
  const v = getQuery(event)[key]
  if (Array.isArray(v)) return v[0] ?? null
  const s = typeof v === 'string' ? v.trim() : ''
  return s || null
}

export function qnum(event: H3Event, key: string, fallback: number): number {
  const n = Number(getQuery(event)[key])
  return Number.isFinite(n) && n > 0 ? n : fallback
}
