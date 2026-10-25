<script setup lang="ts">
import type { Category } from '~~/server/utils/repo'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { data, refresh } = await useFetch<{ items: (Category & { total?: number })[] }>(
  '/api/distribution/categories'
)

const categories = computed(() => data.value?.items ?? [])

const draft = ref<{ id?: string; name: string; slug: string; sortOrder: number }>({
  name: '',
  slug: '',
  sortOrder: 0
})
const busy = ref(false)
const message = ref('')
const errorMessage = ref('')

function resetDraft() {
  draft.value = { name: '', slug: '', sortOrder: 0 }
}

function edit(c: Category & { total?: number }) {
  draft.value = { id: c.id, name: c.name, slug: c.slug, sortOrder: c.sortOrder ?? 0 }
  message.value = ''
  errorMessage.value = ''
}

async function save() {
  errorMessage.value = ''
  message.value = ''
  if (!draft.value.name.trim()) {
    errorMessage.value = '分类名称不能为空'
    return
  }
  busy.value = true
  try {
    await $fetch('/api/distribution/categories', {
      method: 'POST',
      body: {
        id: draft.value.id,
        name: draft.value.name.trim(),
        slug: draft.value.slug.trim() || undefined,
        sortOrder: Number(draft.value.sortOrder) || 0
      }
    })
    message.value = draft.value.id ? '已更新' : '已创建'
    resetDraft()
    await refresh()
    setTimeout(() => (message.value = ''), 2400)
  } catch (e: any) {
    errorMessage.value = e?.data?.statusMessage || '保存失败'
  } finally {
    busy.value = false
  }
}

async function remove(c: Category & { total?: number }) {
  const n = c.total ?? 0
  const tip = n > 0
    ? `分类「${c.name}」下还有 ${n} 个软件，删除后这些软件会变成「未分类」。确定继续吗？`
    : `确定删除分类「${c.name}」吗？`
  if (!confirm(tip)) return
  try {
    await $fetch(`/api/distribution/categories/${c.id}`, { method: 'DELETE' })
    if (draft.value.id === c.id) resetDraft()
    await refresh()
  } catch (e: any) {
    alert(e?.data?.statusMessage || '删除失败')
  }
}

useHead({ title: '分类管理' })
</script>

<template>
  <div class="admin-page">
    <header class="page-head">
      <div>
        <h1>分类管理</h1>
        <p>共 {{ categories.length }} 个分类</p>
      </div>
    </header>

    <div class="two-col">
      <section class="panel">
        <h2 class="panel-title">{{ draft.id ? '编辑分类' : '新增分类' }}</h2>
        <form class="cat-form" @submit.prevent="save">
          <label class="field">
            <span class="field-label">名称 <em>*</em></span>
            <input v-model="draft.name" type="text" placeholder="例如 音视频工具" />
          </label>
          <label class="field">
            <span class="field-label">slug</span>
            <input v-model="draft.slug" type="text" placeholder="留空自动生成" />
          </label>
          <label class="field">
            <span class="field-label">排序（小的靠前）</span>
            <input v-model="draft.sortOrder" type="number" min="0" />
          </label>

          <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
          <p v-if="message" class="form-ok">{{ message }}</p>

          <div class="cat-form-actions">
            <button type="submit" class="primary-button" :disabled="busy">
              {{ busy ? '保存中…' : draft.id ? '保存修改' : '创建分类' }}
            </button>
            <button v-if="draft.id" type="button" class="ghost-button" @click="resetDraft">
              取消编辑
            </button>
          </div>
        </form>
      </section>

      <section class="panel">
        <h2 class="panel-title">全部分类</h2>
        <ul class="cat-rows">
          <li v-for="c in categories" :key="c.id" class="cat-row">
            <div class="cat-main">
              <span class="cat-name">{{ c.name }}</span>
              <span class="cat-slug">{{ c.slug }}</span>
            </div>
            <span class="cat-total">{{ c.total ?? 0 }}</span>
            <button type="button" class="row-action" @click="edit(c)">编辑</button>
            <button type="button" class="row-action is-danger" @click="remove(c)">删除</button>
          </li>
          <li v-if="!categories.length" class="cat-empty">还没有分类</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page-head {
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

.two-col {
  display: grid;
  grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
  align-items: start;
  gap: 16px;
}

.panel {
  padding: 20px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--ui-bg);
}
.panel-title {
  margin-bottom: 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
}

.cat-form {
  display: grid;
  gap: 12px;
}
.field-label {
  display: block;
  margin-bottom: 6px;
  color: var(--ui-text-muted);
  font-size: 12px;
}
.field-label em {
  color: var(--ui-error);
  font-style: normal;
}
.field input {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 13px;
  outline: none;
}
.field input:focus {
  border-color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-border));
}
.cat-form-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.primary-button {
  padding: 10px 16px;
  border: 0;
  border-radius: 10px;
  background: var(--ui-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.primary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ghost-button {
  padding: 10px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 13px;
  cursor: pointer;
}
.form-error {
  color: var(--ui-error);
  font-size: 12.5px;
}
.form-ok {
  color: var(--ui-success);
  font-size: 12.5px;
}

.cat-rows {
  display: grid;
  gap: 4px;
}
.cat-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px auto auto;
  align-items: center;
  gap: 8px;
  padding: 9px 11px;
  border-radius: 10px;
}
.cat-row:hover {
  background: var(--distribution-soft);
}
.cat-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.cat-name {
  font-size: 13px;
  color: var(--ui-text);
}
.cat-slug {
  color: var(--ui-text-dimmed);
  font-family: var(--font-mono);
  font-size: 11px;
}
.cat-total {
  color: var(--ui-text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.row-action {
  padding: 4px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 12.5px;
  cursor: pointer;
}
.row-action:hover {
  background: var(--ui-bg-elevated);
  color: var(--ui-primary);
}
.row-action.is-danger:hover {
  color: var(--ui-error);
}
.cat-empty {
  padding: 30px;
  color: var(--ui-text-muted);
  font-size: 13px;
  text-align: center;
}

@media (width <= 900px) {
  .two-col {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
