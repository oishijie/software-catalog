<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name: string
    iconUrl?: string
    /** 0-3，缺失时按名称哈希取色 */
    tone?: number
  }>(),
  { iconUrl: '', tone: -1 }
)

const resolvedTone = computed(() => {
  if (props.tone >= 0) return props.tone
  const s = props.name || ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 4
})
</script>

<template>
  <!-- 结构与原站一致：有 logo 时套一层裁剪容器，无 logo 时用几何占位图形 -->
  <span class="software-glyph" :class="{ 'has-logo': !!iconUrl }" :data-tone="resolvedTone" aria-hidden="true">
    <span
      v-if="iconUrl"
      class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-transparent size-full !rounded-none"
    >
      <img :src="iconUrl" :alt="`${name} 软件 Logo`" loading="lazy" decoding="async" class="size-full object-contain" />
    </span>
    <svg v-else viewBox="0 0 64 64" fill="none">
      <path
        d="m32 7 22 12v26L32 57 10 45V19Z"
        fill="currentColor"
        fill-opacity=".08"
        stroke="currentColor"
        stroke-width="3.5"
        stroke-linejoin="round"
      />
      <path d="m10 19 22 13 22-13M32 32v25" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" />
      <path d="m12 19 20-11 20 11-20 11Z" fill="white" fill-opacity=".7" />
      <path d="m34 34 18-10v20L34 54Z" fill="currentColor" fill-opacity=".12" />
    </svg>
  </span>
</template>
