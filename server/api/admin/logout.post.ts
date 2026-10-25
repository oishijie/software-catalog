/** POST /api/admin/logout —— 退出后台 */
export default defineEventHandler((event) => {
  deleteCookie(event, 'admin_token', { path: '/' })
  return { ok: true }
})
