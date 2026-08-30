// ============================================================
// 图纸导出工具
// PNG 导出（Canvas → toDataURL）
// PDF 导出（jsPDF，多页：图纸 + 颜色统计 + 豆子清单）
// ============================================================

import type { PatternGrid, PaletteColor, ColorStat, DownloadOptions } from '../types'
import { renderPatternToCanvas } from './imageProcessing'
import { jsPDF } from 'jspdf'

/**
 * 导出图纸为 PNG
 */
export function exportPNG(
  grid: PatternGrid,
  colorMap: Map<string, PaletteColor>,
  beadSize: number,
  options: DownloadOptions,
  stats?: ColorStat[]
): void {
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

  const link = document.createElement('a')
  link.download = `bead-pattern-${Date.now()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

/**
 * 导出图纸为 PDF
 * Page 1: 完整图纸
 * Page 2: 颜色统计
 */
export function exportPDF(
  grid: PatternGrid,
  colorMap: Map<string, PaletteColor>,
  stats: ColorStat[],
  totalBeads: number,
  beadSize: number,
  options: DownloadOptions,
  meta: { paletteName: string; beadSize: string; canvasSize: string }
): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15

  // ========== Page 1: 图纸 ==========
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('BEAD PATTERN', margin, margin + 5)

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(120, 120, 120)
  let infoY = margin + 12
  pdf.text(`Canvas: ${meta.canvasSize}`, margin, infoY)
  pdf.text(`Bead Size: ${meta.beadSize}`, margin + 60, infoY)
  pdf.text(`Palette: ${meta.paletteName}`, margin + 110, infoY)
  pdf.setTextColor(0, 0, 0)

  // 绘制图纸 — 图纸模式（方格 + 网格线 + 颜色编号）
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
    false, // PDF 有单独的颜色统计页，不需要底部图例
    stats
  )

  const imgData = canvas.toDataURL('image/png')
  const maxW = pageWidth - margin * 2
  const maxH = pageHeight - margin * 40
  const imgRatio = canvas.width / canvas.height
  let imgW = maxW
  let imgH = imgW / imgRatio
  if (imgH > maxH) {
    imgH = maxH
    imgW = imgH * imgRatio
  }

  pdf.addImage(imgData, 'PNG', margin, infoY + 5, imgW, imgH)

  // 分隔线
  pdf.setDrawColor(220, 220, 220)
  pdf.line(margin, pageHeight - margin - 5, pageWidth - margin, pageHeight - margin - 5)
  pdf.setFontSize(8)
  pdf.setTextColor(180, 180, 180)
  pdf.text(`Total: ${totalBeads} beads | ${stats.length} colors`, margin, pageHeight - margin)
  pdf.setTextColor(0, 0, 0)

  // ========== Page 2: 颜色统计 ==========
  if (options.includeColorLegend || options.includeBeadCount) {
    pdf.addPage()

    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text('COLOR SUMMARY', margin, margin + 5)

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Total Beads: ${totalBeads}`, margin, margin + 12)
    pdf.text(`Colors Used: ${stats.length}`, margin + 60, margin + 12)

    // 表头
    let y = margin + 20
    const colX = {
      swatch: margin,
      code: margin + 12,
      name: margin + 35,
      hex: margin + 80,
      count: margin + 115,
      pct: margin + 140
    }

    pdf.setFontSize(8)
    pdf.setTextColor(150, 150, 150)
    pdf.text('COLOR', colX.swatch, y)
    pdf.text('ID', colX.code, y)
    pdf.text('NAME', colX.name, y)
    pdf.text('HEX', colX.hex, y)
    pdf.text('COUNT', colX.count, y)
    pdf.text('PCT', colX.pct, y)
    pdf.setTextColor(0, 0, 0)

    pdf.setDrawColor(220, 220, 220)
    pdf.line(margin, y + 2, pageWidth - margin, y + 2)
    y += 7

    pdf.setFontSize(9)

    for (const stat of stats) {
      if (y > pageHeight - margin - 10) {
        pdf.addPage()
        y = margin + 5
      }

      // 色块
      const rgb = stat.rgb
      pdf.setFillColor(rgb[0], rgb[1], rgb[2])
      pdf.rect(colX.swatch, y - 3, 8, 5, 'F')

      pdf.text(stat.code, colX.code, y)
      pdf.text(stat.name || stat.code, colX.name, y)
      pdf.text(stat.hex.toUpperCase(), colX.hex, y)
      pdf.text(String(stat.count), colX.count, y)
      pdf.text(`${stat.percentage.toFixed(1)}%`, colX.pct, y)

      y += 6
    }

    // 分隔线
    pdf.setDrawColor(220, 220, 220)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 6
    pdf.setFont('helvetica', 'bold')
    pdf.text(`Total: ${totalBeads} beads`, margin, y)
  }

  pdf.save(`bead-pattern-${Date.now()}.pdf`)
}
