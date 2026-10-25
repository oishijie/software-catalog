<script setup lang="ts">
const route = useRoute()
const colorMode = useColorMode()

const nav = [
  { label: '首页', to: '/' },
  { label: '全部软件', to: '/software' }
]

const isActive = (to: string) =>
  to === '/' ? route.path === '/' : route.path.startsWith(to)

const toggleTheme = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <div class="site-header-inner">
        <NuxtLink to="/" class="site-brand" aria-label="返回首页">
          <span class="brand-mark">
            <Icon name="i-tabler:box-seam" />
          </span>
          <span class="brand-text">软件分发</span>
        </NuxtLink>

        <nav class="site-nav" aria-label="主导航">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="site-nav-link"
            :class="{ 'is-active': isActive(item.to) }"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="site-actions">
          <button class="icon-button" type="button" aria-label="切换主题" @click="toggleTheme">
            <Icon :name="colorMode.value === 'dark' ? 'i-tabler:sun' : 'i-tabler:moon'" />
          </button>
          <NuxtLink to="/admin" class="admin-link">管理后台</NuxtLink>
        </div>
      </div>
    </header>

    <main id="public-main" class="site-main">
      <slot />
    </main>

    <footer class="site-footer">
      <div class="site-footer-inner">
        <p>软件目录复刻版 · 数据来自公开渠道，仅用于演示</p>
        <p class="footer-meta">Nuxt 4 · Nuxt UI · SQLite</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.site-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 40;
  border-bottom: 1px solid var(--ui-border);
  background: color-mix(in srgb, var(--distribution-canvas) 82%, transparent);
  backdrop-filter: blur(12px);
}

.site-header-inner {
  display: flex;
  align-items: center;
  gap: 28px;
  max-width: 1600px;
  margin-inline: auto;
  padding: 15px 24px;
}

.site-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  text-decoration: none;
}

.brand-mark {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  background: var(--distribution-soft);
  color: var(--distribution-accent);
  font-size: 18px;
}

.site-nav {
  display: flex;
  gap: 4px;
}

.site-nav-link {
  padding: 7px 12px;
  border-radius: 9px;
  color: var(--ui-text-muted);
  font-size: 13px;
  text-decoration: none;
  transition: background var(--yueli-motion-fast), color var(--yueli-motion-fast);
}

.site-nav-link:hover {
  background: var(--distribution-soft);
  color: var(--ui-text);
}

.site-nav-link.is-active {
  background: var(--distribution-soft);
  color: var(--ui-primary);
  font-weight: 500;
}

.site-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.icon-button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--ui-border);
  border-radius: 9px;
  background: transparent;
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: background var(--yueli-motion-fast), color var(--yueli-motion-fast);
}

.icon-button:hover {
  background: var(--distribution-soft);
  color: var(--ui-primary);
}

.admin-link {
  padding: 7px 12px;
  border: 1px solid var(--ui-border);
  border-radius: 9px;
  color: var(--ui-text-muted);
  font-size: 13px;
  text-decoration: none;
}

.admin-link:hover {
  border-color: color-mix(in srgb, var(--ui-primary) 40%, var(--ui-border));
  color: var(--ui-primary);
}

.site-main {
  flex: 1;
  padding: 32px 20px 64px;
}

.site-footer {
  border-top: 1px solid var(--ui-border);
}

.site-footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 1600px;
  margin-inline: auto;
  padding: 18px 24px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.footer-meta {
  font-variant-numeric: tabular-nums;
}

@media (width <= 639px) {
  .site-nav {
    display: none;
  }
  .site-footer-inner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
