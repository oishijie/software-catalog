<script setup lang="ts">
const props = defineProps<{
  platforms?: string[]
  /** 只显示图标，不显示名称 */
  iconsOnly?: boolean
}>()

const ALL: Record<string, { label: string; icon: string }> = {
  windows: { label: 'Windows', icon: 'i-tabler:brand-windows-filled' },
  macos: { label: 'macOS', icon: 'i-tabler:brand-apple-filled' },
  linux: { label: 'Linux', icon: 'i-tabler:brand-ubuntu' },
  android: { label: 'Android', icon: 'i-tabler:brand-android' },
  ios: { label: 'iOS', icon: 'i-tabler:brand-apple' }
}

// 保持稳定顺序，与原站一致：Android → Linux → macOS → Windows
const ORDER = ['android', 'linux', 'macos', 'windows', 'ios']

const list = computed(() =>
  ORDER.filter((k) => (props.platforms ?? []).includes(k)).map((k) => ({ key: k, ...ALL[k] }))
)

const title = computed(() => `适用平台：${list.value.map((p) => p.label).join('、') || '未知'}`)
</script>

<template>
  <span class="catalog-platforms" :title="title" :aria-label="title">
    <Icon
      v-for="p in list"
      :key="p.key"
      :name="p.icon"
      class="platform-icon"
      aria-hidden="true"
    />
  </span>
</template>

<style scoped>
.platform-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--ui-text-muted);
}
</style>
