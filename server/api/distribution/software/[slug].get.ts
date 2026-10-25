/** GET /api/distribution/software/:slug —— 软件详情（含版本列表与相关推荐） */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const software = await getSoftwareBySlug(slug)
  if (!software) {
    throw createError({ statusCode: 404, statusMessage: '软件不存在', message: `未找到 ${slug}` })
  }
  return {
    software,
    releases: await listReleases(software.id),
    related: await relatedSoftware(software, 4)
  }
})
