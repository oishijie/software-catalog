<script setup lang="ts">
import type { CatalogCardItem } from '~~/server/utils/repo'

const props = withDefaults(
  defineProps<{
    software: CatalogCardItem
    /** compact = 目录页卡片墙；default = 横向大卡片 */
    variant?: 'default' | 'compact'
  }>(),
  { variant: 'compact' }
)

const updatedLabel = computed(() => {
  const d = new Date(props.software.updatedAt)
  if (Number.isNaN(d.getTime())) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd} 更新`
})

const updatedTitle = computed(() => {
  const d = new Date(props.software.updatedAt)
  if (Number.isNaN(d.getTime())) return ''
  return `更新于 ${d.toISOString().slice(0, 10)}`
})

const downloadLabel = computed(() => {
  const n = props.software.downloadCount
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
})

const summary = computed(
  () => props.software.summary || props.software.description || '查看软件与版本信息'
)
</script>

<template>
  <NuxtLink
    :to="`/software/${software.slug}`"
    class="catalog-card"
    :class="{ 'catalog-card-compact': variant === 'compact' }"
    :aria-label="`${software.name}，查看详情`"
  >
    <SoftwareGlyph :name="software.name" :icon-url="software.iconUrl" />

    <div class="catalog-card-content">
      <div class="catalog-card-heading">
        <h2 :title="software.name">{{ software.name }}</h2>
      </div>

      <p class="catalog-card-summary" :title="summary">{{ summary }}</p>

      <div class="catalog-card-tags">
        <span
          v-if="software.categoryName"
          class="catalog-category"
          :title="software.categoryName"
        >
          <Icon name="i-tabler:category" class="tag-icon" aria-hidden="true" />
          {{ software.categoryName }}
        </span>
      </div>

      <div class="catalog-card-meta">
        <PlatformIcons :platforms="software.platforms" />
        <span class="catalog-downloads" :title="`${software.downloadCount} 次下载入口点击`">
          <Icon name="i-tabler:download" class="meta-icon" aria-hidden="true" />
          {{ downloadLabel }}
        </span>
        <time :datetime="software.updatedAt" :title="updatedTitle">{{ updatedLabel }}</time>
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.tag-icon {
  width: 12px;
  height: 12px;
}
.meta-icon {
  width: 14px;
  height: 14px;
}
</style>
