/** DELETE /api/distribution/releases/:id —— 删除版本（需管理权限） */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  await deleteRelease(id)
  return { ok: true, id }
})
