/** DELETE /api/distribution/software/:slug —— 删除软件（需管理权限） */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const slug = getRouterParam(event, 'slug')!
  const existing = await getSoftwareBySlug(slug)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '软件不存在' })
  }
  await deleteSoftware(existing.id)
  return { ok: true, id: existing.id }
})
