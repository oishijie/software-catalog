/** GET /api/distribution/catalog-filter-counts —— 分类与平台维度的筛选计数 */
export default defineEventHandler(async () => {
  return await catalogFilterCounts()
})
