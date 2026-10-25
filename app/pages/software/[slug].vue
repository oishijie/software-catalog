<script setup lang="ts">
import type { Software, Release } from '~~/server/utils/repo'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data, error } = await useFetch<{
  software: Software
  releases: Release[]
  related: Software[]
}>(() => `/api/distribution/software/${slug.value}`)

if (error.value || !data.value) {
  throw createError({
    statusCode: 404,
    statusMessage: '软件不存在',
    message: `未找到软件「${slug.value}」`,
    fatal: true
  })
}

const software = computed(() => data.value!.software)
const releases = computed(() => data.value!.releases ?? [])
const related = computed(() => (data.value!.related ?? []).slice(0, 3))

/* ---------------- 摘要：summary 为空时取正文首段 ---------------- */
const summary = computed(() => {
  const s = software.value.summary?.trim()
  if (s) return s
  const first = (software.value.description || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && !l.startsWith('!') && !l.startsWith('-'))
  return first || '查看软件与版本信息'
})

/* ---------------- 版本 / 体积 / 日期 ---------------- */
const PLATFORM_PRIORITY = ['windows', 'linux', 'macos', 'android', 'ios']

/** 主推包：按平台优先级挑一个已发布版本 */
const primaryRelease = computed<Release | null>(() => {
  const list = releases.value.filter((r) => r.status !== 'draft')
  if (!list.length) return null
  const latest = list[0].version
  const sameVersion = list.filter((r) => r.version === latest)
  for (const p of PLATFORM_PRIORITY) {
    const hit = sameVersion.find((r) => r.platform === p)
    if (hit) return hit
  }
  return sameVersion[0]
})

const versionText = computed(() => (primaryRelease.value ? `v${primaryRelease.value.version}` : ''))
const sizeText = computed(() => formatBytes(primaryRelease.value?.sizeBytes))
const dateText = computed(() => {
  const iso = primaryRelease.value?.publishedAt || software.value.updatedAt
  return formatDateSlash(iso)
})
const channelBadge = computed(() =>
  primaryRelease.value?.channel === 'stable' ? '正式版' : primaryRelease.value?.channel || ''
)
const downloadsText = computed(() => Number(software.value.downloadCount || 0).toLocaleString('en-US'))

/* ---------------- 平台标签（顺序与原站一致：Windows → macOS → Linux → Android） ---------------- */
const DISPLAY_ORDER = ['windows', 'macos', 'linux', 'android', 'ios']
const platforms = computed(() =>
  DISPLAY_ORDER.filter((p) => (software.value.platforms ?? []).includes(p)).map((p) => ({
    key: p,
    label: PLATFORM_LABEL[p],
    icon: PLATFORM_ICON[p]
  }))
)

/* ---------------- Tab ---------------- */
const TABS = [
  { key: 'intro', short: '介绍', long: '软件介绍', icon: 'i-tabler:file-description' },
  { key: 'notes', short: '更新', long: '更新日志', icon: 'i-tabler:calendar' },
  { key: 'downloads', short: '下载', long: '下载地址', icon: 'i-tabler:download' },
  { key: 'usage', short: '使用', long: '使用说明', icon: 'i-tabler:book' },
  { key: 'faq', short: '问答', long: '常见问题', icon: 'i-tabler:help-circle' }
] as const

const activeTab = ref<string>('intro')
const currentTab = computed(() => TABS.find((t) => t.key === activeTab.value) ?? TABS[0])

const proseHtml = computed(() => ({
  intro: renderMarkdown(software.value.description),
  notes: renderMarkdown(software.value.releaseNotes),
  usage: renderMarkdown(software.value.usageInstructions),
  faq: renderMarkdown(software.value.faq)
}))

/* ---------------- 下载：按平台分组 ---------------- */
const downloadGroups = computed(() => {
  const map = new Map<string, Release[]>()
  for (const r of releases.value) {
    const k = r.platform || 'other'
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  }
  return [...map.entries()]
    .sort((a, b) => {
      const ia = PLATFORM_PRIORITY.indexOf(a[0])
      const ib = PLATFORM_PRIORITY.indexOf(b[0])
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
    .map(([platform, items]) => ({
      platform,
      label: PLATFORM_LABEL[platform] || platform,
      icon: PLATFORM_ICON[platform] || 'i-tabler:package',
      items
    }))
})

const activePlatform = ref('')
watchEffect(() => {
  if (!downloadGroups.value.length) return
  if (!downloadGroups.value.some((g) => g.platform === activePlatform.value)) {
    activePlatform.value = downloadGroups.value[0].platform
  }
})
const currentGroup = computed(
  () => downloadGroups.value.find((g) => g.platform === activePlatform.value) ?? null
)

/* ---------------- 下载来源：中文标签 ---------------- */
const ARCH_LABEL: Record<string, string> = {
  universal: '通用版',
  x64: '64 位',
  amd64: '64 位',
  x86_64: '64 位',
  x86: '32 位',
  i386: '32 位',
  ia32: '32 位',
  arm64: 'ARM64',
  aarch64: 'ARM64',
  armv7: 'ARM32',
  arm: 'ARM32',
  noarch: '通用版'
}

function archLabel(r: Release): string {
  const a = (r.architecture || '').toLowerCase()
  if (!a) return '通用版'
  return ARCH_LABEL[a] || r.architecture.toUpperCase()
}

const CHANNEL_LABEL: Record<string, string> = {
  stable: '正式版',
  latest: '正式版',
  release: '正式版',
  beta: '测试版',
  rc: '候选版',
  alpha: 'Alpha',
  nightly: '每日构建',
  canary: '金丝雀版',
  preview: '预览版',
  dev: '开发版'
}

function channelLabel(r: Release): string {
  const c = (r.channel || '').toLowerCase()
  if (!c) return '正式版'
  return CHANNEL_LABEL[c] || r.channel
}

const EXT_LABEL: Record<string, string> = {
  apk: 'APK',
  exe: 'EXE',
  dmg: 'DMG',
  msi: 'MSI',
  pkg: 'PKG',
  ipa: 'IPA',
  zip: 'ZIP',
  '7z': '7Z',
  rar: 'RAR',
  gz: 'GZ',
  xz: 'XZ',
  tgz: 'TGZ',
  deb: 'DEB',
  rpm: 'RPM',
  appimage: 'AppImage',
  flatpak: 'Flatpak',
  snap: 'Snap',
  jar: 'JAR'
}

function fileTypeLabel(name: string): string {
  const ext = (name || '').toLowerCase().split('.').pop() || ''
  if (!ext || ext === name.toLowerCase()) return ''
  return EXT_LABEL[ext] || (ext.length <= 5 ? ext.toUpperCase() : '')
}

/* ---------------- 行为 ---------------- */
function goDownloads() {
  activeTab.value = 'downloads'
  if (import.meta.client) {
    document.getElementById('software-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

async function onDownload(release?: Release | null) {
  // 线上有 Pages Functions 承接接口，计数可用；本地 dev 走 Node 服务同样可用
  try {
    await $fetch(`/api/distribution/download/${software.value.slug}`, { method: 'POST' })
  } catch {
    /* 计数失败不影响下载 */
  }
  const url = release?.downloadUrl
  if (url && import.meta.client) window.open(url, '_blank', 'noopener')
}

async function onShare() {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(window.location.href)
    toast('链接已复制')
  } catch {
    toast('复制失败，请手动复制地址栏链接')
  }
}

const toastText = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function toast(msg: string) {
  toastText.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastText.value = ''), 2200)
}

useSeoMeta({
  title: () => `${software.value.name} · 软件目录`,
  description: () => plainText(software.value.summary || software.value.description, 150)
})
</script>

<template>
  <div class="distribution-columns distribution-software-detail">
    <!-- ======================= 左列 ======================= -->
    <div class="min-w-0 space-y-4">
      <!-- 产品头部 -->
      <section class="distribution-panel">
        <header class="distribution-product-header">
          <SoftwareGlyph
            :name="software.name"
            :icon-url="software.iconUrl"
            :tone="1"
          />

          <div class="distribution-product-info min-w-0">
            <div class="flex flex-wrap items-center gap-3">
              <h1>{{ software.name }}</h1>
              <span
                v-if="software.recommended"
                class="font-medium inline-flex items-center text-xs px-2 py-1 gap-1 rounded-md bg-primary/10 text-primary"
              >
                <Icon name="i-tabler:star" class="shrink-0 size-4" aria-hidden="true" />
                精选
              </span>
            </div>

            <p class="distribution-product-summary mt-2 text-muted">{{ summary }}</p>

            <div v-if="platforms.length" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="p in platforms"
                :key="p.key"
                class="font-medium inline-flex items-center text-[10px]/3 px-1.5 py-1 gap-1 rounded-sm text-default bg-elevated"
              >
                <Icon :name="p.icon" class="shrink-0 size-3" aria-hidden="true" />
                {{ p.label }}
              </span>
            </div>
          </div>

          <div class="distribution-product-primary">
            <button
              type="button"
              class="rounded-md inline-flex items-center justify-center px-3 py-2 text-sm gap-2 text-inverted bg-primary hover:bg-primary/95 transition-colors disabled:opacity-75 distribution-primary-download"
              @click="releases.length ? onDownload(primaryRelease) : goDownloads()"
            >
              <Icon name="i-tabler:download" class="shrink-0 size-5" aria-hidden="true" />
              立即下载
            </button>
          </div>

          <div class="distribution-product-footer">
            <div class="distribution-product-meta">
              <span v-if="versionText"><Icon name="i-tabler:tag" />{{ versionText }}</span>
              <span v-if="sizeText"><Icon name="i-tabler:package" />{{ sizeText }}</span>
              <span><Icon name="i-tabler:calendar" />{{ dateText }}</span>
              <span class="cursor-help" title="累计下载次数">
                <Icon name="i-tabler:download" />{{ downloadsText }}
              </span>
            </div>

            <div class="distribution-product-secondary distribution-official-links">
              <a
                v-if="software.websiteUrl"
                :href="software.websiteUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded-md inline-flex items-center text-xs gap-1.5 text-primary hover:text-primary/75 p-0"
              >
                <Icon name="i-tabler:external-link" class="shrink-0 size-4" aria-hidden="true" />
                访问官网
              </a>
              <a
                v-if="software.documentationUrl"
                :href="software.documentationUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded-md inline-flex items-center text-xs gap-1.5 text-primary hover:text-primary/75 p-0"
              >
                <Icon name="i-tabler:book" class="shrink-0 size-4" aria-hidden="true" />
                阅读文档
              </a>
              <button
                type="button"
                class="rounded-md inline-flex items-center text-xs gap-1.5 text-muted hover:text-default p-0"
                @click="onShare"
              >
                <Icon name="i-tabler:share" class="shrink-0 size-4" aria-hidden="true" />
                分享
              </button>
            </div>
          </div>
        </header>
      </section>

      <!-- Tab 面板 -->
      <section id="software-tabs" class="distribution-panel min-w-0 overflow-hidden">
        <div class="flex items-center gap-2 flex-col distribution-content-tabs">
          <div
            class="relative flex p-1 border-default border-b w-full overflow-x-auto overflow-y-hidden mb-0 justify-start"
            role="tablist"
          >
            <button
              v-for="t in TABS"
              :key="t.key"
              type="button"
              role="tab"
              :aria-selected="activeTab === t.key"
              :data-state="activeTab === t.key ? 'active' : 'inactive'"
              class="group relative inline-flex items-center font-medium rounded-md transition-colors text-muted hover:text-default py-1.5 text-sm gap-1.5 min-w-0 flex-1 justify-center px-1 min-h-11 sm:min-h-0 sm:flex-none sm:px-3"
              @click="activeTab = t.key"
            >
              <Icon :name="t.icon" class="shrink-0 size-5 hidden sm:inline-block" aria-hidden="true" />
              <span class="truncate">
                <span class="sm:hidden">{{ t.short }}</span>
                <span class="hidden sm:inline">{{ t.long }}</span>
              </span>
            </button>
          </div>

          <!-- 介绍 / 更新日志 / 使用说明 / 常见问题 -->
          <div v-if="activeTab !== 'downloads'" class="distribution-introduction w-full">
            <h2 class="mb-4 flex items-center gap-2">
              <Icon :name="currentTab.icon" class="text-primary" aria-hidden="true" />
              {{ currentTab.long }}
            </h2>
            <div
              class="distribution-software-prose prose prose-sm max-w-none break-words dark:prose-invert prose-a:text-primary prose-headings:font-semibold"
              v-html="proseHtml[activeTab as 'intro' | 'notes' | 'usage' | 'faq']"
            />
          </div>

          <!-- 下载地址 -->
          <div v-else class="distribution-download-section w-full">
            <template v-if="downloadGroups.length">
              <!-- 标题 -->
              <header class="mb-4">
                <h2 class="flex items-center gap-2 text-xl font-semibold text-highlighted">
                  <Icon name="i-tabler:download" class="shrink-0 size-5 text-primary" aria-hidden="true" />
                  下载安装
                </h2>
                <p class="mt-1 text-[13px] text-muted">选择系统和处理器，再选择下载来源。</p>
              </header>

              <!-- 平台切换 -->
              <div class="distribution-platform-tabs mb-5">
                <div
                  class="relative flex p-1 rounded-lg bg-elevated w-full overflow-x-auto overflow-y-hidden"
                  role="tablist"
                >
                  <button
                    v-for="g in downloadGroups"
                    :key="g.platform"
                    type="button"
                    role="tab"
                    :aria-selected="activePlatform === g.platform"
                    :data-state="activePlatform === g.platform ? 'active' : 'inactive'"
                    class="group relative inline-flex items-center font-medium rounded-md transition-colors text-muted hover:text-default py-1.5 text-sm gap-1.5 whitespace-nowrap data-[state=active]:bg-default data-[state=active]:text-primary"
                    @click="activePlatform = g.platform"
                  >
                    <Icon :name="g.icon" class="shrink-0 size-4" aria-hidden="true" />
                    {{ g.label }}
                  </button>
                </div>
              </div>

              <!-- 当前平台下的每个版本：一个版本一组来源 -->
              <div class="space-y-6">
                <section v-for="r in currentGroup?.items ?? []" :key="r.id" class="distribution-download-group">
                  <div class="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <h3 class="flex items-center gap-1.5 text-sm font-semibold text-highlighted">
                      <Icon
                        :name="currentGroup?.icon || 'i-tabler:package'"
                        class="shrink-0 size-4 text-primary"
                        aria-hidden="true"
                      />
                      {{ currentGroup?.label }} 版本下载
                    </h3>
                    <span class="text-xs text-muted">{{ archLabel(r) }} · {{ channelLabel(r) }}</span>
                  </div>
                  <p class="mb-3 text-xs text-muted">
                    适用于 {{ currentGroup?.label }} · {{ archLabel(r) }}
                    <template v-if="r.version"> · v{{ r.version }}</template>
                  </p>

                  <div class="grid gap-3">
                    <div v-for="src in r.sources" :key="src.id" class="distribution-source-row">
                      <!-- 来源 -->
                      <div class="distribution-source-name">
                        <span class="distribution-source-icon">
                          <Icon :name="src.icon" class="size-5" aria-hidden="true" />
                        </span>
                        <div class="min-w-0">
                          <div class="truncate text-sm font-medium text-highlighted">{{ src.label }}</div>
                          <div class="mt-0.5 text-xs text-muted">{{ src.description }}</div>
                        </div>
                      </div>

                      <!-- 文件 -->
                      <div class="distribution-source-file">
                        <div class="truncate text-sm font-medium text-highlighted">
                          {{ r.fileName || `${software.name} ${r.version}` }}
                        </div>
                        <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <span class="rounded bg-elevated px-1.5 py-0.5 text-[11px]">
                            {{ currentGroup?.label }} {{ archLabel(r) }}
                          </span>
                          <span
                            v-if="fileTypeLabel(r.fileName)"
                            class="rounded bg-elevated px-1.5 py-0.5 text-[11px]"
                          >
                            {{ fileTypeLabel(r.fileName) }}
                          </span>
                          <span v-if="r.sizeBytes">{{ formatBytes(r.sizeBytes) }}</span>
                          <span v-if="r.sha256" class="inline-flex items-center gap-1">
                            <Icon name="i-tabler:fingerprint" class="size-3.5" aria-hidden="true" />
                            SHA256
                          </span>
                        </div>
                      </div>

                      <!-- 操作 -->
                      <div class="distribution-source-action">
                        <span class="rounded bg-elevated px-2 py-0.5 text-[11px] text-muted">{{ src.badge }}</span>
                        <a
                          v-if="src.url"
                          :href="src.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center justify-center gap-1.5 rounded-md border border-accented px-3 py-1.5 text-[13px] font-medium text-default transition-colors hover:bg-elevated"
                          @click="onDownload(r)"
                        >
                          <Icon name="i-tabler:external-link" class="shrink-0 size-4" aria-hidden="true" />
                          前往下载
                        </a>
                        <button
                          v-else
                          type="button"
                          class="inline-flex items-center justify-center gap-1.5 rounded-md border border-accented px-3 py-1.5 text-[13px] font-medium text-default transition-colors hover:bg-elevated"
                          @click="onDownload(r)"
                        >
                          <Icon name="i-tabler:download" class="shrink-0 size-4" aria-hidden="true" />
                          本站下载
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div class="distribution-download-help mt-5">
                <Icon name="i-tabler:info-circle" class="shrink-0 size-5 text-primary" aria-hidden="true" />
                <p class="text-xs leading-6 text-muted">
                  开源项目的文件取自 GitHub Release，并额外提供 GH-Proxy / GHFast 镜像加速。
                  若某个来源不可用，换用其它来源即可。
                </p>
              </div>
            </template>

            <div v-else class="flex flex-col items-center gap-3 py-10 text-center">
              <Icon name="i-tabler:package-off" class="size-8 text-dimmed" aria-hidden="true" />
              <p class="text-sm text-muted">这个软件还没有录入版本记录。</p>
              <a
                v-if="software.websiteUrl"
                :href="software.websiteUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-primary hover:underline"
              >
                前往官网获取 →
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- 评论区（静态 UI，与原站排版一致） -->
      <section class="distribution-panel distribution-detail-comments p-5">
        <section class="space-y-5">
          <header class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="yueli-comment-heading font-display flex items-center gap-2 font-semibold text-highlighted">
              <Icon name="i-tabler:messages" class="shrink-0 text-primary" aria-hidden="true" />
              评论
            </h2>
            <span class="text-xs tabular-nums text-dimmed">0 条讨论</span>
          </header>

          <div
            class="overflow-hidden rounded-xl border border-default bg-default transition-colors focus-within:border-primary"
          >
            <textarea
              rows="4"
              maxlength="5000"
              placeholder="分享使用体验，或提出问题…"
              class="w-full resize-none bg-transparent px-4 pt-3 text-sm outline-none placeholder:text-dimmed"
            />
            <div class="flex items-center justify-between gap-3 border-t border-default px-4 py-2">
              <div class="min-w-0 flex-1 text-xs text-muted">
                <button type="button" class="font-medium text-primary hover:underline">登录后发表评论</button>
              </div>
              <span class="text-xs tabular-nums text-dimmed">0/5000</span>
              <button
                type="button"
                class="rounded-md inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted bg-elevated cursor-not-allowed"
                disabled
              >
                <Icon name="i-tabler:send" class="shrink-0 size-4" aria-hidden="true" />
                发表评论
              </button>
            </div>
          </div>
        </section>
      </section>
    </div>

    <!-- ======================= 右列 ======================= -->
    <aside class="space-y-4">
      <!-- 软件信息 -->
      <section class="distribution-panel">
        <div class="distribution-panel-heading">
          <h2>软件信息</h2>
        </div>
        <dl class="distribution-software-facts">
          <div>
            <dt>软件名称</dt>
            <dd>{{ software.name }}</dd>
          </div>
          <div v-if="versionText">
            <dt>当前版本</dt>
            <dd>
              {{ versionText }}
              <span
                v-if="channelBadge"
                class="font-medium inline-flex items-center text-[10px]/3 px-1.5 py-1 gap-1 rounded-sm bg-primary/10 text-primary"
              >
                {{ channelBadge }}
              </span>
            </dd>
          </div>
          <div>
            <dt>更新日期</dt>
            <dd>{{ dateText }}</dd>
          </div>
          <div v-if="sizeText">
            <dt>文件大小</dt>
            <dd>{{ sizeText }}</dd>
          </div>
          <div v-if="platforms.length">
            <dt>支持平台</dt>
            <dd class="flex flex-wrap gap-2">
              <span v-for="p in platforms" :key="p.key">{{ p.label }}</span>
            </dd>
          </div>
          <div v-if="software.githubUrl">
            <dt>源码仓库</dt>
            <dd>
              <a
                :href="software.githubUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded-md inline-flex items-center gap-1.5 text-primary hover:text-primary/75"
              >
                GitHub
                <Icon name="i-tabler:external-link" class="shrink-0 size-4" aria-hidden="true" />
              </a>
            </dd>
          </div>
        </dl>
      </section>

      <!-- 更新日志预览 -->
      <section v-if="software.releaseNotes" class="distribution-panel">
        <div class="distribution-panel-heading">
          <h2 class="flex items-center gap-2">
            <Icon name="i-tabler:calendar" class="text-primary" aria-hidden="true" />
            更新日志
          </h2>
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs text-muted hover:text-default"
            @click="goDownloads"
          >
            查看全部
          </button>
        </div>
        <div class="px-5 pb-5">
          <div class="distribution-notes-preview">
            <div
              class="prose prose-sm max-w-none break-words dark:prose-invert prose-a:text-primary prose-headings:font-semibold"
              v-html="proseHtml.notes"
            />
          </div>
        </div>
      </section>

      <!-- 相关软件 -->
      <section class="distribution-panel">
        <div class="distribution-panel-heading">
          <h2>相关软件</h2>
          <NuxtLink to="/software" class="text-xs text-muted hover:text-default">查看全部</NuxtLink>
        </div>
        <NuxtLink
          v-for="r in related"
          :key="r.id"
          :to="`/software/${r.slug}`"
          class="distribution-recent-row"
        >
          <SoftwareGlyph :name="r.name" :icon-url="r.iconUrl" />
          <div class="min-w-0">
            <h3>{{ r.name }}</h3>
            <p class="mt-1 line-clamp-2 text-xs leading-5 text-muted">
              {{ r.summary || r.description }}
            </p>
          </div>
        </NuxtLink>
      </section>
    </aside>

    <!-- 轻提示 -->
    <Transition name="yueli-toast">
      <div
        v-if="toastText"
        class="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-default bg-default px-4 py-2 text-sm text-highlighted shadow-lg"
      >
        {{ toastText }}
      </div>
    </Transition>
  </div>
</template>
