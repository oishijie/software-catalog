/** POST /api/distribution/releases —— 新增/更新版本（需管理权限） */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  if (!body?.softwareId) {
    throw createError({ statusCode: 400, statusMessage: 'softwareId 必填' })
  }
  return await upsertRelease({
    ...body,
    sizeBytes: Number(body.sizeBytes) || 0,
    sources: Array.isArray(body.sources) ? body.sources : []
  })
})
