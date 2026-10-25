/**
 * 抓取 / 导入阶段的来源清洗（与服务端 server/utils/download-sources.ts 同一套判定口径）
 *
 * 只做「剔除」，不做「派生」：
 *  - 私有网盘（夸克 / 百度 / 阿里 / 123 / 115 / 蓝奏 / 微云）不再收录；
 *  - 原站已有的 GitHub 镜像条目也删掉，镜像链接统一由服务端按 Release 直链派生，
 *    避免同一来源在不同软件上写法不一致、或上游给了失效的加速域名。
 */

const CLOUD_DRIVE_HOST_RE =
  /^https?:\/\/(?:[a-z0-9-]+\.)*(?:quark\.cn|pan\.baidu\.com|aliyundrive\.com|alipan\.com|123pan\.com|123684\.com|115\.com|weiyun\.com|lanzou[a-z]*\.com|cowtransfer\.com)/i

export function isCloudDrive(source) {
  const kind = String(source?.kind ?? '')
  const label = String(source?.label ?? '')
  const url = String(source?.delivery?.url ?? '')
  if (kind === 'cloud_drive') return true
  if (/网盘/.test(label)) return true
  if (url && CLOUD_DRIVE_HOST_RE.test(url)) return true
  return false
}

/** 是否为「原站直接给出的 GitHub 加速镜像」条目（统一丢弃，改由服务端派生） */
export function isGithubMirror(source) {
  return /加速/.test(String(source?.label ?? ''))
}

export function stripSources(raw) {
  const list = Array.isArray(raw) ? raw : []
  return list.filter((s) => {
    if (!s || typeof s !== 'object') return false
    if (isCloudDrive(s)) return false
    if (isGithubMirror(s)) return false
    return true
  })
}
