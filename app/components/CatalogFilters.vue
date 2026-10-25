<script setup lang="ts">
interface CategoryItem {
  id: string
  name: string
  slug?: string
  total?: number
}

const props = defineProps<{
  categories: CategoryItem[]
  activeCategory?: string
  activePlatform?: string
  counts?: { all?: number; categories?: Record<string, number>; platforms?: Record<string, number> } | null
  /** 移动端抽屉里使用时隐藏标题 */
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:category', value: string): void
  (e: 'update:platform', value: string): void
}>()

const PLATFORMS = [
  { key: 'windows', label: 'Windows', icon: 'i-tabler:brand-windows-filled' },
  { key: 'macos', label: 'macOS', icon: 'i-tabler:brand-apple-filled' },
  { key: 'linux', label: 'Linux', icon: 'i-tabler:brand-ubuntu' },
  { key: 'android', label: 'Android', icon: 'i-tabler:brand-android' }
]

const catCount = (id: string) => props.counts?.categories?.[id] ?? null
const platCount = (key: string) => props.counts?.platforms?.[key] ?? null
</script>

<template>
  <div class="catalog-filter-groups">
    <section class="filter-group">
      <h3 class="filter-group-title">分类</h3>
      <div class="filter-group-items">
        <button
          type="button"
          class="filter-chip"
          :class="{ 'is-active': !activeCategory }"
          @click="emit('update:category', '')"
        >
          <span>全部分类</span>
          <span class="filter-chip-count">{{ counts?.all ?? '' }}</span>
        </button>
        <button
          v-for="c in categories"
          :key="c.id"
          type="button"
          class="filter-chip"
          :class="{ 'is-active': activeCategory === c.id }"
          :title="c.name"
          @click="emit('update:category', c.id)"
        >
          <span class="filter-chip-label">{{ c.name }}</span>
          <span v-if="catCount(c.id) !== null" class="filter-chip-count">{{ catCount(c.id) }}</span>
        </button>
      </div>
    </section>

    <section class="filter-group">
      <h3 class="filter-group-title">平台</h3>
      <div class="filter-group-items">
        <button
          type="button"
          class="filter-chip"
          :class="{ 'is-active': !activePlatform }"
          @click="emit('update:platform', '')"
        >
          <span>全部平台</span>
        </button>
        <button
          v-for="p in PLATFORMS"
          :key="p.key"
          type="button"
          class="filter-chip"
          :class="{ 'is-active': activePlatform === p.key }"
          @click="emit('update:platform', activePlatform === p.key ? '' : p.key)"
        >
          <Icon :name="p.icon" class="chip-icon" aria-hidden="true" />
          <span>{{ p.label }}</span>
          <span v-if="platCount(p.key) !== null" class="filter-chip-count">{{ platCount(p.key) }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.filter-group-items {
  flex-direction: column;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background var(--yueli-motion-fast), color var(--yueli-motion-fast),
    border-color var(--yueli-motion-fast);
}

.filter-chip:hover {
  background: var(--distribution-soft);
  color: var(--ui-text);
}

.filter-chip.is-active {
  border-color: color-mix(in srgb, var(--ui-primary) 28%, transparent);
  background: var(--distribution-soft);
  color: var(--ui-primary);
  font-weight: 500;
}

.filter-chip-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.filter-chip-count {
  margin-left: auto;
  color: var(--ui-text-dimmed);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.filter-chip.is-active .filter-chip-count {
  color: color-mix(in srgb, var(--ui-primary) 70%, transparent);
}

.chip-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
}

.catalog-filter-groups :deep(.filter-group-items) {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
