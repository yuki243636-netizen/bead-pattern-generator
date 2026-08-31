// ============================================================
// 图纸导出工具
// JPG 导出（桌面/移动端均直接触发下载）
// ============================================================

import type { PatternGrid, PaletteColor, ColorStat, DownloadOptions } from '../types'
import { renderPatternToCanvas } from './imageProcessing'

/**
 * 导出图纸为 JPG — 直接触发下载，无弹窗无跳转
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
  const showCodes = !asBeads // 图纸模式显示编号

  const canvas = renderPatternToCanvas(
    grid,
    colorMap,
    beadSize,
    options.includeGrid,
    options.includeCoordinates,
    asBeads,
    showCodes,
    options.includeColorLegend && !asBeads, // 仅图纸模式可显示图例
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

  // 所有平台统一：直接触发下载
  const blob = await new Promise<Blob>((resolve) => {
    exportCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92)
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
