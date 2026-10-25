<script setup lang="ts">
import type { Category } from '~~/server/utils/repo'
import type { SoftwareFormValue } from '~/types/admin'

const props = defineProps<{
  modelValue: SoftwareFormValue
  categories: Category[]
  submitLabel?: string
  busy?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: SoftwareFormValue): void
  (e: 'submit'): void
}>()

const PLATFORM_OPTIONS = [
  { key: 'windows', label: 'Windows', icon: 'i-tabler:brand-windows-filled' },
  { key: 'macos', label: 'macOS', icon: 'i-tabler:brand-apple-filled' },
  { key: 'linux', label: 'Linux', icon: 'i-tabler:brand-ubuntu' },
  { key: 'android', label: 'Android', icon: 'i-tabler:brand-android' },
  { key: 'ios', label: 'iOS', icon: 'i-tabler:brand-apple' }
]

const form = computed(() => props.modelValue)

function patch(part: Partial<SoftwareFormValue>) {
  emit('update:modelValue', { ...props.modelValue, ...part })
}

function togglePlatform(key: string) {
  const has = props.modelValue.platforms.includes(key)
  patch({
    platforms: has
      ? props.modelValue.platforms.filter((p) => p !== key)
      : [...props.modelValue.platforms, key]
  })
}

function slugify(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const slugTouched = ref(!!props.modelValue.slug)
function onNameInput(e: Event) {
  const name = (e.target as HTMLInputElement).value
  if (slugTouched.value) {
    patch({ name })
  } else {
    patch({ name, slug: slugify(name) })
  }
}
</script>

<template>
  <form class="sw-form" @submit.prevent="emit('submit')">
    <div class="form-grid">
      <label class="field">
        <span class="field-label">名称 <em>*</em></span>
        <input :value="form.name" type="text" required placeholder="例如 7-Zip" @input="onNameInput" />
      </label>

      <label class="field">
        <span class="field-label">路径 slug</span>
        <input
          :value="form.slug"
          type="text"
          placeholder="7zip"
          @input="(e) => { slugTouched = true; patch({ slug: (e.target as HTMLInputElement).value }) }"
        />
      </label>

      <label class="field field-full">
        <span class="field-label">一句话简介</span>
        <input
          :value="form.summary"
          type="text"
          placeholder="支持多种格式的文件压缩与解压工具。"
          @input="patch({ summary: (e.target as HTMLInputElement).value })"
        />
      </label>

      <label class="field">
        <span class="field-label">分类</span>
        <select
          :value="form.categoryId ?? ''"
          @change="patch({ categoryId: (e.target as HTMLSelectElement).value || null })"
        >
          <option value="">（未分类）</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">状态</span>
        <select :value="form.status" @change="patch({ status: (e.target as HTMLSelectElement).value })">
          <option value="active">上架</option>
          <option value="hidden">下架</option>
        </select>
      </label>

      <div class="field field-full">
        <span class="field-label">适用平台</span>
        <div class="platform-picker">
          <button
            v-for="p in PLATFORM_OPTIONS"
            :key="p.key"
            type="button"
            class="platform-chip"
            :class="{ 'is-on': form.platforms.includes(p.key) }"
            @click="togglePlatform(p.key)"
          >
            <Icon :name="p.icon" />
            {{ p.label }}
          </button>
        </div>
      </div>

      <label class="field field-full">
        <span class="field-label">图标地址</span>
        <input
          :value="form.iconUrl"
          type="text"
          placeholder="/media/xxx.webp 或 https://…"
          @input="patch({ iconUrl: (e.target as HTMLInputElement).value })"
        />
      </label>

      <label class="field">
        <span class="field-label">官方网站</span>
        <input
          :value="form.websiteUrl"
          type="url"
          placeholder="https://www.7-zip.org"
          @input="patch({ websiteUrl: (e.target as HTMLInputElement).value })"
        />
      </label>

      <label class="field">
        <span class="field-label">GitHub</span>
        <input
          :value="form.githubUrl"
          type="url"
          placeholder="https://github.com/…"
          @input="patch({ githubUrl: (e.target as HTMLInputElement).value })"
        />
      </label>

      <label class="field field-full">
        <span class="field-label">文档地址</span>
        <input
          :value="form.documentationUrl"
          type="url"
          placeholder="https://…"
          @input="patch({ documentationUrl: (e.target as HTMLInputElement).value })"
        />
      </label>

      <label class="field field-full">
        <span class="field-label">详细描述</span>
        <textarea
          :value="form.description"
          rows="3"
          placeholder="用于详情页的补充说明"
          @input="patch({ description: (e.target as HTMLTextAreaElement).value })"
        />
      </label>

      <label class="field field-full">
        <span class="field-label">使用说明（支持 Markdown）</span>
        <textarea
          :value="form.usageInstructions"
          rows="4"
          placeholder="1. 下载对应平台的安装包&#10;2. 安装后…"
          @input="patch({ usageInstructions: (e.target as HTMLTextAreaElement).value })"
        />
      </label>

      <label class="field field-full">
        <span class="field-label">更新日志（支持 Markdown）</span>
        <textarea
          :value="form.releaseNotes"
          rows="5"
          placeholder="### 26.03&#10;- 修复了 …"
          @input="patch({ releaseNotes: (e.target as HTMLTextAreaElement).value })"
        />
      </label>

      <label class="field field-full">
        <span class="field-label">常见问题</span>
        <textarea
          :value="form.faq"
          rows="3"
          placeholder="系统要求和功能限制以官方说明为准。"
          @input="patch({ faq: (e.target as HTMLTextAreaElement).value })"
        />
      </label>

      <label class="switch-field field-full">
        <input
          type="checkbox"
          :checked="form.recommended"
          @change="patch({ recommended: (e.target as HTMLInputElement).checked })"
        />
        <span>在首页「精选软件」中展示</span>
      </label>
    </div>

    <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>

    <div class="form-actions">
      <button type="submit" class="form-submit" :disabled="busy || !form.name">
        {{ busy ? '保存中…' : submitLabel || '保存' }}
      </button>
      <slot name="extra-actions" />
    </div>
  </form>
</template>

<style scoped>
.sw-form {
  padding: 22px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--ui-bg);
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.field {
  display: block;
  min-width: 0;
}
.field-full {
  grid-column: 1 / -1;
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
.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-bg);
  color: var(--ui-text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  resize: vertical;
}
.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-border));
}
.field textarea {
  line-height: 1.6;
}

.platform-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.platform-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--ui-border);
  border-radius: 9px;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 12.5px;
  cursor: pointer;
}
.platform-chip.is-on {
  border-color: color-mix(in srgb, var(--ui-primary) 40%, transparent);
  background: var(--distribution-soft);
  color: var(--ui-primary);
  font-weight: 500;
}
.platform-chip :deep(svg) {
  width: 14px;
  height: 14px;
}

.switch-field {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ui-text-muted);
  font-size: 12.5px;
  cursor: pointer;
}
.switch-field input {
  width: 16px;
  height: 16px;
  accent-color: var(--ui-primary);
}

.form-error {
  margin-top: 14px;
  color: var(--ui-error);
  font-size: 12.5px;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}
.form-submit {
  padding: 10px 20px;
  border: 0;
  border-radius: 10px;
  background: var(--ui-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.form-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (width <= 767px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
