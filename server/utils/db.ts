/**
 * 统一数据访问层。
 *
 * - 线上（Cloudflare Pages Functions / Workers）：走 D1 binding `DB`
 * - 本地 dev / 构建期预渲染：走 node:sqlite（data/catalog.db）
 *
 * 两种实现的调用形式完全一致（全异步），因此 repo.ts 不必关心运行环境。
 * 环境由「当前请求上下文里有没有 cloudflare.env.DB」自动判定：
 *   本地 `nuxt dev`、`nuxt build` 预渲染 → 无 cloudflare 上下文 → 读本地 SQLite
 *   线上请求 → 有 D1 binding → 读写 D1
 *
 * 拿当前请求上下文依赖 Nitro 的 `experimental.asyncContext`（见 nuxt.config.ts），
 * 它在 CF 运行时基于 AsyncLocalStorage 实现，因此仓库层（repo.ts）无需层层透传 event。
 */

export interface SqlRunResult {
  changes: number
}

export interface Db {
  all<T = Record<string, unknown>>(sql: string, ...args: unknown[]): Promise<T[]>
  get<T = Record<string, unknown>>(sql: string, ...args: unknown[]): Promise<T | null>
  run(sql: string, ...args: unknown[]): Promise<SqlRunResult>
}

/** undefined 在 D1 与 node:sqlite 两侧都不被接受，统一折叠为 null */
function normalizeArgs(args: unknown[]): unknown[] {
  return args.map((v) => (v === undefined ? null : v))
}

/* --------------------------------------------------------------- D1 实现 */

function d1Adapter(d1: any): Db {
  const stmt = (sql: string, args: unknown[]) => d1.prepare(sql).bind(...normalizeArgs(args))
  return {
    async all(sql, ...args) {
      const res = await stmt(sql, args).all()
      return (res?.results ?? []) as any[]
    },
    async get(sql, ...args) {
      const row = await stmt(sql, args).first()
      return (row ?? null) as any
    },
    async run(sql, ...args) {
      const res = await stmt(sql, args).run()
      return { changes: Number(res?.meta?.changes ?? 0) }
    }
  }
}

/* --------------------------------------------------- 本地 SQLite 实现 */

let _sqlite: Promise<any> | null = null

/**
 * 惰性打开本地库。node:sqlite / node:fs 在 Cloudflare 运行时是空壳 stub，
 * 这里用动态 import 把它们挡在 SQLite 分支内，避免进入 worker 主执行路径。
 */
async function openSqlite(): Promise<any> {
  if (_sqlite) return _sqlite

  _sqlite = (async () => {
    const { DatabaseSync } = await import('node:sqlite')
    const { mkdirSync, readFileSync, existsSync } = await import('node:fs')
    const { dirname, join, resolve } = await import('node:path')

    const file = resolve(process.cwd(), process.env.CATALOG_DB || 'data/catalog.db')
    mkdirSync(dirname(file), { recursive: true })

    const db = new DatabaseSync(file)
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA foreign_keys = ON')

    // 本地首次运行自动建表（线上 D1 的表结构由 data/schema-d1.sql 预置）
    const schemaFile = [
      join(dirname(file), 'schema.sql'),
      resolve(process.cwd(), 'data/schema.sql')
    ].find((p) => existsSync(p))
    if (schemaFile) db.exec(readFileSync(schemaFile, 'utf-8'))

    return db
  })()

  return _sqlite
}

function sqliteAdapter(): Db {
  return {
    async all(sql, ...args) {
      const db = await openSqlite()
      return db.prepare(sql).all(...normalizeArgs(args)) as any[]
    },
    async get(sql, ...args) {
      const db = await openSqlite()
      return (db.prepare(sql).get(...normalizeArgs(args)) ?? null) as any
    },
    async run(sql, ...args) {
      const db = await openSqlite()
      const res = db.prepare(sql).run(...normalizeArgs(args))
      return { changes: Number(res?.changes ?? 0) }
    }
  }
}

/* ------------------------------------------------------------- 运行时判定 */

/** workerd 的特征标志，用于区分「本地网络服务」与「边缘运行时」 */
function isCloudflareRuntime(): boolean {
  return (globalThis as any)?.navigator?.userAgent === 'Cloudflare-Workers'
}

/** 取当前请求上下文里的 D1 绑定；拿不到说明跑在本地或构建期 */
function currentD1(): any {
  try {
    // useEvent 由 Nitro 自动导入（nitropack/dist/runtime/context.mjs），
    // 依赖 nitro.experimental.asyncContext —— 未开启或不在请求上下文时会抛错
    if (typeof useEvent !== 'function') return null
    const event = useEvent()
    return event?.context?.cloudflare?.env?.DB ?? null
  } catch {
    return null
  }
}

/** 当前是否运行在 Cloudflare 运行时（即 D1 应为可用状态） */
export function usingD1(): boolean {
  return !!currentD1()
}

/**
 * 获取数据访问句柄：线上 D1，本地/构建期 SQLite。
 *
 * 注意这里**不做静默降级**：边缘运行时拿不到 D1 时直接抛可诊断的错误，
 * 而不是回退到 node:sqlite —— 后者在 workerd 里是空壳，只会抛出更难懂的错误。
 */
export function useDb(): Db {
  const d1 = currentD1()
  if (d1) return d1Adapter(d1)

  if (isCloudflareRuntime()) {
    throw createError({
      statusCode: 500,
      statusMessage: 'D1 绑定不可用',
      message:
        '运行在 Cloudflare Workers 中却读不到 D1 绑定。请检查：' +
        '① wrangler.jsonc 的 d1_databases.binding 是否为 DB；' +
        '② 数据库 ID 是否已填；' +
        '③ nitro.experimental.asyncContext 是否仍为 true。'
    })
  }

  return sqliteAdapter()
}

/* --------------------------------------------------------------- 工具函数 */

/** 统一的行转换：去掉 null 原型（node:sqlite 返回的对象没有 Object 原型） */
export function plain<T = any>(row: any): T {
  return row ? ({ ...row } as T) : (row as T)
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function newId(): string {
  return crypto.randomUUID()
}
