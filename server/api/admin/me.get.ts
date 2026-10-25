/** GET /api/admin/me —— 返回当前后台登录状态 */
export default defineEventHandler((event) => {
  let expected = ''
  try {
    // 线上未配置令牌时会抛 503，这里视为「未登录」而不是报错
    expected = resolveAdminToken(event)
  } catch {
    return { authenticated: false, reason: 'admin_token_not_configured' }
  }

  const provided = getRequestHeader(event, 'x-admin-token') || getCookie(event, 'admin_token')
  return { authenticated: !!provided && provided === expected }
})
