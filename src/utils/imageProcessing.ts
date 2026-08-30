// ============================================================
// 图像处理工具
// 图片像素化 → 颜色匹配 → 网格图纸生成
// 所有处理在浏览器本地 Canvas 完成，不上传服务器
// ============================================================

import type { PatternGrid, ColorStat, GenerateResult, PaletteColor, BeadSize } from '../types'
import {
  precomputeLabColors,
  matchPixelsToPalette,
  selectLimitedColors,
  matchPixelsToLimitedPalette
} from './colorMatching'

/** 拼豆尺寸对应的像素缩放比例（相对值，仅影响渲染） */
export const BEAD_SIZE_PIXELS: Record<BeadSize, number> = {
  mini: 8,
  standard: 10,
  large: 14
}

/**
 * 将图片像素化 — 使用区域平均（Area Averaging）算法
 * 对每个网格格子，取原图对应区域内所有像素的平均颜色
 * 比 bilinear 插值更精准，尤其对色块边界的过渡色
 *
 * @param image HTML Image 元素
 * @param gridWidth 网格宽度（豆子数）
 * @param gridHeight 网格高度（豆子数）
 * @returns 像素化的 RGBA 数据 (Uint8ClampedArray)
 */
export function getPixelatedImageData(
  image: HTMLImageElement,
  gridWidth: number,
  gridHeight: number
): Uint8ClampedArray {
  // Step 1: 绘制原图到 Canvas（限制最大分辨率以保证性能）
  const maxSourceDim = 2000
  const srcScale = Math.min(1, maxSourceDim / Math.max(image.width, image.height))
  const srcW = Math.max(1, Math.floor(image.width * srcScale))
  const srcH = Math.max(1, Math.floor(image.height * srcScale))

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = srcW
  srcCanvas.height = srcH
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!
  srcCtx.drawImage(image, 0, 0, srcW, srcH)
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data

  // Step 2: 计算裁剪区域（保持图片比例适配网格）
  const imgRatio = srcW / srcH
  const gridRatio = gridWidth / gridHeight
  let sx = 0, sy = 0, cropW = srcW, cropH = srcH
  if (imgRatio > gridRatio) {
    cropW = Math.floor(srcH * gridRatio)
    sx = Math.floor((srcW - cropW) / 2)
  } else if (imgRatio < gridRatio) {
    cropH = Math.floor(srcW / gridRatio)
    sy = Math.floor((srcH - cropH) / 2)
  }

  // Step 3: 区域平均 — 每个格子取对应源区域像素的平均颜色
  const result = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  const cellW = cropW / gridWidth
  const cellH = cropH / gridHeight

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const startX = Math.floor(sx + gx * cellW)
      const endX = Math.max(startX + 1, Math.floor(sx + (gx + 1) * cellW))
      const startY = Math.floor(sy + gy * cellH)
      const endY = Math.max(startY + 1, Math.floor(sy + (gy + 1) * cellH))

      let r = 0, g = 0, b = 0, a = 0, count = 0
      for (let y = startY; y < endY && y < srcH; y++) {
        for (let x = startX; x < endX && x < srcW; x++) {
          const idx = (y * srcW + x) * 4
          const alpha = srcData[idx + 3]
          if (alpha < 128) {
            count++
            continue
          }
          r += srcData[idx]
          g += srcData[idx + 1]
          b += srcData[idx + 2]
          a += alpha
          count++
        }
      }

      const idx = (gy * gridWidth + gx) * 4
      if (count > 0 && a / count >= 128) {
        result[idx] = Math.round(r / count)
        result[idx + 1] = Math.round(g / count)
        result[idx + 2] = Math.round(b / count)
        result[idx + 3] = 255
      } else {
        // 透明格子
        result[idx + 3] = 0
      }
    }
  }

  return result
}

/**
 * 生成拼豆图纸
 * 完整流程：像素化 → 颜色匹配 → 构建网格 → 统计
 *
 * @param image 图片元素
 * @param gridWidth 网格宽度
 * @param gridHeight 网格高度
 * @param colors 当前色卡的颜色列表（来自 paletteService.getColors）
 * @param matchMode 匹配模式
 * @param maxColors 有限模式最大颜色数
 * @param onStep 进度回调
 */
export async function generatePattern(
  image: HTMLImageElement,
  gridWidth: number,
  gridHeight: number,
  colors: PaletteColor[],
  matchMode: 'standard' | 'limited',
  maxColors: number,
  onStep?: (step: string) => void,
  dither: boolean = false
): Promise<GenerateResult> {
  // Step 1: 像素化
  onStep?.('pixelating')
  await nextFrame()
  const pixelData = getPixelatedImageData(image, gridWidth, gridHeight)

  // Step 2: 预计算 Lab
  onStep?.('precomputing')
  await nextFrame()
  const labColors = precomputeLabColors(colors)

  // Step 3: 颜色匹配
  onStep?.('matching')
  await nextFrame()

  let matchedCodes: (string | null)[]

  if (matchMode === 'limited' && maxColors < colors.length) {
    const allowedCodes = selectLimitedColors(pixelData, labColors, maxColors)
    matchedCodes = matchPixelsToLimitedPalette(pixelData, labColors, allowedCodes, gridWidth, gridHeight, dither)
  } else {
    matchedCodes = matchPixelsToPalette(pixelData, labColors, gridWidth, gridHeight, dither)
  }

  // Step 4: 构建二维网格
  onStep?.('building')
  await nextFrame()
  const grid: PatternGrid = []
  for (let y = 0; y < gridHeight; y++) {
    const row: (string | null)[] = []
    for (let x = 0; x < gridWidth; x++) {
      row.push(matchedCodes[y * gridWidth + x])
    }
    grid.push(row)
  }

  // Step 5: 统计
  onStep?.('counting')
  await nextFrame()
  const codeCounts = new Map<string, number>()
  for (const code of matchedCodes) {
    if (!code) continue
    codeCounts.set(code, (codeCounts.get(code) || 0) + 1)
  }

  const total = matchedCodes.filter(c => c !== null).length
  const colorMap = new Map(colors.map(c => [c.code, c]))

  const stats: ColorStat[] = []
  for (const [code, count] of codeCounts) {
    const color = colorMap.get(code)
    if (!color) continue
    stats.push({
      code: color.code,
      name: color.name || color.code,
      hex: color.hex,
      rgb: color.rgb,
      count,
      percentage: (count / total) * 100
    })
  }

  stats.sort((a, b) => b.count - a.count)

  const usedColors = stats.map(s => colorMap.get(s.code)!).filter(Boolean)

  // Step 6: 完成
  onStep?.('done')

  return {
    grid,
    stats,
    totalBeads: total,
    usedColors
  }
}

/** 微任务延迟，让 UI 有机会更新 */
function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

/**
 * 计算网格中有颜色的区域边界（裁剪空白边框）
 * 返回图案实际占据的行列范围
 */
export function getContentBounds(grid: PatternGrid): {
  minCol: number; maxCol: number; minRow: number; maxRow: number
} {
  const rows = grid.length
  const cols = grid[0]?.length || 0
  let minCol = cols, maxCol = -1, minRow = rows, maxRow = -1

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x]) {
        if (x < minCol) minCol = x
        if (x > maxCol) maxCol = x
        if (y < minRow) minRow = y
        if (y > maxRow) maxRow = y
      }
    }
  }

  // 全空时回退到全范围
  if (maxCol < 0) return { minCol: 0, maxCol: cols - 1, minRow: 0, maxRow: rows - 1 }
  return { minCol, maxCol, minRow, maxRow }
}

/**
 * 将图纸网格绘制到 Canvas 上
 *
 * 优化点：
 * 1. 裁剪空白边框 — 只保留图案本身
 * 2. 高分辨率渲染 — 使用 scale(2x) 提升清晰度
 * 3. 更大格子尺寸 — 图纸模式至少 28px，文字至少 12px
 * 4. 抗锯齿文字 — 使用 textRendering: 'geometricPrecision'
 *
 * @param grid 网格数据
 * @param colorMap 颜色映射 (code → color)
 * @param beadSize 豆子渲染大小（像素）
 * @param showGrid 是否显示网格线
 * @param showCoordinates 是否显示坐标
 * @param asBeads true=效果图（圆形豆子），false=图纸模式（方格）
 * @param showCodes 是否在格子内显示颜色编号
 * @param withLegend 是否在底部绘制颜色图例
 * @param stats 颜色统计数据（用于图例）
 * @returns Canvas 元素
 */
export function renderPatternToCanvas(
  grid: PatternGrid,
  colorMap: Map<string, PaletteColor>,
  beadSize: number,
  showGrid: boolean,
  showCoordinates: boolean,
  asBeads: boolean,
  showCodes: boolean = false,
  withLegend: boolean = false,
  stats?: { code: string; name: string; hex: string; rgb: [number, number, number]; count: number; percentage: number }[]
): HTMLCanvasElement {
  const fullRows = grid.length
  const fullCols = grid[0]?.length || 0

  // ====== 裁剪空白边框 ======
  const bounds = getContentBounds(grid)
  // 内容行列范围（含端点）
  const cols = bounds.maxCol - bounds.minCol + 1
  const rows = bounds.maxRow - bounds.minRow + 1

  // ====== 格子尺寸（大幅增大） ======
  // 图纸模式：至少 28px/格，确保编号清晰
  // 效果图模式：使用 beadSize
  const cellSize = asBeads ? Math.max(beadSize, 14) : Math.max(beadSize, 28)

  // ====== 高分辨率倍率 ======
  const dpr = 2 // 2 倍渲染提升清晰度

  // 坐标区域
  const coordPad = showCoordinates ? 28 : 0
  const topPad = coordPad
  const leftPad = coordPad

  // 底部图例
  const legendHeight = withLegend && stats && stats.length > 0 ? 64 : 0
  const legendPadTop = 14
  const legendPadBottom = 18

  // 逻辑尺寸
  const logicW = cols * cellSize + leftPad
  const logicH = rows * cellSize + topPad + legendHeight + legendPadTop + legendPadBottom

  // 实际 canvas 尺寸 = 逻辑尺寸 × dpr
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(logicW * dpr)
  canvas.height = Math.round(logicH * dpr)
  const ctx = canvas.getContext('2d')!

  // 缩放上下文到高分辨率
  ctx.scale(dpr, dpr)

  // 开启文字抗锯齿
  // @ts-ignore
  ctx.textRendering = 'geometricPrecision'
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // 背景
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, logicW, logicH)

  // ============================================================
  // 坐标数字
  // ============================================================
  if (showCoordinates) {
    ctx.fillStyle = '#555555'
    ctx.font = `bold ${Math.max(11, Math.floor(cellSize * 0.4))}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 顶部横向坐标（用实际豆子编号）
    for (let x = 0; x < cols; x++) {
      ctx.fillText(
        String(bounds.minCol + x + 1),
        leftPad + x * cellSize + cellSize / 2,
        topPad / 2
      )
    }
    // 左侧纵向坐标
    for (let y = 0; y < rows; y++) {
      ctx.fillText(
        String(bounds.minRow + y + 1),
        leftPad / 2,
        topPad + y * cellSize + cellSize / 2
      )
    }
  }

  const offsetX = leftPad
  const offsetY = topPad
  const gridW = cols * cellSize
  const gridH = rows * cellSize

  // ============================================================
  // 图纸模式：填充颜色 + 编号文字
  // ============================================================
  if (!asBeads) {
    // 先绘制所有格子底色
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const code = grid[bounds.minRow + y][bounds.minCol + x]
        if (!code) continue
        const color = colorMap.get(code)
        if (!color) continue

        const px = offsetX + x * cellSize
        const py = offsetY + y * cellSize
        ctx.fillStyle = color.hex
        ctx.fillRect(px, py, cellSize, cellSize)
      }
    }

    // 再绘制颜色编号文字
    if (showCodes) {
      const fontSize = Math.max(12, Math.floor(cellSize * 0.45))
      ctx.font = `bold ${fontSize}px Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const code = grid[bounds.minRow + y][bounds.minCol + x]
          if (!code) continue
          const color = colorMap.get(code)
          if (!color) continue

          const px = offsetX + x * cellSize
          const py = offsetY + y * cellSize

          const brightness = (color.rgb[0] * 299 + color.rgb[1] * 587 + color.rgb[2] * 114) / 1000
          ctx.fillStyle = brightness > 140 ? '#1a1a1a' : '#ffffff'
          ctx.fillText(code, px + cellSize / 2, py + cellSize / 2)
        }
      }
    }
  }

  // ============================================================
  // 效果图模式：圆形豆子
  // ============================================================
  if (asBeads) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const code = grid[bounds.minRow + y][bounds.minCol + x]
        if (!code) continue
        const color = colorMap.get(code)
        if (!color) continue

        const px = offsetX + x * cellSize
        const py = offsetY + y * cellSize
        ctx.fillStyle = color.hex
        ctx.beginPath()
        ctx.arc(px + cellSize / 2, py + cellSize / 2, cellSize * 0.42, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // ============================================================
  // 网格线（仅图纸模式）
  // ============================================================
  if (showGrid && !asBeads) {
    // 细网格线
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath()
      ctx.moveTo(offsetX + x * cellSize, offsetY)
      ctx.lineTo(offsetX + x * cellSize, offsetY + gridH)
      ctx.stroke()
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath()
      ctx.moveTo(offsetX, offsetY + y * cellSize)
      ctx.lineTo(offsetX + gridW, offsetY + y * cellSize)
      ctx.stroke()
    }

    // 5x5 粗红线（以裁剪后的格子为基准，每 5 格一条）
    ctx.strokeStyle = '#e04848'
    ctx.lineWidth = 1.5
    for (let x = 0; x <= cols; x += 5) {
      ctx.beginPath()
      ctx.moveTo(offsetX + x * cellSize, offsetY)
      ctx.lineTo(offsetX + x * cellSize, offsetY + gridH)
      ctx.stroke()
    }
    for (let y = 0; y <= rows; y += 5) {
      ctx.beginPath()
      ctx.moveTo(offsetX, offsetY + y * cellSize)
      ctx.lineTo(offsetX + gridW, offsetY + y * cellSize)
      ctx.stroke()
    }

    // 外边框
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 2
    ctx.strokeRect(offsetX, offsetY, gridW, gridH)
  }

  // ============================================================
  // 底部颜色图例
  // ============================================================
  if (withLegend && stats && stats.length > 0) {
    const legendY = topPad + gridH + legendPadTop
    const swatchSize = 18
    const itemGap = 16
    const textGap = 5

    ctx.font = `bold 13px Arial, sans-serif`
    ctx.textBaseline = 'middle'

    let x = offsetX
    let y = legendY

    for (let i = 0; i < stats.length; i++) {
      const stat = stats[i]

      const codeWidth = ctx.measureText(stat.code).width
      const countWidth = ctx.measureText(String(stat.count)).width
      const itemWidth = swatchSize + textGap + codeWidth + textGap + countWidth

      if (x + itemWidth > logicW - offsetX) {
        x = offsetX
        y += 24
      }

      // 色块
      ctx.fillStyle = stat.hex
      ctx.fillRect(x, y - swatchSize / 2, swatchSize, swatchSize)
      ctx.strokeStyle = '#999999'
      ctx.lineWidth = 0.5
      ctx.strokeRect(x, y - swatchSize / 2, swatchSize, swatchSize)

      // 色号
      ctx.fillStyle = '#333333'
      ctx.textAlign = 'left'
      ctx.fillText(stat.code, x + swatchSize + textGap, y)

      // 数量
      ctx.fillStyle = '#666666'
      ctx.font = '13px Arial, sans-serif'
      ctx.fillText(String(stat.count), x + swatchSize + textGap + codeWidth + textGap, y)
      ctx.font = 'bold 13px Arial, sans-serif'

      x += itemWidth + itemGap
    }
  }

  return canvas
}

/**
 * 根据图片宽高比建议网格尺寸
 */
export function suggestGridSize(
  imgWidth: number,
  imgHeight: number,
  targetSize: number = 32
): { width: number; height: number } {
  const ratio = imgWidth / imgHeight
  if (ratio >= 1) {
    const width = targetSize
    const height = Math.round(targetSize / ratio)
    return { width, height: Math.max(1, height) }
  } else {
    const height = targetSize
    const width = Math.round(targetSize * ratio)
    return { width: Math.max(1, width), height }
  }
}

/**
 * 智能检测背景色
 * 分析网格四条边上出现频率最高的颜色，作为背景色
 *
 * @param grid 网格数据
 * @returns 背景色编号数组（可能多个，按出现频率排序）
 */
export function detectBackgroundColors(grid: PatternGrid): string[] {
  const rows = grid.length
  const cols = grid[0]?.length || 0
  if (rows === 0 || cols === 0) return []

  const edgeColors = new Map<string, number>()

  // 统计四条边上各颜色出现次数
  for (let x = 0; x < cols; x++) {
    // 顶行
    const topCode = grid[0][x]
    if (topCode) edgeColors.set(topCode, (edgeColors.get(topCode) || 0) + 1)
    // 底行
    const bottomCode = grid[rows - 1][x]
    if (bottomCode) edgeColors.set(bottomCode, (edgeColors.get(bottomCode) || 0) + 1)
  }
  for (let y = 0; y < rows; y++) {
    // 左列
    const leftCode = grid[y][0]
    if (leftCode) edgeColors.set(leftCode, (edgeColors.get(leftCode) || 0) + 1)
    // 右列
    const rightCode = grid[y][cols - 1]
    if (rightCode) edgeColors.set(rightCode, (edgeColors.get(rightCode) || 0) + 1)
  }

  // 按出现频率排序
  const sorted = [...edgeColors.entries()].sort((a, b) => b[1] - a[1])

  // 取出现次数 >= 边缘总格子数 10% 的颜色作为背景色
  const totalEdgeCells = 2 * (rows + cols)
  const threshold = totalEdgeCells * 0.1

  return sorted
    .filter(([, count]) => count >= threshold)
    .map(([code]) => code)
}

/**
 * 从网格中过滤掉被排除的颜色，生成新的网格
 * 被排除的颜色格子变为 null（空白）
 */
export function filterGrid(
  grid: PatternGrid,
  excludedCodes: Set<string>
): PatternGrid {
  if (excludedCodes.size === 0) return grid
  return grid.map(row =>
    row.map(code => (code && excludedCodes.has(code) ? null : code))
  )
}
