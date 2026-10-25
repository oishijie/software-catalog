import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

/**
 * 以 Cloudflare 为目标构建。
 * `nuxt build` → cloudflare-pages（产出 _worker.js + 静态资源，API 跑在边缘）
 * `nuxt dev`   → 保持 Node 预设（本地直读 data/catalog.db，开发体验不变）
 * 也可用 NITRO_PRESET 显式覆盖。
 */
function isCloudflareBuild(): boolean {
  if (process.env.NITRO_PRESET) return process.env.NITRO_PRESET.startsWith('cloudflare')
  return process.argv.includes('build')
}

/**
 * 可选：全量预渲染前台页面。
 *
 * 默认关闭 —— 因为线上后台要能改数据并且立刻可见，页面必须每次向 D1 取数。
 * 若追求极致静态性能（代价：后台改动需重新构建才生效），设 CATALOG_PRERENDER=1。
 */
function prerenderEnabled(): boolean {
  return process.env.CATALOG_PRERENDER === '1'
}

/**
 * 枚举全部软件详情页路由，供预渲染使用。
 * 目录页首屏只渲染 24 张卡片，光靠链接爬取会漏掉绝大多数详情页。
 */
function softwareRoutes(): string[] {
  const file = process.env.CATALOG_DB || resolve(process.cwd(), 'data/catalog.db')
  if (!existsSync(file)) return []
  try {
    const db = new DatabaseSync(file)
    const rows = db.prepare("SELECT slug FROM software WHERE status = 'active'").all() as {
      slug: string
    }[]
    db.close()
    return rows.map((r) => `/software/${r.slug}`)
  } catch (err) {
    console.warn('[prerender] 枚举详情页失败：', (err as Error).message)
    return []
  }
}

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/icon'],

  css: ['~/assets/css/main.css', '~/assets/css/detail.css'],

  compatibilityDate: '2026-10-11',
  devtools: { enabled: false },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },

  runtimeConfig: {
    /** 后台管理令牌。线上必须用环境变量 NUXT_ADMIN_TOKEN 覆盖，否则后台会被拒绝访问 */
    adminToken: process.env.CATALOG_ADMIN_TOKEN || '',
    public: {
      siteName: process.env.CATALOG_SITE_NAME || '软件分发'
    }
  },

  icon: {
    mode: 'css',
    serverBundle: { collections: ['tabler'] },
    // 本机/内网无外网出口时，禁用在线回退：图标找不到就留空，
    // 而不是去请求 api.iconify.design 产生 failed request。
    fallbackToApi: false,
    clientBundle: {
      scan: true,
      // 动态绑定的图标名扫不到，这里显式列出，确保 100% 本地命中
      icons: [
        // 平台
        'tabler:brand-windows-filled',
        'tabler:brand-apple-filled',
        'tabler:brand-ubuntu',
        'tabler:brand-android',
        'tabler:brand-apple',
        // 主题
        'tabler:sun',
        'tabler:moon',
        // 下载来源
        'tabler:brand-github',
        'tabler:link',
        'tabler:world-download',
        'tabler:cloud-download',
        'tabler:fingerprint',
        'tabler:external-link',
        'tabler:download',
        'tabler:package',
        'tabler:package-off',
        'tabler:info-circle'
      ]
    }
  },

  nitro: {
    preset: isCloudflareBuild() ? 'cloudflare-pages' : undefined,

    experimental: {
      // 关键：开启后仓库层可在任意位置拿到当前请求上下文，
      // 从而取到 Cloudflare 的 D1 绑定（无需逐层透传 event）。
      asyncContext: true
    },

    externals: { inline: [] },

    prerender: {
      crawlLinks: prerenderEnabled(),
      routes: prerenderEnabled() ? ['/', '/software', ...softwareRoutes()] : [],
      // 后台与接口永不预渲染：它们必须由边缘函数实时处理
      ignore: ['/admin', '/api']
    }
  },

  routeRules: {
    '/api/distribution/**': { cors: true }
  }
})
