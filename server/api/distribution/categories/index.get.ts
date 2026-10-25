/** GET /api/distribution/categories —— 分类列表（含各分类软件数） */
export default defineEventHandler(async () => {
  return { items: await listCategories() }
})
