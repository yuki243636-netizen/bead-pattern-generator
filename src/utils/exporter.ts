// ============================================================
// 图纸导出工具
// JPG 导出 — 简化下载策略，优先直接下载
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
 * 通过 <a download> + blob URL 触发下载
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
 * 通过 <a download> + data URL 触发下载
 */
function downloadViaDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.target = '_self'
  link.rel = 'noopener'
  link.style.cssText = 'display:none;position:fixed;top:0;left:0;'
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    if (link.parentNode) link.parentNode.removeChild(link)
  }, 200)
}

/**
 * 通过 Web Share API 分享图片文件
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
    if (err instanceof DOMException && err.name === 'AbortError') return true
    return false
  }
}

/**
 * 微信浏览器：在当前页面内注入图片覆盖层，用户长按保存
 * 不用 window.open（会被微信拦截）
 */
function showInlineImageOverlay(dataUrl: string): void {
  const overlay = document.createElement('div')
  overlay.id = '__bead_download_overlay'
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:20px;font-family:-apple-system,sans-serif;
  `
  overlay.innerHTML = `
    <p style="color:#fff;font-size:15px;font-weight:600;margin-bottom:16px;">长按图片保存到相册</p>
    <img src="${dataUrl}" style="max-width:90vw;max-height:70vh;border-radius:8px;-webkit-touch-callout:default;-webkit-user-select:auto;user-select:auto;" alt="拼豆图纸" />
    <button id="__bead_dl_close" style="margin-top:20px;padding:10px 32px;background:#E091A6;color:#fff;border:none;border-radius:24px;font-size:14px;font-weight:600;">关闭</button>
  `
  document.body.appendChild(overlay)
  const closeBtn = document.getElementById('__bead_dl_close')
  if (closeBtn) {
    closeBtn.onclick = () => overlay.remove()
  }
}

/**
 * 导出图纸为 JPG
 *
 * 下载策略（简化版）：
 * 1. 所有平台先尝试 <a download> + blob URL（桌面/Android 直接下载）
 * 2. 移动端如果 <a download> 可能无效，尝试 Web Share API
 * 3. 微信浏览器：显示内嵌图片覆盖层，长按保存
 *
 * 返回值：
 * - 'shared' — 通过 Web Share 完成
 * - 'downloaded' — 通过 <a download> 完成
 * - 'manual' — 显示了内嵌图片，需手动长按保存（仅微信）
 */
export async function exportJPG(
  grid: PatternGrid,
  colorMap: Map<string, PaletteColor>,
  beadSize: number,
  options: DownloadOptions,
  stats?: ColorStat[]
): Promise<'shared' | 'downloaded' | 'manual'> {
  // 渲染图纸画布
  const asBeads = !options.includeGrid
  const showCodes = !asBeads

  const canvas = renderPatternToCanvas(
    grid, colorMap, beadSize,
    options.includeGrid, options.includeCoordinates,
    asBeads, showCodes,
    options.includeColorLegend && !asBeads, stats
  )

  // 填充白色背景 + 自适应降采样
  const MAX_DIM = 4096
  const scale = Math.min(1, MAX_DIM / Math.max(canvas.width, canvas.height))
  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = Math.round(canvas.width * scale)
  exportCanvas.height = Math.round(canvas.height * scale)
  const ctx = exportCanvas.getContext('2d')!
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height)

  const filename = `甘薯么拼豆-${Date.now()}.jpg`
  const mobile = isMobileDevice()
  const wechat = isWeChatBrowser()

  // 生成 blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    exportCanvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('toBlob failed')),
      'image/jpeg', 0.92
    )
  })

  // 生成 data URL
  const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.92)

  // ====== 微信浏览器：内嵌图片覆盖层 ======
  if (wechat) {
    showInlineImageOverlay(dataUrl)
    return 'manual'
  }

  // ====== 桌面端：直接 blob URL 下载 ======
  if (!mobile) {
    try {
      downloadViaBlobUrl(blob, filename)
    } catch {
      downloadViaDataUrl(dataUrl, filename)
    }
    return 'downloaded'
  }

  // ====== 移动端（非微信）：先试 Web Share，再试 <a download> ======
  // Web Share API 是移动端保存到相册最可靠的方式
  const shared = await tryWebShare(blob, filename)
  if (shared) return 'shared'

  // Web Share 不可用或失败，尝试 <a download>
  try {
    downloadViaBlobUrl(blob, filename)
    return 'downloaded'
  } catch {
    downloadViaDataUrl(dataUrl, filename)
    return 'downloaded'
  }
}
