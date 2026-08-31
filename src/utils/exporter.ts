// ============================================================
// 图纸导出工具
// JPG 导出 — 多策略下载，兼容桌面/移动端各种浏览器
// ============================================================

import type { PatternGrid, PaletteColor, ColorStat, DownloadOptions } from '../types'
import { renderPatternToCanvas } from './imageProcessing'

/**
 * 检测是否为移动端
 */
function isMobileDevice(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    window.innerWidth < 1024
  )
}

/**
 * 检测是否在微信内置浏览器中
 */
function isWeChatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('micromessenger') || ua.includes('wechat')
}

/**
 * 检测是否为 iOS 设备（iPhone/iPad）
 * iOS Safari 的 <a download> 不支持下载图片到相册
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua)
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isIOSDevice || isIPadOS
}

/**
 * 通过 Web Share API 分享图片文件
 * 返回 true 表示成功调用了分享
 */
async function tryWebShare(blob: Blob, filename: string): Promise<boolean> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
    share?: (data: { files: File[]; title?: string }) => Promise<void>
  }

  if (!nav.canShare || !nav.share) return false

  const file = new File([blob], filename, { type: 'image/jpeg' })
  if (!nav.canShare({ files: [file] })) return false

  try {
    await nav.share({ files: [file], title: '甘薯么拼豆' })
    return true
  } catch (err) {
    // 用户取消分享不算失败
    if (err instanceof DOMException && err.name === 'AbortError') return true
    return false
  }
}

/**
 * 通过 <a download> + data URL 触发下载
 * 将 link 挂载到 DOM 后再点击，提高兼容性
 */
function downloadViaAnchor(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.target = '_self'
  link.rel = 'noopener'
  link.style.cssText = 'display:none;position:fixed;top:0;left:0;'
  document.body.appendChild(link)
  link.click()
  // 延迟移除，确保点击事件已派发
  setTimeout(() => {
    if (link.parentNode) link.parentNode.removeChild(link)
  }, 200)
}

/**
 * 通过 <a download> + blob URL 触发下载（备选方案）
 */
function downloadViaBlobUrl(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.target = '_self'
  link.rel = 'noopener'
  link.style.cssText = 'display:none;position:fixed;top:0;left:0;'
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    if (link.parentNode) link.parentNode.removeChild(link)
    URL.revokeObjectURL(url)
  }, 200)
}

/**
 * 最后兜底：在新窗口打开图片，用户可长按保存
 */
function openImageInNewTab(dataUrl: string): void {
  const w = window.open('', '_blank')
  if (w) {
    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>长按图片保存到相册</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              background: #2B1E26;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 20px;
              font-family: -apple-system, sans-serif;
            }
            p {
              color: #fff;
              font-size: 15px;
              font-weight: 600;
              margin-bottom: 16px;
            }
            img {
              max-width: 95vw;
              max-height: 75vh;
              border-radius: 8px;
              -webkit-touch-callout: default;
              -webkit-user-select: auto;
              user-select: auto;
            }
          </style>
        </head>
        <body>
          <p>长按图片保存到相册</p>
          <img src="${dataUrl}" alt="拼豆图纸" />
        </body>
      </html>
    `)
    w.document.close()
  }
}

/**
 * 导出图纸为 JPG
 *
 * 下载策略（按优先级）：
 * 1. 桌面端/Android：data URL + <a download>（直接下载）
 * 2. iOS 移动端：Web Share API（系统分享面板，可"存储图像"到相册）
 * 3. 微信浏览器：新窗口打开图片，长按保存
 *
 * 返回值：
 * - 'shared' — 通过 Web Share 完成下载
 * - 'downloaded' — 通过 <a download> 完成下载
 * - 'manual' — 打开了新窗口，需手动长按保存
 */
export async function exportJPG(
  grid: PatternGrid,
  colorMap: Map<string, PaletteColor>,
  beadSize: number,
  options: DownloadOptions,
  stats?: ColorStat[]
): Promise<'shared' | 'downloaded' | 'manual'> {
  // 图纸模式导出（方格 + 网格线 + 颜色编号）
  const asBeads = !options.includeGrid
  const showCodes = !asBeads

  const canvas = renderPatternToCanvas(
    grid,
    colorMap,
    beadSize,
    options.includeGrid,
    options.includeCoordinates,
    asBeads,
    showCodes,
    options.includeColorLegend && !asBeads,
    stats
  )

  // 填充白色背景（JPG 不支持透明）
  // 对大画板进行自适应降采样，防止画布过大导致 toDataURL/toBlob 失败
  const MAX_EXPORT_DIM = 4096 // 最大导出边长
  const srcW = canvas.width
  const srcH = canvas.height
  const scale = Math.min(1, MAX_EXPORT_DIM / Math.max(srcW, srcH))

  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = Math.round(srcW * scale)
  exportCanvas.height = Math.round(srcH * scale)
  const ctx = exportCanvas.getContext('2d')!
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height)

  const filename = `甘薯么拼豆-${Date.now()}.jpg`
  const mobile = isMobileDevice()
  const wechat = isWeChatBrowser()
  const ios = isIOS()

  // 生成 blob（用于 Web Share 和 blob URL 下载）
  const blob = await new Promise<Blob>((resolve, reject) => {
    exportCanvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('toBlob failed')),
      'image/jpeg',
      0.92
    )
  })

  // 生成 data URL（用于 <a download> 和新窗口兜底）
  const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.92)

  // ====== 微信浏览器：直接新窗口打开 ======
  if (wechat) {
    setTimeout(() => openImageInNewTab(dataUrl), 100)
    return 'manual'
  }

  // ====== 桌面端和 Android：直接 <a download> 下载 ======
  if (!mobile || !ios) {
    // 先尝试 blob URL 下载（更可靠，不会有 data URL 长度限制）
    try {
      downloadViaBlobUrl(blob, filename)
      return 'downloaded'
    } catch {
      // blob URL 失败则用 data URL
      downloadViaAnchor(dataUrl, filename)
      return 'downloaded'
    }
  }

  // ====== iOS 移动端：Web Share API 是唯一可靠保存到相册的方式 ======
  const shared = await tryWebShare(blob, filename)
  if (shared) return 'shared'

  // Web Share 不可用或失败，尝试 data URL 下载
  downloadViaAnchor(dataUrl, filename)

  // iOS 上 <a download> 可能只是在新页面打开图片，延迟打开兜底窗口
  setTimeout(() => openImageInNewTab(dataUrl), 500)
  return 'manual'
}
