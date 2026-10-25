/** GET /api/distribution/software —— 软件目录分页查询 */
export default defineEventHandler(async (event) => {
  const sortBy = (qstr(event, 'sortBy') || 'recommended') as any
  const result = await listSoftware({
    page: qnum(event, 'page', 1),
    size: qnum(event, 'size', 24),
    categoryId: qstr(event, 'categoryId'),
    platform: qstr(event, 'platform'),
    q: qstr(event, 'q'),
    sortBy,
    status: qstr(event, 'status') || 'active',
    recommendedOnly: qstr(event, 'recommended') === '1'
  })

  setResponseHeader(event, 'cache-control', 'no-cache')
  return result
})
