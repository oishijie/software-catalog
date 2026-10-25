<script setup lang="ts">
import type { CatalogIndexItem, Platform } from '~~/server/utils/repo'

const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 24

const SORT_OPTIONS = [
  { key: 'recommended', label: '推荐优先' },
  { key: 'updated', label: '最近更新' },
  { key: 'downloads', label: '下载最多' },
  { key: 'name', label: '名称排序' }
]

/* 以 URL query 作为唯一数据源，保证可分享、可前进后退 */
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const categoryId = computed(() => (route.query.categoryId as string) || '')
const platform = computed(() => (route.query.platform as string) || '')
const q = computed(() => (route.query.q as string) || '')
const sortBy = computed(() => (route.query.sortBy as string) || 'recommended')

const { data: categoryData } = await useFetch('/api/distribution/categories')
const { data: counts } = await useFetch('/api/distribution/catalog-filter-counts')

/* 全量精简目录：构建期预渲染固化进 payload，之后筛选 / 排序 / 分页全部在
   本地完成 —— 纯静态部署（没有服务端）下行为与原先一致。 */
const { data: indexData } = await useAsyncData('catalog-index', () =>
  $fetch<{ items: CatalogIndexItem[]; total: number }>('/api/distribution/catalog-index')
)

const allItems = computed<CatalogIndexItem[]>(() => indexData.value?.items ?? [])
const loading = computed(() => !indexData.value)

const filtered = computed(() => {
  const kw = q.value.trim().toLowerCase()
  const cat = categoryId.value
  const plat = platform.value

  const list = allItems.value.filter((s) => {
    if (cat && s.categoryId !== cat) return false
    if (plat && !s.platforms.includes(plat as Platform)) return false
    if (kw && !`${s.name}\n${s.summary}\n${s.slug}`.toLowerCase().includes(kw)) return false
    return true
  })

  const byUpdated = (a: CatalogIndexItem, b: CatalogIndexItem) =>
    b.updatedAt.localeCompare(a.updatedAt)

  switch (sortBy.value) {
    case 'updated':
      return list.sort(byUpdated)
    case 'downloads':
      return list.sort((a, b) => b.downloadCount - a.downloadCount || byUpdated(a, b))
    case 'name':
      return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
    default:
      return list.sort((a, b) => Number(b.recommended) - Number(a.recommended) || byUpdated(a, b))
  }
})

const total = computed(() => filtered.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const items = computed(() =>
  filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
)

/* ------------------------------------------------------------- 交互 */

function patchQuery(patch: Record<string, string | number | undefined>) {
  const next: Record<string, any> = { ...route.query, ...patch }
  for (const key of Object.keys(next)) {
    if (next[key] === '' || next[key] === undefined || next[key] === null) delete next[key]
  }
  router.push({ path: '/software', query: next })
}

const onCategory = (value: string) => patchQuery({ categoryId: value, page: undefined })
const onPlatform = (value: string) => patchQuery({ platform: value, page: undefined })
const onSort = (e: Event) => patchQuery({ sortBy: (e.target as HTMLSelectElement).value, page: undefined })
const onPage = (value: number) => patchQuery({ page: value > 1 ? value : undefined })

/* 搜索框：本地即时回显 + 防抖写回 URL */
const qInput = ref(q.value)
watch(q, (v) => {
  if (v !== qInput.value) qInput.value = v
})
let timer: ReturnType<typeof setTimeout> | undefined
watch(qInput, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (v !== q.value) patchQuery({ q: v.trim(), page: undefined })
  }, 380)
})

const mobileFilterOpen = ref(false)

const headingLabel = computed(() => {
  const cat = (categoryData.value?.items ?? []).find((c: any) => c.id === categoryId.value)
  return cat ? cat.name : '软件目录'
})

const pageNumbers = computed(() => {
  const last = totalPages.value
  const cur = page.value
  const out: (number | '…')[] = []
  const push = (n: number | '…') => out.push(n)
  if (last <= 7) {
    for (let i = 1; i <= last; i++) push(i)
    return out
  }
  push(1)
  if (cur > 3) push('…')
  for (let i = Math.max(2, cur - 1); i <= Math.min(last - 1, cur + 1); i++) push(i)
  if (cur < last - 2) push('…')
  push(last)
  return out
})

useHead({
  title: () => `${headingLabel.value} · 软件目录`,
  meta: [{ name: 'description', content: '浏览全部软件，按分类与平台筛选，查看版本与下载。' }]
})
</script>

<template>
  <div class="software-catalog">
    <div class="catalog-page-heading">
      <h1>{{ headingLabel }}</h1>
      <span class="catalog-search-count">{{ total }} 个软件</span>
    </div>

    <div class="catalog-layout">
      <aside class="catalog-sidebar" aria-label="筛选">
        <CatalogFilters
          :categories="categoryData?.items ?? []"
          :active-category="categoryId"
          :active-platform="platform"
          :counts="counts"
          @update:category="onCategory"
          @update:platform="onPlatform"
        />
      </aside>

      <div class="catalog-results">
        <div class="catalog-toolbar">
          <div class="search-field catalog-search">
            <Icon name="i-tabler:search" class="search-icon" aria-hidden="true" />
            <input
              v-model="qInput"
              type="search"
              class="search-input"
              placeholder="搜索软件名称、简介…"
              aria-label="搜索软件"
            />
            <button
              v-if="qInput"
              type="button"
              class="search-clear"
              aria-label="清空搜索"
              @click="qInput = ''"
            >
              <Icon name="i-tabler:x" />
            </button>
          </div>

          <div class="select-field catalog-sort">
            <select class="select-input" :value="sortBy" aria-label="排序方式" @change="onSort">
              <option v-for="o in SORT_OPTIONS" :key="o.key" :value="o.key">{{ o.label }}</option>
            </select>
            <Icon name="i-tabler:chevron-down" class="select-icon" aria-hidden="true" />
          </div>

          <button type="button" class="mobile-filter-button catalog-mobile-filter" @click="mobileFilterOpen = true">
            <Icon name="i-tabler:adjustments-horizontal" />
            筛选
          </button>
        </div>

        <div v-if="loading && !items.length" class="catalog-grid">
          <div v-for="i in 9" :key="i" class="card-skeleton" />
        </div>

        <div v-else-if="items.length" class="catalog-grid">
          <CatalogCard v-for="s in items" :key="s.id" :software="s" />
        </div>

        <div v-else class="catalog-placeholder">
          <Icon name="i-tabler:mood-empty" style="width: 22px; height: 22px" />
          <span>没有找到匹配的软件，试着换个关键词或清空筛选。</span>
        </div>

        <nav v-if="totalPages > 1" class="catalog-pagination" aria-label="分页">
          <button
            type="button"
            class="page-button"
            :disabled="page <= 1"
            @click="onPage(page - 1)"
          >
            上一页
          </button>
          <button
            v-for="(n, i) in pageNumbers"
            :key="`${n}-${i}`"
            type="button"
            class="page-button page-number"
            :class="{ 'is-active': n === page, 'is-gap': n === '…' }"
            :disabled="n === '…'"
            @click="typeof n === 'number' && onPage(n)"
          >
            {{ n }}
          </button>
          <button
            type="button"
            class="page-button"
            :disabled="page >= totalPages"
            @click="onPage(page + 1)"
          >
            下一页
          </button>
        </nav>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="mobileFilterOpen" class="filter-drawer" role="dialog" aria-label="筛选">
        <div class="filter-drawer-mask" @click="mobileFilterOpen = false" />
        <div class="filter-drawer-panel">
          <div class="filter-drawer-head">
            <strong>筛选</strong>
            <button type="button" class="search-clear" aria-label="关闭" @click="mobileFilterOpen = false">
              <Icon name="i-tabler:x" />
            </button>
          </div>
          <CatalogFilters
            :categories="categoryData?.items ?? []"
            :active-category="categoryId"
            :active-platform="platform"
            :counts="counts"
            @update:category="(v) => { onCategory(v); mobileFilterOpen = false }"
            @update:platform="(v) => { onPlatform(v); mobileFilterOpen = false }"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* 搜索框 */
.search-field {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: var(--ui-text-dimmed);
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 10px 34px 10px 36px;
  border: 1px solid var(--ui-border);
  border-radius: 11px;
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 13px;
  outline: none;
  transition: border-color var(--yueli-motion-fast);
}
.search-input::placeholder {
  color: var(--ui-text-dimmed);
}
.search-input:focus {
  border-color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-border));
}
.search-input::-webkit-search-cancel-button {
  display: none;
}
.search-clear {
  position: absolute;
  right: 8px;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ui-text-dimmed);
  cursor: pointer;
}
.search-clear:hover {
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
}
.search-clear :deep(svg) {
  width: 14px;
  height: 14px;
}

/* 下拉 */
.select-field {
  position: relative;
  display: flex;
  align-items: center;
}
.select-input {
  width: 100%;
  padding: 10px 30px 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: 11px;
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 13px;
  appearance: none;
  outline: none;
  cursor: pointer;
}
.select-input:focus {
  border-color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-border));
}
.select-icon {
  position: absolute;
  right: 10px;
  width: 15px;
  height: 15px;
  color: var(--ui-text-dimmed);
  pointer-events: none;
}

.mobile-filter-button {
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 11px;
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 13px;
  cursor: pointer;
}
.mobile-filter-button :deep(svg) {
  width: 15px;
  height: 15px;
}

/* 骨架屏 */
.card-skeleton {
  height: 200px;
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  background: linear-gradient(
    100deg,
    var(--ui-bg) 30%,
    var(--ui-bg-elevated) 50%,
    var(--ui-bg) 70%
  );
  background-size: 220% 100%;
  animation: skeleton 1.4s ease-in-out infinite;
}
@keyframes skeleton {
  from {
    background-position: 180% 0;
  }
  to {
    background-position: -60% 0;
  }
}

/* 分页 */
.catalog-pagination {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 24px;
}
.page-button {
  min-width: 36px;
  padding: 8px 11px;
  border: 1px solid var(--ui-border);
  border-radius: 9px;
  background: var(--ui-bg);
  color: var(--ui-text-muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background var(--yueli-motion-fast), color var(--yueli-motion-fast),
    border-color var(--yueli-motion-fast);
}
.page-button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--ui-primary) 40%, var(--ui-border));
  color: var(--ui-primary);
}
.page-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.page-button.is-active {
  border-color: var(--ui-primary);
  background: var(--distribution-soft);
  color: var(--ui-primary);
  font-weight: 500;
}
.page-button.is-gap {
  border-color: transparent;
  background: transparent;
}

/* 移动端筛选抽屉 */
.filter-drawer {
  position: fixed;
  inset: 0;
  z-index: 70;
}
.filter-drawer-mask {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 42%);
}
.filter-drawer-panel {
  position: absolute;
  inset-block: 0;
  left: 0;
  width: min(300px, 86vw);
  padding: 18px;
  background: var(--ui-bg);
  overflow-y: auto;
}
.filter-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  font-size: 14px;
}
.filter-drawer-head .search-clear {
  position: static;
}
</style>
