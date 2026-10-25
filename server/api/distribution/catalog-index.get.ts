/**
 * GET /api/distribution/catalog-index
 * 全量精简目录（无长文本）。目录页一次性取回后在客户端本地筛选 / 排序 / 分页，
 * 服务端因此只需一个查询，并附带 5 分钟缓存。
 */
export default defineEventHandler(async (event) => {
  const items = await listCatalogIndex()
  setResponseHeader(event, 'cache-control', 'public, max-age=300')
  return { items, total: items.length }
})
