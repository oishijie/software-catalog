/** DELETE /api/distribution/categories/:id —— 删除分类（需管理权限） */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const existing = await getCategory(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '分类不存在' })
  }
  await deleteCategory(existing.id)
  return { ok: true, id: existing.id }
})
