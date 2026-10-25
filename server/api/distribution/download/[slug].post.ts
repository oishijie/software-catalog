/** POST /api/distribution/download/:slug —— 记录一次下载入口点击 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const existing = await getSoftwareBySlug(slug)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '软件不存在' })
  }
  await incrementDownload(slug)
  return { ok: true, downloadCount: existing.downloadCount + 1 }
})
