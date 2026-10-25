export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/admin/login') return

  const requestFetch = useRequestFetch()
  try {
    const res = await requestFetch<{ authenticated: boolean }>('/api/admin/me')
    if (res?.authenticated) return
  } catch {
    /* 落到下面跳登录 */
  }

  return navigateTo({ path: '/admin/login', query: { redirect: to.fullPath } })
})
