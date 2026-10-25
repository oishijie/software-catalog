<script setup lang="ts">
const route = useRoute()

const token = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { token: token.value } })
    const redirect = (route.query.redirect as string) || '/admin'
    await navigateTo(redirect)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || '登录失败，请检查令牌'
  } finally {
    loading.value = false
  }
}

useHead({ title: '后台登录' })
</script>

<template>
  <div class="login-wrap">
    <form class="login-card" @submit.prevent="submit">
      <div class="login-icon">
        <Icon name="i-tabler:lock" />
      </div>
      <h1>管理后台</h1>
      <p class="login-desc">
        输入管理令牌进入后台。默认令牌是 <code>admin</code>，可通过环境变量
        <code>CATALOG_ADMIN_TOKEN</code> 修改。
      </p>

      <label class="login-field">
        <span>管理令牌</span>
        <input v-model="token" type="password" placeholder="请输入令牌" autocomplete="current-password" />
      </label>

      <p v-if="error" class="login-error">{{ error }}</p>

      <button type="submit" class="login-submit" :disabled="loading || !token">
        {{ loading ? '登录中…' : '进入后台' }}
      </button>

      <NuxtLink to="/" class="login-back">返回前台</NuxtLink>
    </form>
  </div>
</template>

<style scoped>
.login-wrap {
  display: grid;
  place-items: center;
  min-height: 60vh;
}
.login-card {
  width: min(380px, 100%);
  padding: 28px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--ui-bg);
  text-align: center;
}
.login-icon {
  display: grid;
  width: 44px;
  height: 44px;
  margin: 0 auto 14px;
  place-items: center;
  border-radius: 13px;
  background: var(--distribution-soft);
  color: var(--ui-primary);
}
.login-icon :deep(svg) {
  width: 20px;
  height: 20px;
}
.login-card h1 {
  font-size: 18px;
  font-weight: 650;
  color: var(--ui-text-highlighted);
}
.login-desc {
  margin-top: 8px;
  color: var(--ui-text-muted);
  font-size: 12.5px;
  line-height: 1.7;
}
.login-desc code {
  padding: 1px 5px;
  border-radius: 5px;
  background: var(--ui-bg-elevated);
  font-family: var(--font-mono);
  font-size: 11.5px;
}
.login-field {
  display: block;
  margin-top: 20px;
  text-align: left;
}
.login-field span {
  display: block;
  margin-bottom: 6px;
  color: var(--ui-text-muted);
  font-size: 12px;
}
.login-field input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 13px;
  outline: none;
}
.login-field input:focus {
  border-color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-border));
}
.login-error {
  margin-top: 10px;
  color: var(--ui-error);
  font-size: 12.5px;
  text-align: left;
}
.login-submit {
  width: 100%;
  margin-top: 18px;
  padding: 11px;
  border: 0;
  border-radius: 10px;
  background: var(--ui-primary);
  color: #fff;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
}
.login-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.login-back {
  display: inline-block;
  margin-top: 16px;
  color: var(--ui-text-muted);
  font-size: 12.5px;
  text-decoration: none;
}
.login-back:hover {
  color: var(--ui-primary);
}
</style>
