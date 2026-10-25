<script setup lang="ts">
const route = useRoute()

const nav = [
  { label: '概览', to: '/admin', icon: 'i-tabler:layout-dashboard', exact: true },
  { label: '软件', to: '/admin/software', icon: 'i-tabler:apps' },
  { label: '分类', to: '/admin/categories', icon: 'i-tabler:category' }
]

const isActive = (item: { to: string; exact?: boolean }) =>
  item.exact ? route.path === item.to : route.path.startsWith(item.to)

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  await navigateTo('/admin/login')
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="admin-brand">
        <Icon name="i-tabler:settings-automation" />
        <span>管理后台</span>
      </div>

      <nav class="admin-nav">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="admin-nav-item"
          :class="{ 'is-active': isActive(item) }"
        >
          <Icon :name="item.icon" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="admin-sidebar-foot">
        <NuxtLink to="/" class="admin-nav-item">
          <Icon name="i-tabler:external-link" />
          查看前台
        </NuxtLink>
        <button type="button" class="admin-nav-item logout" @click="logout">
          <Icon name="i-tabler:logout" />
          退出登录
        </button>
      </div>
    </aside>

    <div class="admin-main">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  display: grid;
  grid-template-columns: 216px minmax(0, 1fr);
  gap: 28px;
  max-width: 1248px;
  margin-inline: auto;
}

.admin-sidebar {
  position: sticky;
  top: 84px;
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  background: var(--ui-bg);
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 12px;
  border-bottom: 1px solid var(--ui-border);
  color: var(--ui-text-highlighted);
  font-size: 14px;
  font-weight: 600;
}
.admin-brand :deep(svg) {
  width: 17px;
  height: 17px;
  color: var(--ui-primary);
}

.admin-nav {
  display: grid;
  gap: 2px;
}
.admin-sidebar-foot {
  display: grid;
  gap: 2px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--ui-border);
}

.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 13px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: background var(--yueli-motion-fast), color var(--yueli-motion-fast);
}
.admin-nav-item:hover {
  background: var(--distribution-soft);
  color: var(--ui-text);
}
.admin-nav-item.is-active {
  background: var(--distribution-soft);
  color: var(--ui-primary);
  font-weight: 500;
}
.admin-nav-item :deep(svg) {
  width: 16px;
  height: 16px;
}
.admin-nav-item.logout {
  color: var(--ui-text-muted);
}
.admin-nav-item.logout:hover {
  color: var(--ui-error);
}

.admin-main {
  min-width: 0;
}

@media (width <= 1023px) {
  .admin-shell {
    grid-template-columns: minmax(0, 1fr);
  }
  .admin-sidebar {
    position: static;
  }
}
</style>
