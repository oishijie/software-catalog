/** GET /api/distribution/site-profile —— 站点品牌配置 */
export default defineEventHandler(async () => {
  return (await getSiteProfile()) || null
})
