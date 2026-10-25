<script setup lang="ts">
import type { Software } from '~~/server/utils/repo'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const router = useRouter()

const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const q = computed(() => (route.query.q as string) || '')

const { data, refresh } = await useFetch<{ items: Software[]; total: number }>(
  '/api/distribution/software',
  {
    query: { page, size: 20, q, status: 'all', sortBy: 'updated' },
    watch: [page, q]
  }
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / 20)))

const qInput = ref(q.value)
let timer: ReturnType<typeof setTimeout> | undefined
watch(qInput, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    router.push({ path: '/admin/software', query: v.trim() ? { q: v.trim() } : {} })
  }, 350)
})

const deleting = ref<string | null>(null)

async function remove(item: Software) {
  if (!confirm(`确定要删除「${item.name}」吗？该操作不可撤销，其版本记录也会一并删除。`)) return
  deleting.value = item.id
  try {
    await $fetch(`/api/distribution/software/${item.slug}`, { method: 'DELETE' })
    await refresh()
  } catch (e: any) {
    alert(e?.data?.statusMessage || '删除失败')
  } finally {
    deleting.value = null
  }
}

async function toggleStatus(item: Software) {
  const next = item.status === 'active' ? 'hidden' : 'active'
  try {
    await $fetch(`/api/distribution/software/${item.slug}`, {
      method: 'PUT',
      body: { status: next }
    })
    await refresh()
  } catch (e: any) {
    alert(e?.data?.statusMessage || '更新失败')
  }
}

useHead({ title: '软件管理' })
</script>

<template>
  <div class="admin-page">
    <header class="page-head">
      <div>
        <h1>软件管理</h1>
        <p>共 {{ total }} 条记录</p>
      </div>
      <NuxtLink to="/admin/software/new" class="primary-button">
        <Icon name="i-tabler:plus" />
        新建软件
      </NuxtLink>
    </header>

    <div class="toolbar">
      <div class="search-field">
        <Icon name="i-tabler:search" class="search-icon" />
        <input v-model="qInput" type="search" placeholder="搜索名称、简介…" />
      </div>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-software">软件</th>
            <th>分类</th>
            <th>平台</th>
            <th class="col-num">下载</th>
            <th>状态</th>
            <th>更新时间</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td class="col-software">
              <div class="cell-software">
                <SoftwareGlyph :name="item.name" :icon-url="item.iconUrl" class="row-glyph" />
                <div class="cell-text">
                  <NuxtLink :to="`/admin/software/${item.slug}`" class="cell-name">
                    {{ item.name }}
                  </NuxtLink>
                  <span class="cell-slug">{{ item.slug }}</span>
                </div>
              </div>
            </td>
            <td>{{ item.categoryName || '—' }}</td>
            <td>
              <PlatformIcons :platforms="item.platforms" />
            </td>
            <td class="col-num">{{ item.downloadCount }}</td>
            <td>
              <button
                type="button"
                class="status-pill"
                :class="item.status === 'active' ? 'is-on' : 'is-off'"
                @click="toggleStatus(item)"
              >
                {{ item.status === 'active' ? '已上架' : '已下架' }}
              </button>
            </td>
            <td class="cell-date">{{ formatDate(item.updatedAt) }}</td>
            <td class="col-actions">
              <NuxtLink :to="`/admin/software/${item.slug}`" class="row-action">编辑</NuxtLink>
              <NuxtLink :to="`/software/${item.slug}`" target="_blank" class="row-action">预览</NuxtLink>
              <button
                type="button"
                class="row-action is-danger"
                :disabled="deleting === item.id"
                @click="remove(item)"
              >
                {{ deleting === item.id ? '删除中' : '删除' }}
              </button>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="7" class="empty-row">没有匹配的软件</td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav v-if="totalPages > 1" class="pager">
      <button
        type="button"
        :disabled="page <= 1"
        @click="router.push({ query: { ...route.query, page: page - 1 } })"
      >
        上一页
      </button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button
        type="button"
        :disabled="page >= totalPages"
        @click="router.push({ query: { ...route.query, page: page + 1 } })"
      >
        下一页
      </button>
    </nav>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.page-head h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ui-text-highlighted);
}
.page-head p {
  margin-top: 5px;
  color: var(--ui-text-muted);
  font-size: 12.5px;
}
.primary-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 10px;
  background: var(--ui-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
}
.primary-button :deep(svg) {
  width: 15px;
  height: 15px;
}

.toolbar {
  margin-bottom: 14px;
}
.search-field {
  position: relative;
  max-width: 320px;
}
.search-icon {
  position: absolute;
  top: 50%;
  left: 11px;
  width: 15px;
  height: 15px;
  color: var(--ui-text-dimmed);
  transform: translateY(-50%);
}
.search-field input {
  width: 100%;
  padding: 9px 12px 9px 34px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 13px;
  outline: none;
}

.table-wrap {
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  background: var(--ui-bg);
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th,
.data-table td {
  padding: 11px 14px;
  text-align: left;
  border-bottom: 1px solid var(--ui-border);
  vertical-align: middle;
}
.data-table th {
  color: var(--ui-text-muted);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}
.data-table tbody tr:last-child td {
  border-bottom: 0;
}
.data-table tbody tr:hover {
  background: var(--distribution-soft);
}

.cell-software {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 180px;
}
.row-glyph {
  width: 34px !important;
  height: 34px !important;
  border-radius: 9px !important;
}
.cell-text {
  min-width: 0;
}
.cell-name {
  display: block;
  color: var(--ui-text-highlighted);
  font-weight: 500;
  text-decoration: none;
}
.cell-name:hover {
  color: var(--ui-primary);
}
.cell-slug {
  display: block;
  color: var(--ui-text-dimmed);
  font-family: var(--font-mono);
  font-size: 11px;
}
.cell-date {
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.col-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  width: 70px;
}
.col-actions {
  white-space: nowrap;
}

.status-pill {
  padding: 3px 9px;
  border: 1px solid transparent;
  border-radius: 20px;
  font-size: 11.5px;
  cursor: pointer;
}
.status-pill.is-on {
  border-color: color-mix(in srgb, var(--ui-primary) 30%, transparent);
  background: var(--distribution-soft);
  color: var(--ui-primary);
}
.status-pill.is-off {
  border-color: var(--ui-border);
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
}

.row-action {
  padding: 4px 7px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 12.5px;
  text-decoration: none;
  cursor: pointer;
}
.row-action:hover {
  background: var(--ui-bg-elevated);
  color: var(--ui-primary);
}
.row-action.is-danger:hover {
  color: var(--ui-error);
}
.row-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-row {
  padding: 40px !important;
  color: var(--ui-text-muted);
  text-align: center;
}

.pager {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  color: var(--ui-text-muted);
  font-size: 12.5px;
}
.pager button {
  padding: 7px 12px;
  border: 1px solid var(--ui-border);
  border-radius: 9px;
  background: var(--ui-bg);
  color: var(--ui-text-muted);
  font-size: 12.5px;
  cursor: pointer;
}
.pager button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
