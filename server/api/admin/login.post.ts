/** POST /api/admin/login —— 后台登录，校验令牌后写入 cookie */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: string }>(event)
  // 线上未配置 NUXT_ADMIN_TOKEN 时这里会抛 503，避免默认口令可登录
  const expected = resolveAdminToken(event)

  if (!body?.token || body.token !== expected) {
    throw createError({ statusCode: 401, statusMessage: '令牌不正确' })
  }

  setCookie(event, 'admin_token', body.token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  })
  return { ok: true }
})
