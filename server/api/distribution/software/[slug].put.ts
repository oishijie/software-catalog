/** PUT /api/distribution/software/:slug —— 更新软件（需管理权限） */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const slug = getRouterParam(event, 'slug')!
  const existing = await getSoftwareBySlug(slug)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '软件不存在' })
  }
  const body = await readBody(event)
  return await upsertSoftware({
    ...body,
    id: existing.id,
    slug: body?.slug || existing.slug,
    name: body?.name || existing.name,
    platforms: Array.isArray(body?.platforms) ? body.platforms : existing.platforms
  })
})
