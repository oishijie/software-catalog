/** PUT /api/distribution/site-profile —— 更新站点品牌配置（需管理权限） */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  await setSiteProfile(body ?? {})
  return await getSiteProfile()
})
