/** POST /api/distribution/categories —— 新建或更新分类（需管理权限） */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'name 必填' })
  }
  return await upsertCategory({
    id: body.id,
    name: body.name,
    slug: body.slug,
    icon: body.icon,
    sortOrder: Number(body.sortOrder) || 0
  })
})
