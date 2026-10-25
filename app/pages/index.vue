<script setup lang="ts">
import type { Software } from '~~/server/utils/repo'

const { data: featured } = await useFetch<{ items: Software[] }>('/api/distribution/software', {
  query: { recommended: '1', size: 2 }
})

const { data: hot } = await useFetch<{ items: Software[] }>('/api/distribution/software', {
  query: { sortBy: 'downloads', size: 6 }
})

const { data: recent } = await useFetch<{ items: Software[] }>('/api/distribution/software', {
  query: { sortBy: 'updated', size: 6 }
})

const { data: categoryData } = await useFetch('/api/distribution/categories')

const categories = computed(() => categoryData.value?.items ?? [])
const exploreCategories = computed(() => categories.value.slice(0, 8))

const totalSoftware = computed(() => {
  const c = categories.value as any[]
  return c.reduce((n, x) => n + (Number(x.total) || 0), 0)
})

const searchInput = ref('')
const goSearch = () => {
  const q = searchInput.value.trim()
  navigateTo({ path: '/software', query: q ? { q } : {} })
}

useSeoMeta({
  title: '软件目录 · 精选实用工具',
  description: '按分类与平台浏览软件，查看版本、更新日志与下载。'
})
</script>

<template>
  <div class="home">
    <section class="home-hero">
      <p class="hero-eyebrow">软件目录</p>
      <h1>把好用的工具收进一个目录</h1>
      <p class="hero-desc">
        按分类和平台浏览，查看每个软件的版本、更新日志与下载入口。当前收录
        <strong>{{ totalSoftware || 519 }}</strong> 款软件。
      </p>

      <div class="hero-search">
        <Icon name="i-tabler:search" class="hero-search-icon" aria-hidden="true" />
        <input
          v-model="searchInput"
          type="search"
          placeholder="搜索软件名称，例如 7-Zip、FFmpeg…"
          aria-label="搜索软件"
          @keyup.enter="goSearch"
        />
        <button type="button" @click="goSearch">搜索</button>
      </div>

      <div class="hero-actions">
        <NuxtLink to="/software" class="primary-action">
          全部软件
          <Icon name="i-tabler:arrow-right" />
        </NuxtLink>
        <NuxtLink to="/software?sortBy=updated" class="ghost-action">最近更新</NuxtLink>
      </div>
    </section>

    <section v-if="featured?.items?.length" class="home-section">
      <header class="section-head">
        <div>
          <h2>精选软件</h2>
          <p>值得一试的实用工具</p>
        </div>
        <NuxtLink to="/software" class="section-link">全部软件</NuxtLink>
      </header>
      <div class="featured-grid">
        <CatalogCard
          v-for="s in featured.items"
          :key="s.id"
          :software="s"
          variant="default"
        />
      </div>
    </section>

    <section v-if="exploreCategories.length" class="home-section">
      <header class="section-head">
        <div>
          <h2>按用途探索</h2>
          <p>从分类开始找到你需要的工具</p>
        </div>
        <NuxtLink to="/software" class="section-link">全部分类（{{ categories.length }}）</NuxtLink>
      </header>

      <div class="category-grid">
        <NuxtLink
          v-for="c in exploreCategories"
          :key="c.id"
          :to="`/software?categoryId=${c.id}`"
          class="category-tile"
        >
          <Icon name="i-tabler:category" class="tile-icon" />
          <span class="tile-name">{{ c.name }}</span>
          <span v-if="(c as any).total" class="tile-count">{{ (c as any).total }}</span>
        </NuxtLink>
      </div>
    </section>

    <section v-if="hot?.items?.length" class="home-section">
      <header class="section-head">
        <div>
          <h2>热门软件</h2>
          <p>大家正在使用的实用工具</p>
        </div>
        <NuxtLink to="/software?sortBy=downloads" class="section-link">查看全部</NuxtLink>
      </header>
      <div class="catalog-grid">
        <CatalogCard v-for="s in hot.items" :key="s.id" :software="s" />
      </div>
    </section>

    <section v-if="recent?.items?.length" class="home-section">
      <header class="section-head">
        <div>
          <h2>最近更新</h2>
          <p>看看熟悉的软件有哪些新变化</p>
        </div>
        <NuxtLink to="/software?sortBy=updated" class="section-link">查看全部</NuxtLink>
      </header>
      <div class="catalog-grid">
        <CatalogCard v-for="s in recent.items" :key="s.id" :software="s" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  max-width: 1248px;
  margin-inline: auto;
}

.home-hero {
  padding: 44px 0 40px;
}
.hero-eyebrow {
  margin-bottom: 12px;
  color: var(--ui-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.home-hero h1 {
  max-width: 620px;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.25;
  color: var(--ui-text-highlighted);
}
.hero-desc {
  max-width: 560px;
  margin-top: 12px;
  color: var(--ui-text-muted);
  font-size: 14px;
  line-height: 1.7;
}
.hero-desc strong {
  color: var(--ui-primary);
}

.hero-search {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 540px;
  margin-top: 24px;
  padding: 6px 6px 6px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  background: var(--ui-bg);
}
.hero-search-icon {
  width: 17px;
  height: 17px;
  color: var(--ui-text-dimmed);
}
.hero-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--ui-text);
  font-size: 13.5px;
  outline: none;
}
.hero-search input::placeholder {
  color: var(--ui-text-dimmed);
}
.hero-search input::-webkit-search-cancel-button {
  display: none;
}
.hero-search button {
  padding: 9px 18px;
  border: 0;
  border-radius: 10px;
  background: var(--ui-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.hero-search button:hover {
  opacity: 0.92;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
}
.primary-action,
.ghost-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 13px;
  text-decoration: none;
}
.primary-action {
  border: 1px solid color-mix(in srgb, var(--ui-primary) 35%, transparent);
  background: var(--distribution-soft);
  color: var(--ui-primary);
  font-weight: 500;
}
.primary-action :deep(svg) {
  width: 15px;
  height: 15px;
}
.ghost-action {
  border: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
}
.ghost-action:hover {
  border-color: color-mix(in srgb, var(--ui-primary) 40%, var(--ui-border));
  color: var(--ui-primary);
}

.home-section + .home-section {
  margin-top: 44px;
}
.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.section-head h2 {
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.015em;
  color: var(--ui-text-highlighted);
}
.section-head p {
  margin-top: 4px;
  color: var(--ui-text-muted);
  font-size: 13px;
}
.section-link {
  flex-shrink: 0;
  color: var(--ui-text-muted);
  font-size: 12.5px;
  text-decoration: none;
}
.section-link:hover {
  color: var(--ui-primary);
}

.featured-grid {
  display: grid;
  gap: 12px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.category-tile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 12px;
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 13px;
  text-decoration: none;
  transition: background var(--yueli-motion-fast), border-color var(--yueli-motion-fast);
}
.category-tile:hover {
  background: var(--distribution-soft);
  border-color: color-mix(in srgb, var(--ui-primary) 30%, var(--ui-border));
}
.tile-icon {
  width: 15px;
  height: 15px;
  color: var(--ui-primary);
}
.tile-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.tile-count {
  margin-left: auto;
  color: var(--ui-text-dimmed);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

@media (width <= 1023px) {
  .category-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 639px) {
  .home-hero {
    padding: 28px 0 24px;
  }
  .home-hero h1 {
    font-size: 25px;
  }
  .hero-search {
    flex-wrap: wrap;
  }
  .category-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .section-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}
</style>
