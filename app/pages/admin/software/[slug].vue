<script setup lang="ts">
import type { Software, Release } from '~~/server/utils/repo'
import { emptyReleaseForm, type ReleaseFormValue, type SoftwareFormValue } from '~/types/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data: categoryData } = await useFetch('/api/distribution/categories')

const { data, refresh, error } = await useFetch<{
  software: Software
  releases: Release[]
}>(() => `/api/distribution/software/${slug.value}`, { key: () => `admin-sw-${slug.value}` })

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: '软件不存在', fatal: true })
}

/* ---------------------------------------------------------------- 基本信息 */

const form = ref<SoftwareFormValue>({
  slug: '',
  name: '',
  summary: '',
  description: '',
  releaseNotes: '',
  usageInstructions: '',
  faq: '',
  githubUrl: '',
  websiteUrl: '',
  documentationUrl: '',
  iconUrl: '',
  categoryId: null,
  platforms: [],
  recommended: false,
  status: 'active'
})

watchEffect(() => {
  const s = data.value?.software
  if (!s) return
  form.value = {
    id: s.id,
    slug: s.slug,
    name: s.name,
    summary: s.summary,
    description: s.description,
    releaseNotes: s.releaseNotes,
    usageInstructions: s.usageInstructions,
    faq: s.faq,
    githubUrl: s.githubUrl,
    websiteUrl: s.websiteUrl,
    documentationUrl: s.documentationUrl,
    iconUrl: s.iconUrl,
    categoryId: s.categoryId,
    platforms: [...s.platforms],
    recommended: s.recommended,
    status: s.status
  }
})

const saving = ref(false)
const saveMessage = ref('')
const saveError = ref('')

async function save() {
  saving.value = true
  saveError.value = ''
  saveMessage.value = ''
  try {
    await $fetch(`/api/distribution/software/${slug.value}`, {
      method: 'PUT',
      body: form.value
    })
    saveMessage.value = '已保存'
    if (form.value.slug !== slug.value) {
      await navigateTo(`/admin/software/${form.value.slug}`, { replace: true })
      return
    }
    await refresh()
    setTimeout(() => (saveMessage.value = ''), 2400)
  } catch (e: any) {
    saveError.value = e?.data?.statusMessage || e?.statusMessage || '保存失败'
  } finally {
    saving.value = false
  }
}

async function removeSoftware() {
  const name = data.value?.software?.name ?? ''
  if (!confirm(`确定删除「${name}」？该操作不可撤销。`)) return
  await $fetch(`/api/distribution/software/${slug.value}`, { method: 'DELETE' })
  await navigateTo('/admin/software')
}

/* ------------------------------------------------------------------ 版本 */

const releases = computed(() => data.value?.releases ?? [])
const releaseForm = ref<ReleaseFormValue>(emptyReleaseForm())
const releaseBusy = ref(false)
const releaseError = ref('')

async function addRelease() {
  if (!data.value?.software) return
  releaseError.value = ''
  releaseBusy.value = true
  try {
    await $fetch('/api/distribution/releases', {
      method: 'POST',
      body: {
        ...releaseForm.value,
        softwareId: data.value.software.id,
        sizeBytes: Number(releaseForm.value.sizeBytes) || 0
      }
    })
    releaseForm.value = emptyReleaseForm()
    await refresh()
  } catch (e: any) {
    releaseError.value = e?.data?.statusMessage || '添加失败'
  } finally {
    releaseBusy.value = false
  }
}

async function removeRelease(r: Release) {
  if (!confirm(`删除版本「${r.version || r.fileName || r.id}」？`)) return
  await $fetch(`/api/distribution/releases/${r.id}`, { method: 'DELETE' })
  await refresh()
}

useHead({ title: () => `编辑 · ${data.value?.software?.name ?? ''}` })
</script>

<template>
  <div class="admin-page">
    <header class="page-head">
      <div class="head-left">
        <NuxtLink to="/admin/software" class="back-link">
          <Icon name="i-tabler:arrow-left" />
          软件管理
        </NuxtLink>
        <h1>{{ data?.software?.name }}</h1>
        <span class="head-slug">/software/{{ data?.software?.slug }}</span>
      </div>
      <NuxtLink :to="`/software/${slug}`" target="_blank" class="ghost-button">
        <Icon name="i-tabler:eye" />
        预览前台
      </NuxtLink>
    </header>

    <SoftwareForm
      v-model="form"
      :categories="categoryData?.items ?? []"
      submit-label="保存修改"
      :busy="saving"
      :error-message="saveError"
      @submit="save"
    >
      <template #extra-actions>
        <span v-if="saveMessage" class="save-ok">{{ saveMessage }}</span>
        <button type="button" class="danger-button" @click="removeSoftware">删除软件</button>
      </template>
    </SoftwareForm>

    <section class="panel">
      <h2 class="panel-title">版本记录 <span class="panel-count">{{ releases.length }}</span></h2>

      <ul v-if="releases.length" class="release-rows">
        <li v-for="r in releases" :key="r.id" class="release-row">
          <div class="release-cell-main">
            <span class="release-version">{{ r.version || '未命名版本' }}</span>
            <span class="release-chip">{{ r.platform || '通用' }}</span>
            <span v-if="r.architecture" class="release-chip">{{ r.architecture }}</span>
            <span v-if="r.channel !== 'stable'" class="release-chip">{{ r.channel }}</span>
          </div>
          <div class="release-cell-sub">
            <span v-if="r.fileName" class="release-file">{{ r.fileName }}</span>
            <span v-if="r.sizeBytes">{{ formatBytes(r.sizeBytes) }}</span>
            <span v-if="r.publishedAt">{{ formatDate(r.publishedAt) }}</span>
          </div>
          <button type="button" class="row-action is-danger" @click="removeRelease(r)">删除</button>
        </li>
      </ul>
      <p v-else class="panel-empty">还没有版本记录，用下面的表单添加第一个。</p>

      <form class="release-form" @submit.prevent="addRelease">
        <div class="release-form-grid">
          <label class="field">
            <span class="field-label">版本号</span>
            <input v-model="releaseForm.version" type="text" placeholder="26.03" />
          </label>
          <label class="field">
            <span class="field-label">平台</span>
            <select v-model="releaseForm.platform">
              <option value="">通用</option>
              <option value="windows">Windows</option>
              <option value="macos">macOS</option>
              <option value="linux">Linux</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">架构</span>
            <input v-model="releaseForm.architecture" type="text" placeholder="x64 / arm64" />
          </label>
          <label class="field">
            <span class="field-label">通道</span>
            <select v-model="releaseForm.channel">
              <option value="stable">stable</option>
              <option value="beta">beta</option>
              <option value="nightly">nightly</option>
            </select>
          </label>
          <label class="field field-full">
            <span class="field-label">下载地址</span>
            <input v-model="releaseForm.downloadUrl" type="url" placeholder="https://…" />
          </label>
          <label class="field">
            <span class="field-label">文件名</span>
            <input v-model="releaseForm.fileName" type="text" placeholder="7z2603-x64.exe" />
          </label>
          <label class="field">
            <span class="field-label">文件大小（字节）</span>
            <input v-model="releaseForm.sizeBytes" type="number" min="0" placeholder="1234567" />
          </label>
          <label class="field field-full">
            <span class="field-label">SHA-256</span>
            <input v-model="releaseForm.sha256" type="text" placeholder="可选" />
          </label>
        </div>
        <p v-if="releaseError" class="form-error">{{ releaseError }}</p>
        <button type="submit" class="primary-button" :disabled="releaseBusy">
          {{ releaseBusy ? '添加中…' : '添加版本' }}
        </button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 8px;
  color: var(--ui-text-muted);
  font-size: 12.5px;
  text-decoration: none;
}
.back-link:hover {
  color: var(--ui-primary);
}
.back-link :deep(svg) {
  width: 14px;
  height: 14px;
}
.page-head h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ui-text-highlighted);
}
.head-slug {
  display: block;
  margin-top: 4px;
  color: var(--ui-text-dimmed);
  font-family: var(--font-mono);
  font-size: 11.5px;
}
.ghost-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  color: var(--ui-text-muted);
  font-size: 12.5px;
  text-decoration: none;
}
.ghost-button:hover {
  border-color: color-mix(in srgb, var(--ui-primary) 40%, var(--ui-border));
  color: var(--ui-primary);
}
.ghost-button :deep(svg) {
  width: 15px;
  height: 15px;
}

.save-ok {
  color: var(--ui-success);
  font-size: 12.5px;
}
.danger-button {
  padding: 10px 16px;
  border: 1px solid color-mix(in srgb, var(--ui-error) 35%, transparent);
  border-radius: 10px;
  background: transparent;
  color: var(--ui-error);
  font-size: 13px;
  cursor: pointer;
}
.danger-button:hover {
  background: color-mix(in srgb, var(--ui-error) 10%, transparent);
}

.panel {
  margin-top: 22px;
  padding: 22px;
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
.panel-count {
  margin-left: 6px;
  color: var(--ui-text-dimmed);
  font-size: 12px;
  font-weight: 400;
}
.panel-empty {
  margin-bottom: 16px;
  color: var(--ui-text-muted);
  font-size: 13px;
}

.release-rows {
  display: grid;
  gap: 6px;
  margin-bottom: 20px;
}
.release-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 11px 13px;
  border: 1px solid var(--ui-border);
  border-radius: 11px;
}
.release-cell-main {
  display: flex;
  align-items: center;
  gap: 7px;
}
.release-version {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
}
.release-chip {
  padding: 2px 7px;
  border-radius: 5px;
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
  font-size: 11px;
}
.release-cell-sub {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ui-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.release-file {
  max-width: 240px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.release-form {
  padding-top: 18px;
  border-top: 1px solid var(--ui-border);
}
.release-form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
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
.field input,
.field select {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 13px;
  outline: none;
}
.field input:focus,
.field select:focus {
  border-color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-border));
}
.form-error {
  margin-bottom: 12px;
  color: var(--ui-error);
  font-size: 12.5px;
}
.primary-button {
  padding: 10px 18px;
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
.row-action {
  padding: 4px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 12.5px;
  cursor: pointer;
}
.row-action.is-danger:hover {
  color: var(--ui-error);
}

@media (width <= 767px) {
  .release-form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .release-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .release-cell-sub {
    grid-column: 1 / -1;
  }
}
</style>
