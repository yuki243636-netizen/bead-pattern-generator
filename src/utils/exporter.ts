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
 * 通过 Web Share API 分享图片文件
 * 返回 true 表示成功调用了分享（用户可能保存或取消）
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
              background: #1a1a1a;
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
 * 1. 移动端：Web Share API（系统分享面板，可"存储图像"到相册）
 * 2. data URL + <a download>（桌面端和部分 Android）
 * 3. 兜底：新窗口打开图片，长按保存
 */
export async function exportPNG(
  grid: PatternGrid,
  colorMap: Map<string, PaletteColor>,
  beadSize: number,
  options: DownloadOptions,
  stats?: ColorStat[]
): Promise<void> {
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
  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = canvas.width
  exportCanvas.height = canvas.height
  const ctx = exportCanvas.getContext('2d')!
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
  ctx.drawImage(canvas, 0, 0)

  const filename = `甘薯么拼豆-${Date.now()}.jpg`
  const mobile = isMobileDevice()
  const wechat = isWeChatBrowser()

  // 生成 data URL（比 blob URL 兼容性更好）
  const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.92)

  if (mobile) {
    // 策略1: Web Share API（最可靠，但不支持微信内置浏览器）
    if (!wechat) {
      const blob = await new Promise<Blob>((resolve) => {
        exportCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92)
      })
      const shared = await tryWebShare(blob, filename)
      if (shared) return
    }

    // 策略2: data URL + <a download>（部分 Android 浏览器可用）
    downloadViaAnchor(dataUrl, filename)

    // 策略3: 微信浏览器或下载可能失败时，延迟打开新窗口
    if (wechat) {
      // 微信内置浏览器 <a download> 必定失败，直接打开新窗口
      setTimeout(() => openImageInNewTab(dataUrl), 300)
    }
  } else {
    // 桌面端：直接 data URL 下载
    downloadViaAnchor(dataUrl, filename)
  }
}
