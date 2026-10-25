# 软件目录（Software Catalog）

按用途与平台分类的软件分发目录站，功能与界面一比一复刻 [apps.yuelili.com/software](https://apps.yuelili.com/software)，
技术栈与原站保持一致。

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | Nuxt 4（SSR）+ Vue 3 | 与原站同为 Nuxt |
| UI | Nuxt UI 4 + Tailwind CSS 4 | 主色 emerald，与原站一致 |
| 图标 | @nuxt/icon + Tabler 图标集 | 原站使用的就是 `i-tabler:*` |
| 数据库 | `node:sqlite`（Node 内置，零原生依赖） | 不需要编译，不需要额外服务 |
| 样式 | 复刻原站的设计令牌与组件类 | 见 `app/assets/css/main.css` |

## 设计令牌（从原站逐条提取）

亮色 / 暗色两套，定义在 `app/assets/css/main.css`：

| 变量 | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| `--distribution-canvas` | `#f5f9fb` | `#101722` | 页面底色 |
| `--distribution-surface` | `#fff` | `#182131` | 面板底色 |
| `--distribution-ink` | `#13213e` | `#edf2fc` | 主文字 |
| `--distribution-muted` | `#5c6d88` | `#a9b5ca` | 次级文字 |
| `--distribution-line` | `#e3edf4` | `#2c394d` | 描边 |
| `--distribution-soft` | `#e9f6f2` | `#22314b` | 悬浮 / 高亮底 |
| `--distribution-accent` | `#07796b` | `#8bd2b5` | 强调色 |

字体：`DM Sans, PingFang SC, Microsoft YaHei, system-ui, sans-serif`

## 快速开始

```bash
pnpm install          # 安装依赖
pnpm dev              # 启动开发服务（默认 http://localhost:3000）
```

首次运行如果数据库为空，先导入数据（见下）。

```bash
pnpm build            # 生产构建
pnpm preview          # 预览生产构建
```

## 数据

数据库默认落在 `data/catalog.db`（SQLite，WAL 模式），可用环境变量 `CATALOG_DB` 指向别处。

```bash
pnpm db:crawl                    # 抓取公开元数据（约 20 秒）
pnpm db:crawl -- --with-icons    # 额外下载软件图标
pnpm db:import                   # 导入抓到的 JSON 到 SQLite
pnpm db:import -- --with-releases
```

抓取脚本 `tools/crawl.mjs` 的细节：

- 原站是 Nuxt SSR，数据在页面里的 `__NUXT_DATA__`（devalue 扁平数组格式）中，脚本会还原它。
- **列表页必须串行抓取**：原站对并发请求会返回重复页，并发抓会静默丢数据（519 条会变成 480 条）。
- 图标地址里的文件 ID 既不是 `software.id` 也不是 `iconAssetId`，只能从渲染后的 `<img src="/media/…">` 里取。
- 抓到的产物在 `data/crawl/`：`software.json`、`categories.json`、`filter-counts.json`、`site-profile.json`。

## 目录结构

```
app/
  assets/css/main.css      设计令牌 + 组件样式（复刻自原站）
  components/              CatalogCard / CatalogFilters / SoftwareGlyph / SoftwareForm …
  layouts/                 default（前台）/ admin（后台）
  middleware/admin.ts      后台鉴权守卫
  pages/
    index.vue              首页：精选 / 分类探索 / 热门 / 最近更新
    software/index.vue     软件目录：筛选 + 搜索 + 排序 + 分页
    software/[slug].vue    软件详情：版本下载 / 使用说明 / 更新日志 / 相关推荐
    admin/                 管理后台（概览 / 软件 / 分类）
  types/admin.ts           后台表单类型
  utils/                   Markdown 渲染、格式化
server/
  utils/db.ts              统一数据访问层：D1 / node:sqlite 双适配（按运行环境自动切换）
  utils/repo.ts            数据访问层（查询 / 写入 / 计数），全异步
  utils/download-sources.ts 下载来源规范化（剔网盘 / 派生 GitHub 镜像）
  utils/auth.ts            后台鉴权 + 令牌解析（线上未配置则拒绝登录）
  api/distribution/*       REST 接口，命名对齐原站
  api/distribution/catalog-index.get.ts  全量精简目录（目录页一次取回，本地筛选）
  api/admin/*              登录 / 登出 / 会话
tools/
  crawl.mjs                抓取原站公开数据
  import-json.mjs          JSON → SQLite 导入
  crawl-details.mjs        抓取详情页（版本记录 + 下载来源）
  import-details.mjs       详情数据 → SQLite
  lib/normalize-sources.mjs 抓取 / 导入共用的来源清洗
  preview-download.mjs     生成下载区静态预览（不启动 dev server）
  export-d1-sql.mjs        本地库 → D1 导入 SQL 分片
  verify-build.mjs         校验构建产物 + Cloudflare 限制 + D1 准备度
data/
  schema.sql               表结构（本地 SQLite）
  schema-d1.sql            表结构（Cloudflare D1，去掉 PRAGMA）
  catalog.db               本地 SQLite 数据库
  crawl/                   抓取产物
  d1/                      导出的 D1 导入分片（派生物，不纳入版本控制）
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `CATALOG_DB` | `data/catalog.db` | 本地 SQLite 路径（本机 dev 与预渲染时使用） |
| `CATALOG_ADMIN_TOKEN` | 空 | 构建期写入的令牌默认值。**线上请用 `NUXT_ADMIN_TOKEN` 覆盖** |
| `NUXT_ADMIN_TOKEN` | — | 线上后台令牌，在 Cloudflare Pages 的环境变量里设置 |
| `CATALOG_SITE_NAME` | `软件分发` | 站点名 |
| `NITRO_PRESET` | 自动 | `nuxt build` 时自动切到 `cloudflare-pages`，无需手动设置 |
| `CATALOG_PRERENDER` | 关 | 设 `1` 则全量预渲染前台页面（代价：后台改动需重新构建才可见） |

> ⚠️ **线上不设 `NUXT_ADMIN_TOKEN` 时后台会拒绝登录**（返回 503 并说明原因）。
> 这是刻意的：后台能改数据、删软件，绝不能用默认口令在公网裸奔。

## 部署到 Cloudflare Pages（边缘函数 + D1）

> **已部署实例**：<https://software-catalog-57e.pages.dev>
> Pages 项目 `software-catalog`，D1 数据库 `software-catalog-db`
> （`371187a2-8b55-4eda-83be-2a6e1a353f15`，APAC 区域）。
> 后台入口 `/admin/login`，令牌由 Pages 环境变量 `NUXT_ADMIN_TOKEN` 提供。
> 以下步骤为**从零重建**时使用。

### 架构

```
Cloudflare Pages
├── 静态资源       media/ 图标、_nuxt/ 前端资源        ← 直接由 CDN 交付
└── _worker.js     Nuxt SSR 页面 + 全部 API 接口        ← Pages Functions
                        │
                        └── D1（SQLite）  519 软件 / 1582 版本 / 17 分类
```

**为什么不能照搬本地那套**：Cloudflare Workers 的 Node 兼容层里 `node:sqlite` 与 `node:fs`
都是「空壳 stub」—— 能 `import`，但没有任何可用实现。所以运行时数据层换成 D1。

`server/utils/db.ts` 是一个**双适配层**，同一套调用形式对接两种环境，按「当前请求上下文里
有没有 `cloudflare.env.DB`」自动切换：

| 运行环境 | 数据来源 |
|---|---|
| 本机 `nuxt dev`、`nuxt build` | `node:sqlite` 读 `data/catalog.db` |
| 线上 Pages Functions | D1 绑定 `DB` |

因此**本地开发体验完全不变**，也不需要为了本地跑起来去装 miniflare 之类的模拟器。

> 取当前请求上下文依赖 `nitro.experimental.asyncContext`（见 `nuxt.config.ts`）。
> 这是 Nitro 的实验特性，官方注明「在非 Node 环境可能不稳定」。
> 为此 `db.ts` **不做静默降级**：边缘运行时读不到 D1 会直接抛错并列出三个排查点，
> 而不是回退到在 workerd 里根本不能用的 `node:sqlite`。

### 1. 创建 D1 数据库

```bash
npx wrangler d1 create software-catalog-db
```

把输出里的 `database_id` 填进 `wrangler.jsonc` 的 `d1_databases[0].database_id`
（仓库里保留的是占位符 `REPLACE_WITH_D1_DATABASE_ID`，本项目已填为实际值）。
注意 `binding` 必须是 **`DB`** —— `server/utils/db.ts` 按这个名字取绑定。

### 2. 建表并灌入数据

先从本地库导出成 SQL 分片：

```bash
node tools/export-d1-sql.mjs
```

产物在 `data/d1/`，**每个文件恰含一条** INSERT 语句、单文件上限 90 KB
（D1 硬限制单条 SQL 语句 ≤ 100 KB，超出会报 `statement too long: SQLITE_TOOBIG`；
注意按 UTF-8 字节计，中文约占 3 字节/字），幂等（`INSERT OR REPLACE`），可反复执行。
当前规模约 46 个分片 / 3.4 MB。随后**按顺序**灌进 D1：

```bash
npx wrangler d1 execute software-catalog-db --remote --file=data/schema-d1.sql
# 再按文件名序号依次灌入全部数据分片（--yes 跳过交互确认）
for f in data/d1/*.sql; do
  npx wrangler d1 execute software-catalog-db --remote --file="$f" --yes
done
```

> 顺序不可颠倒：`software` 依赖 `category`，`release` 依赖 `software`。

### 3. 设置线上令牌

Cloudflare Dashboard → Pages → 你的项目 → Settings → Environment variables，
添加 `NUXT_ADMIN_TOKEN`，值用一串足够长的随机字符。**不设则后台无法登录。**

### 4. 构建

```bash
pnpm build
```

`nuxt build` 会自动使用 `cloudflare-pages` 预设（`nuxt.config.ts` 里按构建命令判定，
不需要手动传环境变量）。**该预设的输出目录是 `dist/`，不是 `.output/public/`**
（后者只在 Node 预设下产生，是纯静态化时期的遗留），产出：

```
dist/                  ← Pages Direct Upload 的上传根目录
  _worker.js/          Pages Functions 入口（Advanced Mode）：SSR 页面 + 全部 API
  _routes.json         声明哪些路径交给 worker、哪些走静态资源
  media/*.webp         516 个本地图标
  _nuxt/*              前端资源
```

### 5. 校验产物

```bash
node tools/verify-build.mjs
```

逐项检查：`_worker.js` 是否生成、工作线程是否接上了 cloudflare 上下文、`database_id`
有没有还是占位符、`nodejs_compat` 是否启用、D1 数据分片是否齐全、图标是否随包、
文件数与单文件体积是否在免费额度内（20000 文件 / 单文件 25 MiB）。

### 6. 部署

首次需要创建项目：

```bash
npx wrangler pages project create software-catalog --production-branch=main
```

之后每次：

```bash
npx wrangler pages deploy dist --project-name=software-catalog --branch=main
```

`wrangler.jsonc` 已声明 `pages_build_output_dir=./dist`，所以直接 `npx wrangler pages deploy`
也行。**`--branch=main` 让本次部署落到 production 环境**；缺省时 wrangler 对非 git 目录
会用 `main`，但显式指定最稳 —— 否则可能进 Preview，与环境变量（`NUXT_ADMIN_TOKEN`）对不上。
`wrangler` 装在 `devDependencies`，`npx wrangler` 优先命中本地版本
（**别用全局 wrangler**，本机那份是坏的）。不是 git 仓库或工作区有改动时加 `--commit-dirty=true`。

> **用 Direct Upload，不要在 Pages 后台连 Git 仓库走自动构建。**
> 构建与上传全在本机完成，不引入任何 CI。

### 7. 部署后必测

```bash
# 登录接口（把 <令牌> 换成你设置的 NUXT_ADMIN_TOKEN）
curl -s --noproxy '*' --ssl-no-revoke -X POST -H "Content-Type: application/json" \
     -d '{"token":"<令牌>"}' https://<项目>.pages.dev/api/admin/login
# 期望：{"ok":true}；错误令牌应为 401

# 详情接口（验证 D1 真的被读到）
curl -s --noproxy '*' --ssl-no-revoke https://<项目>.pages.dev/api/distribution/software/7zip | head -c 300

# 详情页 SSR（应从 D1 实时取数，标题里带真实软件名）
curl -s --noproxy '*' --ssl-no-revoke https://<项目>.pages.dev/software/7zip | grep -o '<title>[^<]*</title>'
```

任一接口返回 500 且提示「D1 绑定不可用」，按提示查三项：绑定名是否为 `DB`、
`database_id` 是否已填、`nitro.experimental.asyncContext` 是否仍为 `true`。

> ⚠️ 本机探测 `.pages.dev` 有两个坑，**两个参数都得加**：
> 1. **`--noproxy '*'`** —— 本机常驻 `http_proxy` / `https_proxy`（如 WorkBuddy 的本地代理），
>    走代理探测会返回 **522** 假象（静态资源却正常 200，极具迷惑性），必须直连；
> 2. **`--ssl-no-revoke`** —— 本机 Schannel 无法联网做证书吊销检查，会直接报
>    `CRYPT_E_REVOCATION_OFFLINE` / `curl: (35) SSL connect error`，加上才能握手成功。

### 日常更新

| 改了什么 | 要做什么 |
|---|---|
| **线上后台改数据** | 什么都不用做，下次请求即生效 |
| 本机批量改数据（`tools/import-*.mjs`） | 重新导出并灌 D1：[第 2 步](#2-建表并灌入数据) 的分片命令 |
| 前端 / 服务端代码 | `pnpm build && npx wrangler pages deploy dist --project-name=software-catalog --branch=main` |

### 行为对照

| 功能 | 线上 |
|---|---|
| 浏览 / 筛选 / 搜索 / 排序 / 分页 | ✅ 全量目录一次取回，本地计算（附带 5 分钟缓存） |
| 软件详情、下载来源、GitHub 镜像链接 | ✅ 每次请求实时读 D1 |
| 下载计数埋点 | ✅ 可用（写 D1，注意免费档每天 10 万行写额度） |
| 管理后台 `/admin` | ✅ 可用，需配置 `NUXT_ADMIN_TOKEN` |

页面默认**不做预渲染**，这样后台改完数据刷新即可见。
若更看重首屏速度、可以接受「改完数据要重新构建」，设 `CATALOG_PRERENDER=1` 再构建，
会预渲染首页、目录页与全部 519 个详情页。


## 接口

前台（公开）：

```
GET    /api/distribution/software?page=1&size=24&categoryId=&platform=&q=&sortBy=
GET    /api/distribution/software/:slug
GET    /api/distribution/categories
GET    /api/distribution/catalog-index      全量精简目录（客户端本地筛选用）
GET    /api/distribution/catalog-filter-counts
GET    /api/distribution/site-profile
POST   /api/distribution/download/:slug
```

后台（需要 `admin_token` cookie 或 `x-admin-token` 头）：

```
POST   /api/distribution/software              新建
PUT    /api/distribution/software/:slug        更新
DELETE /api/distribution/software/:slug        删除
POST   /api/distribution/categories            新建 / 更新分类
DELETE /api/distribution/categories/:id        删除分类
POST   /api/distribution/releases              新增 / 更新版本
DELETE /api/distribution/releases/:id          删除版本
PUT    /api/distribution/site-profile          更新站点配置
```

## 下载来源规则

详情页下载区按「平台 → 版本 → 来源」三层组织，来源由 `server/utils/download-sources.ts`
在读取时统一规范化，规则固定：

| 来源 | 是否展示 | 说明 |
|---|---|---|
| 本站托管 `hosted` | ✅ | 站内下载（登录 / 计数） |
| GitHub Release `github` | ✅ | 开源项目的原始文件直链 |
| GH-Proxy / GHFast 镜像 | ✅ | 由 GitHub 直链派生，不依赖上游是否提供 |
| 官方下载 `official` | ✅ | 软件作者提供的官方入口 |
| 私有网盘（夸克 / 百度 / 阿里 / 123 / 115…） | ❌ | 不抓取、不入库、不展示 |

镜像链接是纯字符串映射：

```
GH-Proxy : https://gh-proxy.com/<原始 Release 直链>          （保留协议头）
GHFast   : https://ghfast.top/<原始 Release 直链去掉协议头>
```

因此原站只给了 948 条镜像链接，而本站 1536 条含 GitHub 直链的版本记录全部都能提供镜像下载。
抓取（`tools/crawl-details.mjs`）与导入（`tools/import-details.mjs`）共用
`tools/lib/normalize-sources.mjs`，在落盘前就把网盘来源剔掉。

## 数据来源说明

`tools/crawl.mjs` 只抓取公开的元数据（名称、简介、分类、适用平台、官网与开源仓库链接等），
不搬运任何安装包或下载文件。若用于公开部署，请自行确认与原始站点及软件权利人的合规性。
