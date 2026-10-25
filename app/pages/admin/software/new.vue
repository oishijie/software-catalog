<script setup lang="ts">
import { emptySoftwareForm, type SoftwareFormValue } from '~/types/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { data: categoryData } = await useFetch('/api/distribution/categories')

const form = ref<SoftwareFormValue>(emptySoftwareForm())
const busy = ref(false)
const errorMessage = ref('')

async function submit() {
  errorMessage.value = ''
  busy.value = true
  try {
    const created = await $fetch<{ slug: string }>('/api/distribution/software', {
      method: 'POST',
      body: form.value
    })
    await navigateTo(`/admin/software/${created.slug}`)
  } catch (e: any) {
    errorMessage.value = e?.data?.statusMessage || e?.statusMessage || '保存失败'
  } finally {
    busy.value = false
  }
}

useHead({ title: '新建软件' })
</script>

<template>
  <div class="admin-page">
    <header class="page-head">
      <div>
        <NuxtLink to="/admin/software" class="back-link">
          <Icon name="i-tabler:arrow-left" />
          软件管理
        </NuxtLink>
        <h1>新建软件</h1>
      </div>
    </header>

    <SoftwareForm
      v-model="form"
      :categories="categoryData?.items ?? []"
      submit-label="创建软件"
      :busy="busy"
      :error-message="errorMessage"
      @submit="submit"
    />
  </div>
</template>

<style scoped>
.page-head {
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
</style>
