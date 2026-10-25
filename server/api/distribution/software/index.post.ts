/** POST /api/distribution/software —— 新建或更新软件（需管理权限） */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'name 必填' })
  }
  return await upsertSoftware({
    ...body,
    platforms: Array.isArray(body.platforms) ? body.platforms : [],
    recommended: !!body.recommended
  })
})
