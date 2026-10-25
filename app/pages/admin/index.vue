<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { data: counts } = await useFetch('/api/distribution/catalog-filter-counts')
const { data: categoryData } = await useFetch('/api/distribution/categories')

const categories = computed(() => categoryData.value?.items ?? [])
const total = computed(() => counts.value?.all ?? 0)
const platformStats = computed(() => {
  const p = counts.value?.platforms ?? {}
  return [
    { key: 'windows', label: 'Windows', icon: 'i-tabler:brand-windows-filled', n: p.windows ?? 0 },
    { key: 'macos', label: 'macOS', icon: 'i-tabler:brand-apple-filled', n: p.macos ?? 0 },
    { key: 'linux', label: 'Linux', icon: 'i-tabler:brand-ubuntu', n: p.linux ?? 0 },
    { key: 'android', label: 'Android', icon: 'i-tabler:brand-android', n: p.android ?? 0 }
  ]
})

useHead({ title: '后台概览' })
</script>

<template>
  <div class="admin-page">
    <header class="page-head">
      <h1>概览</h1>
      <p>软件目录的数据概况与快捷入口。</p>
    </header>

    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-label">软件总数</span>
        <strong class="stat-value">{{ total }}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">分类数</span>
        <strong class="stat-value">{{ categories.length }}</strong>
      </div>
      <div v-for="p in platformStats" :key="p.key" class="stat-card">
        <span class="stat-label">
          <Icon :name="p.icon" />
          {{ p.label }}
        </span>
        <strong class="stat-value">{{ p.n }}</strong>
      </div>
    </div>

    <div class="quick-grid">
      <NuxtLink to="/admin/software/new" class="quick-card">
        <Icon name="i-tabler:plus" />
        <div>
          <strong>新建软件</strong>
          <span>手动录入一个软件条目</span>
        </div>
      </NuxtLink>
      <NuxtLink to="/admin/software" class="quick-card">
        <Icon name="i-tabler:apps" />
        <div>
          <strong>管理软件</strong>
          <span>编辑、上下架或删除</span>
        </div>
      </NuxtLink>
      <NuxtLink to="/admin/categories" class="quick-card">
        <Icon name="i-tabler:category" />
        <div>
          <strong>管理分类</strong>
          <span>调整分类名称与排序</span>
        </div>
      </NuxtLink>
    </div>

    <section class="panel">
      <h2>分类分布</h2>
      <ul class="category-rows">
        <li v-for="c in categories" :key="c.id">
          <span class="cat-name">{{ c.name }}</span>
          <span class="cat-slug">{{ c.slug }}</span>
          <span class="cat-total">{{ (c as any).total ?? 0 }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.page-head {
  margin-bottom: 22px;
}
.page-head h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ui-text-highlighted);
}
.page-head p {
  margin-top: 6px;
  color: var(--ui-text-muted);
  font-size: 13px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.stat-card {
  padding: 16px;
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  background: var(--ui-bg);
}
.stat-label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--ui-text-muted);
  font-size: 12px;
}
.stat-label :deep(svg) {
  width: 14px;
  height: 14px;
}
.stat-value {
  display: block;
  margin-top: 8px;
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ui-text-highlighted);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 22px;
}
.quick-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  background: var(--ui-bg);
  color: var(--ui-text);
  text-decoration: none;
  transition: background var(--yueli-motion-fast), border-color var(--yueli-motion-fast);
}
.quick-card:hover {
  background: var(--distribution-soft);
  border-color: color-mix(in srgb, var(--ui-primary) 30%, var(--ui-border));
}
.quick-card > :deep(svg) {
  width: 20px;
  height: 20px;
  color: var(--ui-primary);
}
.quick-card strong {
  display: block;
  font-size: 13.5px;
  font-weight: 500;
}
.quick-card span {
  display: block;
  margin-top: 2px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.panel {
  margin-top: 22px;
  padding: 20px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--ui-bg);
}
.panel h2 {
  margin-bottom: 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
}
.category-rows {
  display: grid;
  gap: 2px;
}
.category-rows li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 13px;
}
.category-rows li:hover {
  background: var(--distribution-soft);
}
.cat-name {
  color: var(--ui-text);
}
.cat-slug {
  color: var(--ui-text-dimmed);
  font-family: var(--font-mono);
  font-size: 11.5px;
}
.cat-total {
  margin-left: auto;
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
