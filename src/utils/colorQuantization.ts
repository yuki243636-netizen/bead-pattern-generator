// ============================================================
// 颜色量化管线 — 重构版
//
// 流程：
// imagePreprocess → detectEdges → resizeToGrid → detectForeground
// → findClosestPaletteColor → simplifyPalette → preserveColorHierarchy
// → applyEdgePreservation（最后运行，确保轮廓色不被覆盖）
//
// 设计原则：
// 1. 不使用 RGB Euclidean Distance
// 2. 保持明暗/色相/饱和度层次
// 3. 加入色相/明度/饱和度偏移约束
// 4. 边界格子使用主色提取而非简单平均
// 5. 颜色简化不破坏阴影/主体/高光层次
// 6. 抖动仅限渐变区域，不破坏轮廓
// ============================================================

import type {
  PatternGrid, ColorStat, GenerateResult, PaletteColor
} from '../types'
import { rgbToLab, deltaE2000, type LabColor } from './colorSpace'

// ============================================================
// 类型定义
// ============================================================

/** 每个格子的调试信息 */
export interface DebugCellInfo {
  originalRgb: [number, number, number]
  originalLab: [number, number, number]
  matchedCode: string | null
  matchedHex: string
  matchedLab: [number, number, number]
  deltaE: number
  hueDiff: number
  lightnessDiff: number
  saturationDiff: number
}

/** 生成结果（含调试信息） */
export interface QuantizationResult extends GenerateResult {
  debugGrid?: DebugCellInfo[][]
  cellColors?: [number, number, number][]  // 每个格子的代表色
  mapping?: GridMappingInfo                 // 网格映射信息
  foregroundMask?: boolean[]                // 前景掩码（true = 前景）
  foregroundBBox?: { x: number; y: number; w: number; h: number }  // 前景边界框
  edgeInfo?: CellEdgeInfo[]                  // 每格边缘信息
  edgeCellCount?: number                     // 轮廓格子总数
  detailWarning?: string                     // 分辨率不足提示
  recommendedBoardSize?: string              // 推荐画板尺寸
}

// ============================================================
// 1. imagePreprocess — 图片预处理
// ============================================================

/**
 * 将 HTML Image 绘制到 Canvas，返回像素数据
 * 限制最大分辨率 2000px 保证性能
 * 保留 Alpha 通道用于透明检测
 */
export function imagePreprocess(image: HTMLImageElement): {
  data: Uint8ClampedArray
  width: number
  height: number
} {
  const maxDim = 2000
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height))
  const w = Math.max(1, Math.floor(image.width * scale))
  const h = Math.max(1, Math.floor(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)

  return { data: imageData.data, width: w, height: h }
}

// ============================================================
// 2. resizeToGrid — 网格化（Contain 映射，禁止 Crop）
// ============================================================

/** 网格映射信息（用于 Debug） */
export interface GridMappingInfo {
  srcW: number
  srcH: number
  gridW: number
  gridH: number
  mappedW: number      // 图片在网格中实际占据的宽度
  mappedH: number      // 图片在网格中实际占据的高度
  offsetX: number      // 网格中的水平偏移（居中）
  offsetY: number      // 网格中的垂直偏移（居中）
  scale: number        // 源像素 → 网格格子的缩放比
}

/**
 * 将源图像数据映射到目标网格
 *
 * 核心原则：CONTAIN，不 CROP
 * - 整个图片完整保留，不裁切任何边缘
 * - 图片按比例缩放到网格内，居中放置
 * - 剩余格子标记为透明 [-1,-1,-1]
 *
 * @param edgeMap 可选的 Sobel 边缘图，传入时同时计算每格边缘指标
 * @returns { cellColors, mapping, edgeInfo }
 */
export function resizeToGrid(
  srcData: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  gridW: number,
  gridH: number,
  edgeMap?: Float32Array
): { cellColors: [number, number, number][]; mapping: GridMappingInfo; edgeInfo: CellEdgeInfo[] } {
  const imgRatio = srcW / srcH
  const gridRatio = gridW / gridH

  // Contain: 取较小的缩放比，确保整张图都放进网格
  let mappedW: number, mappedH: number
  if (imgRatio > gridRatio) {
    // 图片更宽 → 填满宽度，高度按比例缩短
    mappedW = gridW
    mappedH = Math.max(1, Math.round(gridW / imgRatio))
  } else {
    // 图片更高 → 填满高度，宽度按比例缩短
    mappedH = gridH
    mappedW = Math.max(1, Math.round(gridH * imgRatio))
  }

  // 居中偏移
  const offsetX = Math.floor((gridW - mappedW) / 2)
  const offsetY = Math.floor((gridH - mappedH) / 2)

  // 每个网格格子对应的源像素数
  const cellSrcW = srcW / mappedW
  const cellSrcH = srcH / mappedH

  const cellColors: [number, number, number][] = []
  const edgeInfo: CellEdgeInfo[] = []
  const adaptiveParams = getAdaptiveParams(gridW, gridH)

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const localGx = gx - offsetX
      const localGy = gy - offsetY

      // 在映射区域之外 → 透明
      if (localGx < 0 || localGx >= mappedW || localGy < 0 || localGy >= mappedH) {
        cellColors.push([-1, -1, -1])
        edgeInfo.push({
          edgeScore: 0, darkPixelRatio: 0, isEdge: false, darkPixelColor: null,
          edgeType: 'none', localContrast: 0, dominantColor: null, dominantRatio: 0, lightPixelRatio: 0,
        })
        continue
      }

      const startX = Math.floor(localGx * cellSrcW)
      const endX = Math.max(startX + 1, Math.floor((localGx + 1) * cellSrcW))
      const startY = Math.floor(localGy * cellSrcH)
      const endY = Math.max(startY + 1, Math.floor((localGy + 1) * cellSrcH))

      const clampedStartX = Math.max(0, startX)
      const clampedEndX = Math.min(srcW, endX)
      const clampedStartY = Math.max(0, startY)
      const clampedEndY = Math.min(srcH, endY)

      const color = getCellRepresentativeColor(
        srcData, srcW,
        clampedStartX, clampedEndX,
        clampedStartY, clampedEndY
      )
      cellColors.push(color)

      // 计算边缘信息（传入自适应参数）
      if (edgeMap) {
        edgeInfo.push(computeCellEdgeInfo(
          srcData, edgeMap, srcW,
          clampedStartX, clampedEndX,
          clampedStartY, clampedEndY,
          adaptiveParams
        ))
      } else {
        edgeInfo.push({
          edgeScore: 0, darkPixelRatio: 0, isEdge: false, darkPixelColor: null,
          edgeType: 'none', localContrast: 0, dominantColor: null, dominantRatio: 0, lightPixelRatio: 0,
        })
      }
    }
  }

  return {
    cellColors,
    mapping: { srcW, srcH, gridW, gridH, mappedW, mappedH, offsetX, offsetY, scale: cellSrcW },
    edgeInfo
  }
}

// ============================================================
// 3. detectForeground — 前景检测
// ============================================================

/**
 * 前景检测：分析 cellColors 找出非透明区域
 * 返回前景掩码（每个格子是否为前景）与边界框
 */
export function detectForeground(
  cellColors: [number, number, number][],
  gridW: number,
  gridH: number
): { mask: boolean[]; bbox: { x: number; y: number; w: number; h: number } | null } {
  const mask = new Array<boolean>(cellColors.length).fill(false)
  let minX = gridW, minY = gridH, maxX = -1, maxY = -1

  for (let i = 0; i < cellColors.length; i++) {
    const [r] = cellColors[i]
    if (r >= 0) {
      mask[i] = true
      const x = i % gridW
      const y = Math.floor(i / gridW)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  let bbox = null
  if (maxX >= 0) {
    bbox = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
  }

  return { mask, bbox }
}

// ============================================================
// 4. getCellRepresentativeColor — 格子代表色提取
// ============================================================

/**
 * 从源图像的指定区域提取代表颜色
 *
 * 策略：
 * - 计算区域内所有像素的颜色方差
 * - 如果方差低（纯色区域）：使用平均值
 * - 如果方差高（边界区域）：使用主色提取
 *   量化到 8 级桶，按以下优先级选择：
 *   1. 如果某桶占比 > 60%，直接取该桶（明确主色）
 *   2. 否则取饱和度最高的桶（保护主体轮廓，避免背景"多数票"吞掉边缘）
 */
export function getCellRepresentativeColor(
  srcData: Uint8ClampedArray,
  srcW: number,
  startX: number,
  endX: number,
  startY: number,
  endY: number
): [number, number, number] {
  // 收集区域内所有不透明像素
  const pixels: number[][] = []
  let sumR = 0, sumG = 0, sumB = 0

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = (y * srcW + x) * 4
      const a = srcData[idx + 3]
      if (a < 128) continue
      const r = srcData[idx]
      const g = srcData[idx + 1]
      const b = srcData[idx + 2]
      pixels.push([r, g, b])
      sumR += r
      sumG += g
      sumB += b
    }
  }

  // 无有效像素，返回透明标记
  if (pixels.length === 0) {
    return [-1, -1, -1]
  }

  const n = pixels.length
  const avgR = sumR / n
  const avgG = sumG / n
  const avgB = sumB / n

  // 如果只有一个像素，直接返回
  if (n === 1) return [pixels[0][0], pixels[0][1], pixels[0][2]]

  // 计算标准差
  let varR = 0, varG = 0, varB = 0
  for (const [r, g, b] of pixels) {
    varR += (r - avgR) ** 2
    varG += (g - avgG) ** 2
    varB += (b - avgB) ** 2
  }
  const stdDev = Math.sqrt((varR + varG + varB) / (3 * n))

  // 低方差 → 纯色区域，直接用平均值
  const SOLID_THRESHOLD = 12
  if (stdDev < SOLID_THRESHOLD) {
    return [Math.round(avgR), Math.round(avgG), Math.round(avgB)]
  }

  // 高方差 → 边界区域，使用主色提取
  // 量化到 8 级桶
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>()

  for (const [r, g, b] of pixels) {
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`
    const existing = buckets.get(key)
    if (existing) {
      existing.r += r
      existing.g += g
      existing.b += b
      existing.count++
    } else {
      buckets.set(key, { r, g, b, count: 1 })
    }
  }

  const bucketList = [...buckets.values()]

  // 规则 1: 如果某桶占比 > 60%，直接取该桶
  const dominant = bucketList.find(b => b.count / n > 0.6)
  if (dominant) {
    return [
      Math.round(dominant.r / dominant.count),
      Math.round(dominant.g / dominant.count),
      Math.round(dominant.b / dominant.count),
    ]
  }

  // 规则 2: 取频率最高的桶（恢复上一版颜色匹配逻辑）
  // 饱和度优先会导致边界格子代表色偏移，频率优先更稳定
  let bestBucket = bucketList[0]
  let maxCount = 0
  for (const bucket of bucketList) {
    if (bucket.count > maxCount) {
      maxCount = bucket.count
      bestBucket = bucket
    }
  }

  if (bestBucket) {
    return [
      Math.round(bestBucket.r / bestBucket.count),
      Math.round(bestBucket.g / bestBucket.count),
      Math.round(bestBucket.b / bestBucket.count),
    ]
  }

  // 兜底
  return [Math.round(avgR), Math.round(avgG), Math.round(avgB)]
}

// ============================================================
// 4. findClosestPaletteColor — 受约束的颜色匹配
// ============================================================

/**
 * 在色卡中查找最接近的颜色
 *
 * 不只看 CIEDE2000，还加入色相/明度/饱和度偏移惩罚
 * 防止深棕匹配到橙色等色相偏移问题
 *
 * @param backgroundCodes 背景色号集合（用于前景格子避免匹配背景色）
 * @param isForeground 当前格子是否为前景
 */
export function findClosestPaletteColor(
  targetLab: [number, number, number],
  paletteColors: LabColor[],
  backgroundCodes?: Set<string>,
  isForeground?: boolean
): {
  color: LabColor
  deltaE: number
  hueDiff: number   // 度
  lightnessDiff: number
  saturationDiff: number
} {
  const targetL = targetLab[0]
  const targetC = Math.sqrt(targetLab[1] ** 2 + targetLab[2] ** 2)
  const targetH = Math.atan2(targetLab[2], targetLab[1]) // 弧度

  let best = paletteColors[0]
  let bestScore = Infinity
  let bestDeltaE = Infinity
  let bestHueDiff = 0
  let bestLightDiff = 0
  let bestSatDiff = 0

  for (const color of paletteColors) {
    const dE = deltaE2000(targetLab, color.lab)

    // 计算各维度差异
    const lightnessDiff = Math.abs(targetL - color.lab[0])

    const colorC = Math.sqrt(color.lab[1] ** 2 + color.lab[2] ** 2)
    const colorH = Math.atan2(color.lab[2], color.lab[1])

    let hueDiffRad = Math.abs(targetH - colorH)
    if (hueDiffRad > Math.PI) hueDiffRad = 2 * Math.PI - hueDiffRad
    const hueDiff = hueDiffRad * 180 / Math.PI

    const satDiff = Math.abs(targetC - colorC) / 128

    // 综合评分 = CIEDE2000 + 偏移惩罚
    let score = dE

    // 色相偏移惩罚：超过 25° 开始惩罚
    if (hueDiff > 25) {
      // 只有当目标有足够饱和度时才惩罚色相
      if (targetC > 8) {
        score += 2.5 * (hueDiff - 25) / 25
      }
    }

    // 明度偏移惩罚：超过 12 开始惩罚
    if (lightnessDiff > 12) {
      score += 2.0 * (lightnessDiff - 12) / 12
    }

    // 饱和度偏移惩罚：超过 0.15 开始惩罚
    if (satDiff > 0.15) {
      score += 1.5 * (satDiff - 0.15) / 0.15
    }

    // 深色区域特殊处理：L < 30 时，不匹配到其他色相的浅色
    if (targetL < 30 && color.lab[0] > 45 && targetC > 5 && colorC > 10) {
      const huePenalty = hueDiff > 20 ? 3.0 : 0
      score += huePenalty
    }

    // 浅色区域特殊处理：L > 80 时，不匹配到深色
    if (targetL > 80 && color.lab[0] < 55) {
      score += 3.0
    }

    // 前景格子避免匹配背景色
    // 如果 Delta E 接近（差值 < 5），背景色被降低优先级
    if (isForeground && backgroundCodes && backgroundCodes.has(color.code)) {
      score += 4.0  // 固定惩罚，让非背景色有优势
    }

    if (score < bestScore) {
      bestScore = score
      best = color
      bestDeltaE = dE
      bestHueDiff = hueDiff
      bestLightDiff = lightnessDiff
      bestSatDiff = satDiff
    }
  }

  return {
    color: best,
    deltaE: bestDeltaE,
    hueDiff: bestHueDiff,
    lightnessDiff: bestLightDiff,
    saturationDiff: bestSatDiff,
  }
}

// ============================================================
// 5. selectHierarchicalColors — 分层选色
// ============================================================

/**
 * 从色卡中选取 N 种颜色，确保覆盖暗/中/亮层次
 *
 * 策略：
 * 1. 先全量匹配所有格子，统计频率
 * 2. 按色相分 8 个扇区
 * 3. 每个扇区内按明度分暗/中/亮三档
 * 4. 每档取频率最高的 1 色
 * 5. 剩余名额按全局频率补
 */
export function selectHierarchicalColors(
  cellColors: [number, number, number][],
  labColors: LabColor[],
  maxColors: number,
  backgroundCodes?: Set<string>,
  foregroundMask?: boolean[]
): Set<string> {
  // 第一遍：全量匹配，统计频率
  const codeCounts = new Map<string, number>()

  for (let i = 0; i < cellColors.length; i++) {
    const rgb = cellColors[i]
    if (rgb[0] < 0) continue // 跳过透明
    const lab = rgbToLab(rgb[0], rgb[1], rgb[2])
    const isFg = foregroundMask ? foregroundMask[i] : true
    const { color } = findClosestPaletteColor(lab, labColors, backgroundCodes, isFg)
    codeCounts.set(color.code, (codeCounts.get(color.code) || 0) + 1)
  }

  // 按色相分扇区（8 个，每 45°）
  const sectors: Map<number, { code: string; count: number; L: number; C: number }[]> = new Map()
  for (let i = 0; i < 8; i++) sectors.set(i, [])

  for (const [code, count] of codeCounts) {
    const color = labColors.find(c => c.code === code)
    if (!color) continue
    const L = color.lab[0]
    const C = Math.sqrt(color.lab[1] ** 2 + color.lab[2] ** 2)
    let H = Math.atan2(color.lab[2], color.lab[1]) * 180 / Math.PI
    if (H < 0) H += 360
    const sector = Math.floor(H / 45) % 8
    sectors.get(sector)!.push({ code, count, L, C })
  }

  // 每个扇区分暗/中/亮，各取 1 色
  const selected = new Set<string>()
  const BAND_LOW = 35
  const BAND_HIGH = 65

  for (const [, colors] of sectors) {
    // 按明度排序
    colors.sort((a, b) => a.L - b.L)

    // 暗色档
    const dark = colors.filter(c => c.L < BAND_LOW)
    if (dark.length > 0) {
      dark.sort((a, b) => b.count - a.count)
      selected.add(dark[0].code)
    }

    // 中色档
    const mid = colors.filter(c => c.L >= BAND_LOW && c.L < BAND_HIGH)
    if (mid.length > 0) {
      mid.sort((a, b) => b.count - a.count)
      selected.add(mid[0].code)
    }

    // 亮色档
    const light = colors.filter(c => c.L >= BAND_HIGH)
    if (light.length > 0) {
      light.sort((a, b) => b.count - a.count)
      selected.add(light[0].code)
    }
  }

  // 如果还没选够，按全局频率补
  if (selected.size < maxColors) {
    const sorted = [...codeCounts.entries()].sort((a, b) => b[1] - a[1])
    for (const [code] of sorted) {
      if (selected.size >= maxColors) break
      selected.add(code)
    }
  }

  // 如果选多了，移除频率最低的（但保留每扇区至少 1 色）
  if (selected.size > maxColors) {
    const sorted = [...codeCounts.entries()].sort((a, b) => a[1] - b[1])
    const toRemove = selected.size - maxColors
    let removed = 0
    for (const [code] of sorted) {
      if (removed >= toRemove) break
      // 检查这个颜色是否是某扇区唯一入选的
      let isOnlyInSector = false
      for (const [, colors] of sectors) {
        const inSector = colors.some(c => c.code === code)
        if (inSector) {
          const selectedInSector = colors.filter(c => selected.has(c.code))
          if (selectedInSector.length === 1 && selectedInSector[0].code === code) {
            isOnlyInSector = true
            break
          }
        }
      }
      if (!isOnlyInSector) {
        selected.delete(code)
        removed++
      }
    }
  }

  return selected
}

// ============================================================
// 6. simplifyPalette — 颜色简化
// ============================================================

/**
 * 合并视觉上不可区分的颜色
 * 条件：CIEDE2000 < 2.5 且同一明度档
 * 不合并：分属暗/亮档的颜色（防止层次破坏）
 */
export function simplifyPalette(
  grid: PatternGrid,
  colorMap: Map<string, PaletteColor>
): { grid: PatternGrid; merged: Map<string, string> } {
  // 统计所有使用的色号
  const usedCodes = new Set<string>()
  for (const row of grid) {
    for (const code of row) {
      if (code) usedCodes.add(code)
    }
  }

  // 计算每对颜色的 Delta E
  const usedColors = [...usedCodes].map(code => {
    const c = colorMap.get(code)
    if (!c) return null
    return { code, lab: rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2]), L: 0 }
  }).filter(Boolean) as { code: string; lab: [number, number, number]; L: number }[]

  for (const c of usedColors) c.L = c.lab[0]

  // 找出可合并的对
  const mergeMap = new Map<string, string>() // oldCode → newCode
  const merged = new Set<string>()

  for (let i = 0; i < usedColors.length; i++) {
    if (merged.has(usedColors[i].code)) continue
    for (let j = i + 1; j < usedColors.length; j++) {
      if (merged.has(usedColors[j].code)) continue

      const dE = deltaE2000(usedColors[i].lab, usedColors[j].lab)

      // 同明度档且 Delta E 很小
      const sameBand = Math.abs(usedColors[i].L - usedColors[j].L) < 10
      if (dE < 2.5 && sameBand) {
        mergeMap.set(usedColors[j].code, usedColors[i].code)
        merged.add(usedColors[j].code)
      }
    }
  }

  if (mergeMap.size === 0) return { grid, merged: new Map() }

  // 应用合并
  const newGrid = grid.map(row =>
    row.map(code => {
      if (!code) return null
      return mergeMap.get(code) || code
    })
  )

  return { grid: newGrid, merged: mergeMap }
}

// ============================================================
// 7. preserveColorHierarchy — 保持颜色层次
// ============================================================

/**
 * 确保匹配后的明暗关系与原图一致
 *
 * 策略：
 * 对每个色相扇区，检查是否有暗色被匹配到比中色更亮的色卡颜色
 * 如果有，进行交换
 */
export function preserveColorHierarchy(
  grid: PatternGrid,
  cellColors: [number, number, number][],
  matchedCodes: (string | null)[],
  colorMap: Map<string, PaletteColor>,
  edgeInfo?: CellEdgeInfo[]
): (string | null)[] {
  const gridW = grid[0]?.length || 0

  // 收集每个格子的原图明度和匹配色明度
  // 跳过边缘格子——轮廓色由 applyEdgePreservation 负责保护
  type Cell = { idx: number; origL: number; matchedL: number; code: string }
  const cells: Cell[] = []

  for (let i = 0; i < matchedCodes.length; i++) {
    // 跳过轮廓格子，避免层次交换覆盖轮廓色
    if (edgeInfo && edgeInfo[i]?.isEdge) continue

    const code = matchedCodes[i]
    const rgb = cellColors[i]
    if (!code || rgb[0] < 0) continue

    const color = colorMap.get(code)
    if (!color) continue

    const origLab = rgbToLab(rgb[0], rgb[1], rgb[2])
    const matchedLab = rgbToLab(color.rgb[0], color.rgb[1], color.rgb[2])

    cells.push({
      idx: i,
      origL: origLab[0],
      matchedL: matchedLab[0],
      code,
    })
  }

  // 按原图明度排序
  cells.sort((a, b) => a.origL - b.origL)

  // 对匹配明度做单调映射
  // 确保：原图较暗的格子，匹配色的明度也较小
  // 使用保序回归（简化版）：分 3 档检查

  const result = [...matchedCodes]

  // 分暗/中/亮三档
  const third = Math.floor(cells.length / 3)
  const dark = cells.slice(0, third)
  const mid = cells.slice(third, third * 2)
  const light = cells.slice(third * 2)

  // 计算各档平均匹配明度
  const avgL = (arr: Cell[]) => arr.reduce((s, c) => s + c.matchedL, 0) / (arr.length || 1)
  const darkAvg = avgL(dark)
  const midAvg = avgL(mid)
  const lightAvg = avgL(light)

  // 如果层次被打乱（暗 > 中 > 亮 的顺序被破坏）
  if (darkAvg > midAvg && midAvg > lightAvg) {
    // 需要交换：暗档里用了偏亮颜色的格子换到中档的颜色
    // 中档里用了偏暗颜色的格子换到暗档的颜色

    // 暗档中匹配明度偏高的格子
    const darkTooLight = dark.filter(c => c.matchedL > midAvg)
    // 中档中匹配明度偏低的格子
    const midTooDark = mid.filter(c => c.matchedL < darkAvg)

    // 交换色号
    for (const d of darkTooLight) {
      // 找中档中最接近原图颜色的色号
      const origRgb = cellColors[d.idx]
      const origLab = rgbToLab(origRgb[0], origRgb[1], origRgb[2])
      let bestCode = d.code
      let bestDelta = Infinity
      for (const m of midTooDark) {
        const mColor = colorMap.get(m.code)
        if (!mColor) continue
        const mLab = rgbToLab(mColor.rgb[0], mColor.rgb[1], mColor.rgb[2])
        const dE = deltaE2000(origLab, mLab)
        if (dE < bestDelta) {
          bestDelta = dE
          bestCode = m.code
        }
      }
      if (bestCode !== d.code) {
        result[d.idx] = bestCode
      }
    }
  }

  return result
}

// ============================================================
// 8. applyControlledDithering — 受控抖动
// ============================================================

/** Bayer 4x4 有序抖动矩阵 */
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

/**
 * 受控有序抖动
 * 仅在渐变区域应用，不在纯色区和边缘区应用
 *
 * 判断方法：检查周围 8 个格子的颜色方差
 * - 方差低 → 纯色区，不抖动
 * - 方差高 → 边缘区，不抖动
 * - 方差中等 → 渐变区，应用 Bayer 抖动
 */
export function applyControlledDithering(
  cellColors: [number, number, number][],
  gridW: number,
  gridH: number,
  labColors: LabColor[],
  strength: number = 0.3
): [number, number, number][] {
  const result: [number, number, number][] = [...cellColors]
  const ditherAmount = strength * 15 // 抖动偏移量

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x
      const rgb = cellColors[idx]
      if (rgb[0] < 0) continue // 透明

      // 检查周围 8 格的颜色方差
      const neighbors: [number, number, number][] = []
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dy === 0 && dx === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
          const nrgb = cellColors[ny * gridW + nx]
          if (nrgb[0] < 0) continue
          neighbors.push(nrgb)
        }
      }

      if (neighbors.length < 3) continue

      // 计算邻居方差
      let avgR = 0, avgG = 0, avgB = 0
      for (const [r, g, b] of neighbors) {
        avgR += r; avgG += g; avgB += b
      }
      avgR /= neighbors.length
      avgG /= neighbors.length
      avgB /= neighbors.length

      let varSum = 0
      for (const [r, g, b] of neighbors) {
        varSum += (r - avgR) ** 2 + (g - avgG) ** 2 + (b - avgB) ** 2
      }
      const stdDev = Math.sqrt(varSum / (3 * neighbors.length))

      // 纯色区（方差 < 8）不抖动
      // 边缘区（方差 > 40）不抖动
      // 渐变区（8 ~ 40）应用抖动
      if (stdDev < 8 || stdDev > 40) continue

      // 应用 Bayer 有序抖动
      const bayerVal = BAYER_4X4[y % 4][x % 4]
      const offset = (bayerVal / 16 - 0.5) * ditherAmount

      result[idx] = [
        Math.max(0, Math.min(255, Math.round(rgb[0] + offset))),
        Math.max(0, Math.min(255, Math.round(rgb[1] + offset))),
        Math.max(0, Math.min(255, Math.round(rgb[2] + offset))),
      ]
    }
  }

  return result
}

// ============================================================
// 9. detectBackgroundPaletteColors — 背景色检测
// ============================================================

/**
 * 检测背景色卡色号
 *
 * 策略：采样网格的边缘格子（第一行/列、最后一行/列），
 * 匹配到色卡后统计频率，取占比 > 15% 的色号作为背景色
 *
 * 这样在颜色匹配时，前景格子可以避免匹配到背景色
 */
export function detectBackgroundPaletteColors(
  cellColors: [number, number, number][],
  gridW: number,
  gridH: number,
  labColors: LabColor[]
): Set<string> {
  const edgeColors: [number, number, number][] = []

  // 采样边缘格子
  for (let x = 0; x < gridW; x++) {
    // 顶行
    const top = cellColors[0 * gridW + x]
    if (top[0] >= 0) edgeColors.push(top)
    // 底行
    const bottom = cellColors[(gridH - 1) * gridW + x]
    if (bottom[0] >= 0) edgeColors.push(bottom)
  }
  for (let y = 0; y < gridH; y++) {
    // 左列
    const left = cellColors[y * gridW + 0]
    if (left[0] >= 0) edgeColors.push(left)
    // 右列
    const right = cellColors[y * gridW + (gridW - 1)]
    if (right[0] >= 0) edgeColors.push(right)
  }

  if (edgeColors.length === 0) return new Set()

  // 匹配色卡并统计
  const codeCounts = new Map<string, number>()
  for (const rgb of edgeColors) {
    const lab = rgbToLab(rgb[0], rgb[1], rgb[2])
    const { color } = findClosestPaletteColor(lab, labColors)
    codeCounts.set(color.code, (codeCounts.get(color.code) || 0) + 1)
  }

  // 取占比 > 15% 的色号
  const total = edgeColors.length
  const bgCodes = new Set<string>()
  for (const [code, count] of codeCounts) {
    if (count / total > 0.15) {
      bgCodes.add(code)
    }
  }

  return bgCodes
}

// ============================================================
// 9.5 Edge Detection & Outline Preservation — 边缘/轮廓保护
// ============================================================

/** 边缘检测基础参数 — 会根据网格尺寸动态调整 */
const EDGE_PARAMS_BASE = {
  DARK_LUMINANCE: 80,          // 深色像素亮度阈值 (0-255)
  LIGHT_LUMINANCE: 160,        // 浅色像素亮度阈值 (0-255)
  EDGE_SCORE_THRESHOLD: 0.15,   // 边缘强度阈值
  DARK_RATIO_THRESHOLD: 0.15,  // 深色像素占比阈值
  MAJOR_DARK_RATIO: 0.35,      // Major Edge 的深色占比阈值
  FINE_DARK_RATIO: 0.08,        // Fine Edge 的最小深色占比
  LOCAL_CONTRAST_THRESHOLD: 0.25, // 局部对比度阈值
  OUTLINE_COLOR_COUNT: 8,       // 从色卡取最深 N 色作为轮廓候选
  EDGE_DELTA_E_MAX: 25,        // 轮廓色匹配的最大 Delta E
  SOBEL_NORMALIZE: 400,        // Sobel 幅值归一化因子
}

/**
 * 根据网格尺寸获取自适应参数
 *
 * 小画板（52×52）：更保守，减少 dilation，提高 Major Edge 阈值
 * 大画板（104×104+）：正常参数
 */
function getAdaptiveParams(gridW: number, gridH: number) {
  const minDim = Math.min(gridW, gridH)
  // 78 为基准，小于 78 时 scale < 1
  const scale = Math.max(0.5, Math.min(1.0, minDim / 78))

  return {
    ...EDGE_PARAMS_BASE,
    // 小画板：Major Edge 阈值更高（更少格子被标为 major edge，减少大面积黑色）
    MAJOR_DARK_RATIO: EDGE_PARAMS_BASE.MAJOR_DARK_RATIO + (1 - scale) * 0.08,
    // 小画板：连通性检查需要更多邻居（5 而非 3，减少错误连接）
    CONNECTIVITY_THRESHOLD: Math.round(3 + (1 - scale) * 2),
    // 小画板：Pass 2 只处理自身很暗的格子（阈值更低，减少扩张）
    PASS2_LUM_THRESHOLD: 80 - (1 - scale) * 15,
    // 小画板：特征分离检查更严格（更多浅色才认为是间隔）
    FEATURE_SEP_LIGHT_RATIO: 0.30 + (1 - scale) * 0.10,
  }
}

/** 每个格子的边缘信息 */
export interface CellEdgeInfo {
  edgeScore: number          // 0-1, 平均 Sobel 边缘强度
  darkPixelRatio: number     // 0-1, 深色像素占比
  isEdge: boolean            // 是否为轮廓格子（向后兼容）
  darkPixelColor: [number, number, number] | null  // 深色像素平均色
  // V3 新增字段：
  edgeType: 'none' | 'major' | 'fine'  // 边缘类型：major=大面积轮廓, fine=小面积细节
  localContrast: number       // 0-1, 局部对比度 (maxLum - minLum) / 255
  dominantColor: [number, number, number] | null  // 占比最大的颜色
  dominantRatio: number       // 0-1, 占比最大的颜色的比例
  lightPixelRatio: number     // 0-1, 浅色像素占比（用于判断是否存在浅色间隔）
}

/**
 * Sobel 边缘检测
 *
 * 在原始图片上运行，不经过缩放
 * 返回每个像素的边缘强度 (0-1)
 */
export function detectEdges(
  srcData: Uint8ClampedArray,
  srcW: number,
  srcH: number
): Float32Array {
  const edgeMap = new Float32Array(srcW * srcH)
  const norm = EDGE_PARAMS_BASE.SOBEL_NORMALIZE

  for (let y = 1; y < srcH - 1; y++) {
    for (let x = 1; x < srcW - 1; x++) {
      const idx = (y * srcW + x) * 4

      // 计算 8 个邻居的亮度
      const lum = (px: number) => {
        const i = px * 4
        return 0.299 * srcData[i] + 0.587 * srcData[i + 1] + 0.114 * srcData[i + 2]
      }

      // 邻居索引
      const tl = (y - 1) * srcW + (x - 1)
      const tc = (y - 1) * srcW + x
      const tr = (y - 1) * srcW + (x + 1)
      const ml = y * srcW + (x - 1)
      const mr = y * srcW + (x + 1)
      const bl = (y + 1) * srcW + (x - 1)
      const bc = (y + 1) * srcW + x
      const br = (y + 1) * srcW + (x + 1)

      // Sobel Gx
      const gx = -lum(tl) - 2 * lum(ml) - lum(bl)
                  + lum(tr) + 2 * lum(mr) + lum(br)

      // Sobel Gy
      const gy = -lum(tl) - 2 * lum(tc) - lum(tr)
                  + lum(bl) + 2 * lum(bc) + lum(br)

      const mag = Math.sqrt(gx * gx + gy * gy)
      edgeMap[y * srcW + x] = Math.min(1, mag / norm)
    }
  }

  return edgeMap
}

/**
 * 计算单个网格格子的边缘指标
 *
 * V3 新增：
 * - localContrast: 格子内最亮与最暗像素的亮度差
 * - dominantColor: 占比最大的颜色（量化桶）
 * - lightPixelRatio: 浅色像素占比（判断是否存在浅色间隔）
 * - edgeType: major（大面积深色轮廓）/ fine（小面积高对比细节）/ none
 */
export function computeCellEdgeInfo(
  srcData: Uint8ClampedArray,
  edgeMap: Float32Array,
  srcW: number,
  startX: number,
  endX: number,
  startY: number,
  endY: number,
  adaptiveParams?: ReturnType<typeof getAdaptiveParams>
): CellEdgeInfo {
  const P = adaptiveParams || EDGE_PARAMS_BASE
  let edgeSum = 0
  let darkCount = 0
  let lightCount = 0
  let totalCount = 0
  let darkR = 0, darkG = 0, darkB = 0
  let maxLum = 0
  let minLum = 255

  // 颜色桶（用于找 dominant color）
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>()

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = (y * srcW + x) * 4
      const a = srcData[idx + 3]
      if (a < 128) continue

      totalCount++
      edgeSum += edgeMap[y * srcW + x] || 0

      const r = srcData[idx]
      const g = srcData[idx + 1]
      const b = srcData[idx + 2]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b

      maxLum = Math.max(maxLum, lum)
      minLum = Math.min(minLum, lum)

      if (lum < P.DARK_LUMINANCE) {
        darkCount++
        darkR += r
        darkG += g
        darkB += b
      }
      if (lum > P.LIGHT_LUMINANCE) {
        lightCount++
      }

      // 量化桶
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`
      const existing = buckets.get(key)
      if (existing) {
        existing.r += r
        existing.g += g
        existing.b += b
        existing.count++
      } else {
        buckets.set(key, { r, g, b, count: 1 })
      }
    }
  }

  if (totalCount === 0) {
    return {
      edgeScore: 0, darkPixelRatio: 0, isEdge: false, darkPixelColor: null,
      edgeType: 'none', localContrast: 0, dominantColor: null, dominantRatio: 0, lightPixelRatio: 0,
    }
  }

  const edgeScore = edgeSum / totalCount
  const darkPixelRatio = darkCount / totalCount
  const lightPixelRatio = lightCount / totalCount
  const localContrast = (maxLum - minLum) / 255

  // 找 dominant color
  let dominantColor: [number, number, number] | null = null
  let dominantRatio = 0
  let maxBucketCount = 0
  for (const bucket of buckets.values()) {
    if (bucket.count > maxBucketCount) {
      maxBucketCount = bucket.count
      dominantColor = [
        Math.round(bucket.r / bucket.count),
        Math.round(bucket.g / bucket.count),
        Math.round(bucket.b / bucket.count),
      ]
    }
  }
  dominantRatio = totalCount > 0 ? maxBucketCount / totalCount : 0

  // 深色像素平均色
  let darkPixelColor: [number, number, number] | null = null
  if (darkCount > 0) {
    darkPixelColor = [
      Math.round(darkR / darkCount),
      Math.round(darkG / darkCount),
      Math.round(darkB / darkCount),
    ]
  }

  // 边缘类型分类
  // Major: 大面积深色 → 人物外轮廓、头发整体
  // Fine: 小面积深色但高对比/高边缘 → 眼睛、眉毛、细线
  // None: 普通填充区域
  let edgeType: 'none' | 'major' | 'fine' = 'none'
  if (darkPixelRatio >= P.MAJOR_DARK_RATIO) {
    edgeType = 'major'
  } else if (darkPixelRatio >= P.FINE_DARK_RATIO &&
    (edgeScore > P.EDGE_SCORE_THRESHOLD || localContrast > P.LOCAL_CONTRAST_THRESHOLD)) {
    edgeType = 'fine'
  }
  const isEdge = edgeType !== 'none'

  return {
    edgeScore, darkPixelRatio, isEdge, darkPixelColor,
    edgeType, localContrast, dominantColor, dominantRatio, lightPixelRatio,
  }
}

/**
 * 从色卡中查找最深的 N 种颜色作为轮廓候选
 *
 * 按 Lab L 值升序排列，取前 N 个
 * 这些颜色可能是黑色、深灰、深棕、深蓝等
 */
export function findOutlineColors(
  labColors: LabColor[],
  maxCount: number = EDGE_PARAMS_BASE.OUTLINE_COLOR_COUNT
): LabColor[] {
  const sorted = [...labColors].sort((a, b) => a.lab[0] - b.lab[0])
  return sorted.slice(0, maxCount)
}

/**
 * 从源图区域中提取深色像素的平均颜色
 *
 * 只收集亮度 < DARK_LUMINANCE 的像素
 * 用于获取轮廓线的真实颜色（而非平均后的混合色）
 */
export function extractDarkPixelColor(
  srcData: Uint8ClampedArray,
  srcW: number,
  startX: number,
  endX: number,
  startY: number,
  endY: number
): [number, number, number] | null {
  let r = 0, g = 0, b = 0, count = 0

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = (y * srcW + x) * 4
      const a = srcData[idx + 3]
      if (a < 128) continue

      const pr = srcData[idx]
      const pg = srcData[idx + 1]
      const pb = srcData[idx + 2]
      const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb

      if (lum < EDGE_PARAMS_BASE.DARK_LUMINANCE) {
        r += pr
        g += pg
        b += pb
        count++
      }
    }
  }

  if (count === 0) return null
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)]
}

/**
 * 轮廓保护后处理（V3 重构）
 *
 * 核心改进：
 * 1. 区分 Major Edge（大面积轮廓）和 Fine Edge（小面积细节）
 * 2. Major Edge → 使用深色轮廓色（人物外轮廓等）
 * 3. Fine Edge → 仅在主色为深色时才使用轮廓色，避免把肤色格子变成黑色
 * 4. 特征分离检查：不连接被浅色间隔分隔的深色区域
 * 5. Board Size 自适应连通性阈值
 * 6. 不删除孤立轮廓格
 */
export function applyEdgePreservation(
  grid: PatternGrid,
  matchedCodes: (string | null)[],
  edgeInfo: CellEdgeInfo[],
  cellColors: [number, number, number][],
  srcData: Uint8ClampedArray,
  srcW: number,
  mapping: GridMappingInfo,
  gridW: number,
  gridH: number,
  outlineColors: LabColor[],
  effectiveLabColors: LabColor[]
): { grid: PatternGrid; matchedCodes: (string | null)[]; edgeCellCount: number } {
  const result = [...matchedCodes]
  const cellSrcW = mapping.srcW / mapping.mappedW
  const cellSrcH = mapping.srcH / mapping.mappedH
  const params = getAdaptiveParams(gridW, gridH)
  let edgeCellCount = 0

  // === Pass 1: 按边缘类型差异化处理 ===
  for (let i = 0; i < edgeInfo.length; i++) {
    const info = edgeInfo[i]
    if (info.edgeType === 'none' || !info.darkPixelColor) continue

    if (info.edgeType === 'major') {
      // Major Edge: 大面积深色 → 使用轮廓色
      // 适用于：人物外轮廓、头发整体、衣服边缘
      const darkLab = rgbToLab(info.darkPixelColor[0], info.darkPixelColor[1], info.darkPixelColor[2])
      const { color: outlineColor, deltaE } = findClosestPaletteColor(darkLab, outlineColors)
      if (deltaE < params.EDGE_DELTA_E_MAX) {
        result[i] = outlineColor.code
        edgeCellCount++
      }
    } else if (info.edgeType === 'fine') {
      // Fine Edge: 小面积深色细节 → 条件性保护
      // 适用于：眼睛、眉毛、脸颊线、衣服细线
      //
      // 关键规则：
      // - 如果格子主色是浅色（如肤色），不强制变成黑色
      //   → 保护 SKIN GAP，避免眼睛和头发连成一片
      // - 如果格子主色是深色（头发区域内的细线），可以使用深色
      // - 如果局部对比度极高（黑眼睛在肤背景上），保留深色
      const domLum = info.dominantColor
        ? 0.299 * info.dominantColor[0] + 0.587 * info.dominantColor[1] + 0.114 * info.dominantColor[2]
        : 255

      const dominantIsLight = domLum > 100
      const hasHighContrast = info.localContrast > params.LOCAL_CONTRAST_THRESHOLD
      const darkIsSignificant = info.darkPixelRatio > 0.20

      if (!dominantIsLight && darkIsSignificant) {
        // 主色是深色 → 安全使用轮廓色
        const darkLab = rgbToLab(info.darkPixelColor[0], info.darkPixelColor[1], info.darkPixelColor[2])
        const { color: outlineColor, deltaE } = findClosestPaletteColor(darkLab, outlineColors)
        if (deltaE < params.EDGE_DELTA_E_MAX) {
          result[i] = outlineColor.code
          edgeCellCount++
        }
      } else if (dominantIsLight && hasHighContrast && darkIsSignificant) {
        // 主色是浅色但有高对比深色特征（如肤色上的黑眼睛）
        // → 保留主色匹配，不强制变黑
        // 这样 SKIN 和 BLACK EYE 之间保持分离
        // 不做任何覆盖，保留 findClosestPaletteColor 的结果
      }
      // else: fine edge 但主色浅且对比度低 → 不处理，保留原匹配
    }
  }

  // === Pass 2: 连通性检查（自适应 + 特征分离） ===
  // 对未被标记为边缘、但有足够多边缘邻居且自身主色为深色的格子，补标记
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x
      if (edgeInfo[idx].edgeType !== 'none') continue

      const rgb = cellColors[idx]
      if (rgb[0] < 0) continue

      // 特征分离检查 1: 如果格子有大量浅色像素，说明存在浅色间隔
      // → 不连接（防止头发通过脸部连接到眼睛）
      if (edgeInfo[idx].lightPixelRatio > params.FEATURE_SEP_LIGHT_RATIO) continue

      // 特征分离检查 2: 如果格子主色是浅色，不提升为边缘
      // （浅色主色说明这个格子主要是肤色/衣服色，不是轮廓）
      if (edgeInfo[idx].dominantColor) {
        const domLum = 0.299 * edgeInfo[idx].dominantColor[0]
          + 0.587 * edgeInfo[idx].dominantColor[1]
          + 0.114 * edgeInfo[idx].dominantColor[2]
        if (domLum > 100) continue
      }

      // 自适应亮度阈值：小画板更严格
      const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
      if (lum > params.PASS2_LUM_THRESHOLD) continue

      // 统计边缘邻居数（自适应阈值）
      let edgeNeighborCount = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dy === 0 && dx === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
          if (edgeInfo[ny * gridW + nx].edgeType !== 'none') edgeNeighborCount++
        }
      }

      // 使用自适应连通性阈值
      if (edgeNeighborCount >= params.CONNECTIVITY_THRESHOLD) {
        const localGx = x - mapping.offsetX
        const localGy = y - mapping.offsetY
        const startX = Math.max(0, Math.floor(localGx * cellSrcW))
        const endX = Math.min(mapping.srcW, Math.floor((localGx + 1) * cellSrcW))
        const startY = Math.max(0, Math.floor(localGy * cellSrcH))
        const endY = Math.min(mapping.srcH, Math.floor((localGy + 1) * cellSrcH))

        const darkColor = extractDarkPixelColor(srcData, srcW, startX, endX, startY, endY)
        if (darkColor) {
          const darkLab = rgbToLab(darkColor[0], darkColor[1], darkColor[2])
          const { color: outlineColor, deltaE } = findClosestPaletteColor(darkLab, outlineColors)
          if (deltaE < params.EDGE_DELTA_E_MAX) {
            result[idx] = outlineColor.code
            edgeCellCount++
          }
        }
      }
    }
  }

  // 重建网格
  const newGrid: PatternGrid = []
  for (let y = 0; y < gridH; y++) {
    const row: (string | null)[] = []
    for (let x = 0; x < gridW; x++) {
      row.push(result[y * gridW + x])
    }
    newGrid.push(row)
  }

  return { grid: newGrid, matchedCodes: result, edgeCellCount }
}

// ============================================================
// 9.8 repairOutlineGaps — 轮廓间隙修复（仅 52×52 / 78×78）
// ============================================================

/**
 * 修复已有轮廓线中的单格间隙
 *
 * 原理：
 * 找到夹在两个轮廓格子之间的单个非轮廓格子，恢复为轮廓色。
 * 仅修复 1 格宽的间隙，不连接远距离的黑色区域。
 *
 * 78×78：直接修复 1 格间隙
 * 52×52：修复前额外做冲突检查——两个轮廓邻居必须已通过其他轮廓路径
 *        连接，才认为它们属于同一条轮廓线，否则不修复
 * 104×104+：不执行任何操作
 *
 * 关键约束：
 * - 不扩大黑色区域，只填补已有轮廓线上的间隙
 * - 不连接两个独立的黑色区域
 * - 不修改任何非轮廓格子（除非它是 1 格间隙）
 */
export function repairOutlineGaps(
  matchedCodes: (string | null)[],
  edgeInfo: CellEdgeInfo[],
  gridW: number,
  gridH: number,
  outlineColors: LabColor[]
): { matchedCodes: (string | null)[]; repairedCount: number } {
  const minDim = Math.min(gridW, gridH)

  // 104×104+：不修改
  if (minDim > 90) {
    return { matchedCodes, repairedCount: 0 }
  }

  const outlineCodes = new Set(outlineColors.map(c => c.code))
  const isOutline = (code: string | null): boolean =>
    code !== null && outlineCodes.has(code)

  const result = [...matchedCodes]
  const original = [...matchedCodes]   // 冲突检查用原始状态
  let repairedCount = 0

  const needConflictCheck = minDim <= 60  // 52×52

  /**
   * 小范围 BFS：检查两个轮廓格子是否通过其他轮廓路径连接
   * 不经过 gapIdx，最多搜索 30 步
   */
  const areConnected = (idx1: number, idx2: number, gapIdx: number): boolean => {
    const visited = new Set<number>([gapIdx, idx1])
    const queue = [idx1]
    let steps = 0
    const maxSteps = 30

    while (queue.length > 0 && steps < maxSteps) {
      const cur = queue.shift()!
      steps++
      if (cur === idx2) return true

      const cx = cur % gridW
      const cy = Math.floor(cur / gridW)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dy === 0 && dx === 0) continue
          const nx = cx + dx, ny = cy + dy
          if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
          const nIdx = ny * gridW + nx
          if (visited.has(nIdx)) continue
          if (!isOutline(original[nIdx])) continue
          visited.add(nIdx)
          queue.push(nIdx)
        }
      }
    }
    return false
  }

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x
      const code = result[idx]

      // 跳过已经是轮廓色的格子
      if (isOutline(code)) continue
      // 跳过透明格子
      if (!code) continue
      // 跳过没有任何深色像素的格子（不是轮廓间隙）
      if (!edgeInfo[idx].darkPixelColor) continue

      // 检查 4 个方向是否存在 1 格间隙（对侧都是轮廓色）
      type Check = { n1: number; n2: number }
      let check: Check | null = null

      // 水平：left + right
      if (!check && x > 0 && x < gridW - 1) {
        const li = y * gridW + (x - 1)
        const ri = y * gridW + (x + 1)
        if (isOutline(result[li]) && isOutline(result[ri]))
          check = { n1: li, n2: ri }
      }
      // 垂直：top + bottom
      if (!check && y > 0 && y < gridH - 1) {
        const ti = (y - 1) * gridW + x
        const bi = (y + 1) * gridW + x
        if (isOutline(result[ti]) && isOutline(result[bi]))
          check = { n1: ti, n2: bi }
      }
      // 对角 ↘：top-left + bottom-right
      if (!check && x > 0 && x < gridW - 1 && y > 0 && y < gridH - 1) {
        const tli = (y - 1) * gridW + (x - 1)
        const bri = (y + 1) * gridW + (x + 1)
        if (isOutline(result[tli]) && isOutline(result[bri]))
          check = { n1: tli, n2: bri }
      }
      // 对角 ↙：top-right + bottom-left
      if (!check && x > 0 && x < gridW - 1 && y > 0 && y < gridH - 1) {
        const tri = (y - 1) * gridW + (x + 1)
        const bli = (y + 1) * gridW + (x - 1)
        if (isOutline(result[tri]) && isOutline(result[bli]))
          check = { n1: tri, n2: bli }
      }

      if (!check) continue

      // 52×52 冲突检查：两个轮廓邻居必须已通过其他路径连接
      if (needConflictCheck) {
        if (!areConnected(check.n1, check.n2, idx)) continue
      }

      // 修复：使用邻居的轮廓色
      result[idx] = result[check.n1]
      repairedCount++
    }
  }

  return { matchedCodes: result, repairedCount }
}

/**
 * 分析边缘密度和细节数量，判断当前网格是否能表达原图细节
 *
 * 返回：
 * - detailWarning: 分辨率不足提示（如有）
 * - recommendedBoardSize: 推荐画板尺寸
 */
export function detectDetailLoss(
  edgeInfo: CellEdgeInfo[],
  mapping: GridMappingInfo,
  srcW: number,
  srcH: number
): { detailWarning?: string; recommendedBoardSize?: string } {
  const mappedCount = mapping.mappedW * mapping.mappedH
  if (mappedCount === 0) return {}

  // 统计 major 和 fine edge 格子
  let majorCount = 0
  let fineCount = 0
  for (const info of edgeInfo) {
    if (info.edgeType === 'major') majorCount++
    else if (info.edgeType === 'fine') fineCount++
  }

  const fineRatio = fineCount / mappedCount
  const minDim = Math.min(mapping.gridW, mapping.gridH)

  // 推荐画板尺寸
  let recommendedBoardSize: string | undefined
  if (fineRatio > 0.25 && minDim < 104) {
    recommendedBoardSize = '104×104'
  } else if (fineRatio > 0.15 && minDim < 78) {
    recommendedBoardSize = '78×78'
  }

  // 分辨率不足提示
  let detailWarning: string | undefined
  if (minDim <= 52 && fineRatio > 0.15) {
    detailWarning = '当前画板尺寸较小，部分细节（如眼睛、细线）可能无法保留，建议使用 78×78 或更大画板以获得更高还原度。'
  } else if (minDim <= 78 && fineRatio > 0.25) {
    detailWarning = '当前画板可能无法保留所有细节，建议使用 104×104 或更大画板。'
  }

  return { detailWarning, recommendedBoardSize }
}

// ============================================================
// 10. Small Board Optimization Pipeline (仅 52×52)
// ============================================================

/**
 * 主体检测与智能裁剪
 *
 * 策略：
 * 1. 如果有透明像素 → 非透明区域的边界框即为主体
 * 2. 如果无透明 → 采样四角+边缘中点，计算背景色，找到与背景差异大的像素
 * 3. 裁剪到主体边界框 + 少量边距（3%）
 * 4. 如果主体已占 > 92% 图片，不裁剪
 *
 * 目标：让主体在 52×52 网格中占据更大比例，给关键细节更多像素空间
 */
function cropToSubject(
  srcData: Uint8ClampedArray,
  srcW: number,
  srcH: number
): { data: Uint8ClampedArray; width: number; height: number } {
  // 检查是否有透明像素
  let hasTransparency = false
  for (let i = 3; i < srcData.length; i += 4) {
    if (srcData[i] < 128) { hasTransparency = true; break }
  }

  let minX = srcW, minY = srcH, maxX = -1, maxY = -1

  if (hasTransparency) {
    // 主体 = 非透明像素
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        if (srcData[(y * srcW + x) * 4 + 3] >= 128) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
  } else {
    // 无透明：采样四角+边缘中点估计背景色
    const samplePts = [
      [0, 0], [srcW - 1, 0], [0, srcH - 1], [srcW - 1, srcH - 1],
      [Math.floor(srcW / 2), 0], [Math.floor(srcW / 2), srcH - 1],
      [0, Math.floor(srcH / 2)], [srcW - 1, Math.floor(srcH / 2)],
    ]
    let bgR = 0, bgG = 0, bgB = 0
    for (const [px, py] of samplePts) {
      const idx = (py * srcW + px) * 4
      bgR += srcData[idx]; bgG += srcData[idx + 1]; bgB += srcData[idx + 2]
    }
    bgR /= samplePts.length; bgG /= samplePts.length; bgB /= samplePts.length

    // 找到与背景差异大的像素
    const THRESH = 90  // Manhattan 距离阈值
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const idx = (y * srcW + x) * 4
        const dist = Math.abs(srcData[idx] - bgR)
          + Math.abs(srcData[idx + 1] - bgG)
          + Math.abs(srcData[idx + 2] - bgB)
        if (dist > THRESH) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
  }

  // 未找到主体 → 返回原图
  if (maxX < 0) return { data: srcData, width: srcW, height: srcH }

  const subjW = maxX - minX + 1
  const subjH = maxY - minY + 1

  // 主体已占 > 92% → 不裁剪
  if (subjW > srcW * 0.92 && subjH > srcH * 0.92) {
    return { data: srcData, width: srcW, height: srcH }
  }

  // 添加 3% 边距（至少 2px）
  const marginX = Math.max(2, Math.floor(subjW * 0.03))
  const marginY = Math.max(2, Math.floor(subjH * 0.03))
  const cropX = Math.max(0, minX - marginX)
  const cropY = Math.max(0, minY - marginY)
  const cropW = Math.min(srcW, maxX + marginX + 1) - cropX
  const cropH = Math.min(srcH, maxY + marginY + 1) - cropY

  // 裁剪
  const cropped = new Uint8ClampedArray(cropW * cropH * 4)
  for (let y = 0; y < cropH; y++) {
    const srcRow = ((cropY + y) * srcW + cropX) * 4
    const dstRow = y * cropW * 4
    for (let x = 0; x < cropW * 4; x++) {
      cropped[dstRow + x] = srcData[srcRow + x]
    }
  }

  return { data: cropped, width: cropW, height: cropH }
}

/**
 * 结构感知颜色提取（52×52 专用）
 *
 * 对边缘格子（major/fine），使用 darkPixelColor 替代平均值
 * 这样边缘格子在色卡匹配时更倾向于匹配深色（轮廓色）
 *
 * 非边缘格子保持原样（getCellRepresentativeColor 已使用主色提取）
 */
function applyStructureAwareColors(
  cellColors: [number, number, number][],
  edgeInfo: CellEdgeInfo[]
): [number, number, number][] {
  const result: [number, number, number][] = []
  for (let i = 0; i < cellColors.length; i++) {
    const info = edgeInfo[i]
    const avg = cellColors[i]
    if (avg[0] < 0) { result.push([-1, -1, -1]); continue }
    // 边缘格子 → 使用深色像素颜色（真实的轮廓色）
    if ((info.edgeType === 'major' || info.edgeType === 'fine') && info.darkPixelColor) {
      result.push([...info.darkPixelColor])
    } else {
      result.push([...avg])
    }
  }
  return result
}

/**
 * 小特征保护（52×52 专用）
 *
 * 对高对比度小特征（眼睛、眼泪、蝴蝶结边缘等），
 * 即使深色占比很低也保留深色轮廓色
 *
 * 比通用 applyEdgePreservation 更积极：
 * - darkPixelRatio 阈值从 0.20 降到 0.08
 * - 不检查 dominantIsLight（允许在浅色背景上保留深色特征）
 *
 * 关键：只处理 fine edge + 高对比度格子，不处理 major edge（避免扩张）
 */
function preserveSmallFeatures52(
  matchedCodes: (string | null)[],
  edgeInfo: CellEdgeInfo[],
  outlineColors: LabColor[]
): (string | null)[] {
  const result = [...matchedCodes]
  const outlineCodes = new Set(outlineColors.map(c => c.code))

  for (let i = 0; i < edgeInfo.length; i++) {
    const info = edgeInfo[i]
    if (!result[i]) continue

    // 只处理 fine edge（小面积高对比细节）
    if (info.edgeType !== 'fine') continue
    // 必须有高局部对比度（明确的视觉特征）
    if (info.localContrast < 0.25) continue
    // 必须有深色像素
    if (!info.darkPixelColor) continue
    // 深色占比至少 8%（比通用管线的 20% 更低）
    if (info.darkPixelRatio < 0.08) continue
    // 已经是轮廓色 → 跳过
    if (outlineCodes.has(result[i]!)) continue

    // 覆盖为最接近的轮廓色
    const darkLab = rgbToLab(info.darkPixelColor[0], info.darkPixelColor[1], info.darkPixelColor[2])
    const { color: outlineColor, deltaE } = findClosestPaletteColor(darkLab, outlineColors)
    if (deltaE < 25) {
      result[i] = outlineColor.code
    }
  }
  return result
}

/**
 * 区域简化（52×52 专用）
 *
 * 合并小的孤立颜色区域到周围主色
 *
 * 保留：
 * - 轮廓色区域（深色，是轮廓的一部分）
 * - 高对比度特征区域（眼睛、眼泪等重要细节）
 *
 * 合并条件（全部满足）：
 * - 区域 < 4 格
 * - 不是轮廓色
 * - 没有高对比度格子
 * - 与最大邻居的 Delta E < 8
 */
function simplifyRegions52(
  matchedCodes: (string | null)[],
  edgeInfo: CellEdgeInfo[],
  colorMap: Map<string, PaletteColor>,
  gridW: number,
  gridH: number
): (string | null)[] {
  const result = [...matchedCodes]

  // 检测轮廓色（L < 35）
  const outlineCodes = new Set<string>()
  for (const c of colorMap.values()) {
    const lab = rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2])
    if (lab[0] < 35) outlineCodes.add(c.code)
  }

  // Flood fill 找连通区域（4-连通）
  const visited = new Array(matchedCodes.length).fill(false)
  const regionId = new Array(matchedCodes.length).fill(-1)
  const regions: { code: string; cells: number[] }[] = []

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x
      if (visited[idx] || !result[idx]) continue

      const code = result[idx]!
      const id = regions.length
      const cells: number[] = []
      const queue = [idx]
      visited[idx] = true

      while (queue.length > 0) {
        const cur = queue.shift()!
        cells.push(cur)
        regionId[cur] = id

        const cx = cur % gridW, cy = Math.floor(cur / gridW)
        const nbrs = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]
        for (const [nx, ny] of nbrs) {
          if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
          const ni = ny * gridW + nx
          if (!visited[ni] && result[ni] === code) {
            visited[ni] = true
            queue.push(ni)
          }
        }
      }
      regions.push({ code, cells })
    }
  }

  // 合并小区域
  for (const region of regions) {
    if (region.cells.length >= 4) continue
    // 轮廓色区域不合并
    if (outlineCodes.has(region.code)) continue
    // 有高对比度格子 → 保留（重要特征）
    let hasHighContrast = false
    for (const ci of region.cells) {
      if (edgeInfo[ci].localContrast > 0.30) { hasHighContrast = true; break }
    }
    if (hasHighContrast) continue

    // 找最常见的相邻区域
    const nbrRegions = new Map<number, number>()
    for (const ci of region.cells) {
      const cx = ci % gridW, cy = Math.floor(ci / gridW)
      const nbrs = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]
      for (const [nx, ny] of nbrs) {
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
        const ni = ny * gridW + nx
        const rid = regionId[ni]
        if (rid >= 0 && rid !== regions.indexOf(region)) {
          nbrRegions.set(rid, (nbrRegions.get(rid) || 0) + 1)
        }
      }
    }
    if (nbrRegions.size === 0) continue

    let bestId = -1, bestCount = 0
    for (const [rid, cnt] of nbrRegions) {
      if (cnt > bestCount) { bestCount = cnt; bestId = rid }
    }
    if (bestId < 0) continue

    const nbrRegion = regions[bestId]
    // 颜色相似度检查
    const rColor = colorMap.get(region.code)
    const nColor = colorMap.get(nbrRegion.code)
    if (!rColor || !nColor) continue

    const rLab = rgbToLab(rColor.rgb[0], rColor.rgb[1], rColor.rgb[2])
    const nLab = rgbToLab(nColor.rgb[0], nColor.rgb[1], nColor.rgb[2])
    if (deltaE2000(rLab, nLab) < 8) {
      for (const ci of region.cells) result[ci] = nbrRegion.code
    }
  }

  return result
}

// ============================================================
// 10.1 Small Board V2: Outline vs Fill Classification
// ============================================================

/**
 * 将每个格子分类为 Outline Black 或 Fill Black
 *
 * Outline Black: 位于两种不同颜色区域之间的轮廓格子
 *   → 例如 Background | Black | Skin
 *   → 两侧邻居颜色差异大，格子本身有深色像素
 *   → 优先保证连续性
 *
 * Fill Black: 图案内部的深色区域（头发、眼睛、衣服、阴影）
 *   → 周围邻居颜色相似（都是深色或都是同色）
 *   → 不能自动膨胀或与附近黑色连接
 *
 * @returns Uint8Array: 0=non-dark, 1=outline, 2=fill
 */
function classifyOutlineVsFill52(
  cellColors: [number, number, number][],
  edgeInfo: CellEdgeInfo[],
  gridW: number,
  gridH: number
): Uint8Array {
  const classification = new Uint8Array(cellColors.length)
  const DARK_LUM = 80

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x
      const rgb = cellColors[idx]
      if (rgb[0] < 0) continue

      // 必须有深色像素才分类
      if (!edgeInfo[idx].darkPixelColor) continue
      if (edgeInfo[idx].darkPixelRatio < 0.08) continue

      // 获取邻居颜色（4-连通）
      const neighbors: { rgb: [number, number, number]; lum: number }[] = []
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
        const nIdx = ny * gridW + nx
        const nRgb = cellColors[nIdx]
        if (nRgb[0] < 0) continue
        const nLum = 0.299 * nRgb[0] + 0.587 * nRgb[1] + 0.114 * nRgb[2]
        neighbors.push({ rgb: nRgb, lum: nLum })
      }

      if (neighbors.length < 2) continue

      // 计算自身亮度
      const selfLum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]

      // 判断是否为 Outline Black:
      // 1. 格子本身较暗或含有显著深色
      // 2. 存在两侧邻居颜色差异大（不同颜色区域的边界）
      // 3. 至少有一个浅色邻居（说明不是纯深色区域内部）

      const selfIsDark = selfLum < DARK_LUM
      const hasSignificantDark = edgeInfo[idx].darkPixelRatio > 0.15

      if (!selfIsDark && !hasSignificantDark) continue

      // 找最亮和最暗的邻居
      let maxLum = -1, minLum = 999
      let lightNeighborCount = 0
      let darkNeighborCount = 0
      for (const n of neighbors) {
        if (n.lum > maxLum) maxLum = n.lum
        if (n.lum < minLum) minLum = n.lum
        if (n.lum > 120) lightNeighborCount++
        if (n.lum < DARK_LUM) darkNeighborCount++
      }

      const neighborContrast = maxLum - minLum

      // Outline Black 条件：
      // - 邻居之间有显著对比（两侧是不同颜色区域）
      // - 至少有一个浅色邻居（不是纯深色内部）
      // - 自身有深色像素
      const isOutline =
        neighborContrast > 50 &&
        lightNeighborCount >= 1 &&
        hasSignificantDark

      // Fill Black 条件：
      // - 大部分邻居都是深色（周围都是深色区域）
      // - 或自身非常暗且邻居对比度低
      const isFill =
        darkNeighborCount >= 2 &&
        neighborContrast < 50

      if (isOutline && !isFill) {
        classification[idx] = 1 // Outline Black
      } else if (isFill || (selfIsDark && darkNeighborCount >= 2)) {
        classification[idx] = 2 // Fill Black
      } else if (hasSignificantDark && lightNeighborCount >= 1 && neighborContrast > 30) {
        // 边界情况：有深色像素且有浅色邻居，但对比度不够高
        // 仍然标记为 outline（保守处理）
        classification[idx] = 1
      }
    }
  }

  return classification
}

// ============================================================
// 10.2 Small Board V2: Structure-Aware Color Extraction
// ============================================================

/**
 * V2 结构感知颜色提取
 *
 * 与 V1 的关键区别：
 * - V1: 所有 edge 格子都替换为 darkPixelColor → 导致大面积变黑
 * - V2: 只有 Outline Black 格子使用 darkPixelColor
 *        Fill Black 格子保持原始平均色 → 让颜色匹配自然处理
 *
 * 这样头发区域内部不会被强制变黑，只有真正的轮廓线变黑
 */
function applyStructureAwareColorsV2(
  cellColors: [number, number, number][],
  edgeInfo: CellEdgeInfo[],
  outlineClassification: Uint8Array
): [number, number, number][] {
  const result: [number, number, number][] = []
  for (let i = 0; i < cellColors.length; i++) {
    const avg = cellColors[i]
    if (avg[0] < 0) { result.push([-1, -1, -1]); continue }

    // 只有 Outline Black 格子使用深色像素颜色
    if (outlineClassification[i] === 1 && edgeInfo[i].darkPixelColor) {
      result.push([...edgeInfo[i].darkPixelColor!])
    } else {
      // Fill Black 和非边缘格子 → 保持原始平均色
      result.push([...avg])
    }
  }
  return result
}

// ============================================================
// 10.3 Small Board V2: Conservative Feature Protection
// ============================================================

/**
 * V2 小特征保护（保守版）
 *
 * 与 V1 的关键区别：
 * - V1: darkPixelRatio ≥ 8% 就变黑 → 导致眼睛扩大到周围皮肤
 * - V2: darkPixelRatio ≥ 30% 且格子必须被浅色邻居包围
 *        且不能与已有黑色格子相邻（防止膨胀）
 *
 * 只保护真正的"深色孤点"特征：
 * - 眼睛：被肤色包围的深色点
 * - 眼泪：小面积深色点
 * - 纽扣：被衣服色包围的深色点
 */
function preserveCriticalFeatures52(
  matchedCodes: (string | null)[],
  edgeInfo: CellEdgeInfo[],
  outlineClassification: Uint8Array,
  cellColors: [number, number, number][],
  outlineColors: LabColor[],
  gridW: number,
  gridH: number
): (string | null)[] {
  const result = [...matchedCodes]
  const outlineCodes = new Set(outlineColors.map(c => c.code))

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x
      if (!result[idx]) continue
      if (outlineCodes.has(result[idx]!)) continue
      // 只处理 Fill Black 格子（内部深色特征）
      if (outlineClassification[idx] !== 2) continue

      const info = edgeInfo[idx]
      // 必须有高对比度
      if (info.localContrast < 0.30) continue
      // 必须有深色像素
      if (!info.darkPixelColor) continue
      // 深色占比至少 30%（远高于 V1 的 8%）
      if (info.darkPixelRatio < 0.30) continue

      // 检查邻居：必须被浅色格子包围（这是眼睛/特征，不是大面积深色区域）
      let lightNeighborCount = 0
      let darkOutlineNeighborCount = 0
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
        const nIdx = ny * gridW + nx
        const nRgb = cellColors[nIdx]
        if (nRgb[0] < 0) continue
        const nLum = 0.299 * nRgb[0] + 0.587 * nRgb[1] + 0.114 * nRgb[2]
        if (nLum > 100) lightNeighborCount++
        // 检查邻居是否已经是轮廓色
        if (result[nIdx] && outlineCodes.has(result[nIdx]!)) {
          darkOutlineNeighborCount++
        }
      }

      // 关键：如果邻居中已有 2+ 个轮廓色格子，不保护
      // → 这说明该格子已经接近其他黑色区域，保护会导致粘连
      if (darkOutlineNeighborCount >= 2) continue

      // 必须至少有 1 个浅色邻居（被浅色包围的特征）
      if (lightNeighborCount < 1) continue

      // 保护：使用最接近的轮廓色
      const darkLab = rgbToLab(info.darkPixelColor[0], info.darkPixelColor[1], info.darkPixelColor[2])
      const { color: outlineColor, deltaE } = findClosestPaletteColor(darkLab, outlineColors)
      if (deltaE < 25) {
        result[idx] = outlineColor.code
      }
    }
  }
  return result
}

// ============================================================
// 10.4 Small Board V2: Outline Skeleton Thinning
// ============================================================

/**
 * 轮廓骨架细化
 *
 * 将 2+ 格宽的黑色轮廓细化为 1 格宽的中心线
 *
 * 规则：
 * - 如果一个轮廓色格子的左右或上下邻居都是轮廓色
 *   → 该格子是 2+ 宽线条的中间部分
 * - 检查该格子是否可以安全移除（移除后不会导致断线）
 * - 只移除"多余"的轮廓色格子，保留中心线
 *
 * 关键约束：
 * - 不增加任何黑色面积，只减少
 * - 不导致轮廓断裂
 * - 移除的格子恢复为原始颜色匹配结果
 */
function thinOutlineSkeleton52(
  matchedCodes: (string | null)[],
  originalCodes: (string | null)[],
  outlineColors: LabColor[],
  edgeInfo: CellEdgeInfo[],
  gridW: number,
  gridH: number
): (string | null)[] {
  const result = [...matchedCodes]
  const outlineCodes = new Set(outlineColors.map(c => c.code))
  const isOutline = (code: string | null): boolean =>
    code !== null && outlineCodes.has(code)

  // 遍历所有轮廓色格子
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x
      if (!isOutline(result[idx])) continue

      // 检查水平方向：左右都是轮廓色 → 该格子可能多余
      if (x > 0 && x < gridW - 1) {
        const leftIdx = y * gridW + (x - 1)
        const rightIdx = y * gridW + (x + 1)
        if (isOutline(result[leftIdx]) && isOutline(result[rightIdx])) {
          // 检查移除后是否安全：
          // 上下邻居不能都是轮廓色（否则该格子是交叉点，不能移除）
          let canRemove = true

          // 检查上下方向是否也连续
          if (y > 0 && y < gridH - 1) {
            const topIdx = (y - 1) * gridW + x
            const botIdx = (y + 1) * gridW + x
            // 如果上下也是轮廓色，说明是交叉点/粗节点，不移除
            if (isOutline(result[topIdx]) && isOutline(result[botIdx])) {
              canRemove = false
            }
          }

          // 检查移除后左右是否仍然连通（通过其他路径）
          if (canRemove) {
            // 临时移除
            const oldCode = result[idx]
            result[idx] = originalCodes[idx] || null

            // BFS 检查 leftIdx 和 rightIdx 是否仍连通
            if (!isConnectedViaOutline(result, leftIdx, rightIdx, gridW, gridH, isOutline, 40)) {
              // 不连通 → 恢复
              result[idx] = oldCode
            }
          }
        }
      }

      // 检查垂直方向：上下都是轮廓色
      if (y > 0 && y < gridH - 1) {
        const topIdx = (y - 1) * gridW + x
        const botIdx = (y + 1) * gridW + x
        if (isOutline(result[topIdx]) && isOutline(result[botIdx])) {
          let canRemove = true

          if (x > 0 && x < gridW - 1) {
            const leftIdx = y * gridW + (x - 1)
            const rightIdx = y * gridW + (x + 1)
            if (isOutline(result[leftIdx]) && isOutline(result[rightIdx])) {
              canRemove = false
            }
          }

          if (canRemove) {
            const oldCode = result[idx]
            result[idx] = originalCodes[idx] || null

            if (!isConnectedViaOutline(result, topIdx, botIdx, gridW, gridH, isOutline, 40)) {
              result[idx] = oldCode
            }
          }
        }
      }
    }
  }

  return result
}

/**
 * BFS 检查两个轮廓色格子是否通过其他轮廓色格子连通
 */
function isConnectedViaOutline(
  codes: (string | null)[],
  idx1: number,
  idx2: number,
  gridW: number,
  gridH: number,
  isOutline: (code: string | null) => boolean,
  maxSteps: number
): boolean {
  const visited = new Set<number>([idx1])
  const queue = [idx1]
  let steps = 0

  while (queue.length > 0 && steps < maxSteps) {
    const cur = queue.shift()!
    steps++
    if (cur === idx2) return true

    const cx = cur % gridW
    const cy = Math.floor(cur / gridW)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dy === 0 && dx === 0) continue
        const nx = cx + dx, ny = cy + dy
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
        const nIdx = ny * gridW + nx
        if (visited.has(nIdx)) continue
        if (!isOutline(codes[nIdx])) continue
        visited.add(nIdx)
        queue.push(nIdx)
      }
    }
  }
  return false
}

// ============================================================
// 10.5 Small Board V2: Topology-Validated Gap Repair
// ============================================================

/**
 * 带拓扑验证的轮廓间隙修复
 *
 * 规则：
 * 1. 只修复 1 格间隙（■ □ ■）
 * 2. 两侧必须是同一条连续轮廓（BFS 验证）
 * 3. 修复后执行拓扑验证：
 *    a. 不连接两个独立区域（修复前不连通，修复后才连通 → 不允许）
 *    b. 不形成大面积黑色块
 *    c. 不导致黑色像素数量明显增加
 * 4. 如果拓扑验证失败 → 撤销修复
 */
function repairGapsWithTopology52(
  matchedCodes: (string | null)[],
  edgeInfo: CellEdgeInfo[],
  outlineColors: LabColor[],
  gridW: number,
  gridH: number
): { matchedCodes: (string | null)[]; repairedCount: number } {
  const outlineCodes = new Set(outlineColors.map(c => c.code))
  const isOutline = (code: string | null): boolean =>
    code !== null && outlineCodes.has(code)

  const result = [...matchedCodes]
  const original = [...matchedCodes]
  let repairedCount = 0

  // 统计修复前黑色像素数
  const blackCountBefore = result.filter(c => isOutline(c)).length
  const dirs8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]

  const repairs: { idx: number; code: string }[] = []

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x
      const code = result[idx]

      if (isOutline(code)) continue
      if (!code) continue
      // 必须有深色像素（是轮廓间隙，不是纯色区域中间）
      if (!edgeInfo[idx].darkPixelColor) continue
      // 深色占比不能太低
      if (edgeInfo[idx].darkPixelRatio < 0.05) continue

      // 检查 4 个方向是否存在 1 格间隙
      type Check = { n1: number; n2: number }
      let check: Check | null = null

      // 水平
      if (!check && x > 0 && x < gridW - 1) {
        const li = y * gridW + (x - 1)
        const ri = y * gridW + (x + 1)
        if (isOutline(result[li]) && isOutline(result[ri]))
          check = { n1: li, n2: ri }
      }
      // 垂直
      if (!check && y > 0 && y < gridH - 1) {
        const ti = (y - 1) * gridW + x
        const bi = (y + 1) * gridW + x
        if (isOutline(result[ti]) && isOutline(result[bi]))
          check = { n1: ti, n2: bi }
      }
      // 对角 ↘
      if (!check && x > 0 && x < gridW - 1 && y > 0 && y < gridH - 1) {
        const tli = (y - 1) * gridW + (x - 1)
        const bri = (y + 1) * gridW + (x + 1)
        if (isOutline(result[tli]) && isOutline(result[bri]))
          check = { n1: tli, n2: bri }
      }
      // 对角 ↙
      if (!check && x > 0 && x < gridW - 1 && y > 0 && y < gridH - 1) {
        const tri = (y - 1) * gridW + (x + 1)
        const bli = (y + 1) * gridW + (x - 1)
        if (isOutline(result[tri]) && isOutline(result[bli]))
          check = { n1: tri, n2: bli }
      }

      if (!check) continue

      // 条件 1: 两侧必须是同一条连续轮廓
      // 使用原始状态检查（避免修复之间的相互影响）
      if (!isConnectedViaOutline(original, check.n1, check.n2, gridW, gridH, isOutline, 30)) {
        continue
      }

      // 条件 2: 检查该格子是否同时与多个不同的轮廓区域相邻
      // 如果是，修复会导致区域粘连
      for (const [dx, dy] of dirs8) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
        const nIdx = ny * gridW + nx
        if (!isOutline(original[nIdx])) continue
        // 标记这个邻居所属的轮廓区域（用 BFS 区域 ID）
        // 简化：如果该邻居不通过 check.n1 或 check.n2 连通，说明是不同区域
      }

      // 记录修复候选
      repairs.push({ idx, code: result[check.n1]! })
    }
  }

  // 逐个应用修复并验证拓扑
  for (const repair of repairs) {
    const beforeState = result[repair.idx]
    result[repair.idx] = repair.code

    // 拓扑验证
    const blackCountAfter = result.filter(c => isOutline(c)).length
    const blackIncrease = blackCountAfter - blackCountBefore

    // 验证 1: 黑色像素增加不能超过 5%（防止大面积膨胀）
    if (blackIncrease > Math.max(3, blackCountBefore * 0.05)) {
      result[repair.idx] = beforeState
      continue
    }

    // 验证 2: 检查修复是否连接了两个原本不连通的区域
    // 在修复前，检查该格子的所有轮廓色邻居是否属于不同区域
    const x = repair.idx % gridW
    const y = Math.floor(repair.idx / gridW)
    const outlineNeighbors: number[] = []
    for (const [dx, dy] of dirs8) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
      const nIdx = ny * gridW + nx
      if (isOutline(result[nIdx])) outlineNeighbors.push(nIdx)
    }

    // 如果有 3+ 个轮廓色邻居，检查它们是否都属于同一区域
    if (outlineNeighbors.length >= 3) {
      // 临时移除修复，检查邻居间的连通性
      result[repair.idx] = beforeState
      let allConnected = true
      for (let i = 0; i < outlineNeighbors.length && allConnected; i++) {
        for (let j = i + 1; j < outlineNeighbors.length; j++) {
          if (!isConnectedViaOutline(result, outlineNeighbors[i], outlineNeighbors[j], gridW, gridH, isOutline, 30)) {
            allConnected = false
            break
          }
        }
      }
      if (!allConnected) {
        // 修复会连接不同区域 → 撤销
        continue
      }
      // 所有邻居已连通 → 安全修复
      result[repair.idx] = repair.code
    }

    repairedCount++
  }

  return { matchedCodes: result, repairedCount }
}

// ============================================================
// 10.6 Small Board V2: Detail Priority Filter
// ============================================================

/**
 * 细节优先级过滤
 *
 * Priority 1: 主体外轮廓 → 始终保留
 * Priority 2: 眼睛、嘴巴、脸部边界、手部、衣服轮廓 → 保留
 * Priority 3: 主要颜色区域 → 保留
 * Priority 4: 小面积阴影、腮红、高光 → 允许合并到相邻主色
 *
 * 规则：
 * - 面积 ≤ 1 格的非轮廓色、非高对比度区域 → 合并到最大邻居
 * - 轮廓色区域不合并
 * - 高对比度区域不合并（重要特征）
 * - 与邻居颜色差异过大（Delta E > 15）的小区域不合并（可能是重要细节）
 */
function applyDetailPriority52(
  matchedCodes: (string | null)[],
  edgeInfo: CellEdgeInfo[],
  outlineClassification: Uint8Array,
  colorMap: Map<string, PaletteColor>,
  gridW: number,
  gridH: number
): (string | null)[] {
  const result = [...matchedCodes]

  // 检测轮廓色
  const outlineCodes = new Set<string>()
  for (const c of colorMap.values()) {
    const lab = rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2])
    if (lab[0] < 35) outlineCodes.add(c.code)
  }

  // Flood fill 找连通区域
  const visited = new Array(result.length).fill(false)
  const regionId = new Array(result.length).fill(-1)
  const regions: { code: string; cells: number[] }[] = []

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x
      if (visited[idx] || !result[idx]) continue

      const code = result[idx]!
      const id = regions.length
      const cells: number[] = []
      const queue = [idx]
      visited[idx] = true

      while (queue.length > 0) {
        const cur = queue.shift()!
        cells.push(cur)
        regionId[cur] = id

        const cx = cur % gridW, cy = Math.floor(cur / gridW)
        const nbrs = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]
        for (const [nx, ny] of nbrs) {
          if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
          const ni = ny * gridW + nx
          if (!visited[ni] && result[ni] === code) {
            visited[ni] = true
            queue.push(ni)
          }
        }
      }
      regions.push({ code, cells })
    }
  }

  // 合并低优先级的孤立小区域
  for (const region of regions) {
    // 面积 > 2 格 → 保留
    if (region.cells.length > 2) continue
    // 轮廓色 → 保留 (Priority 1)
    if (outlineCodes.has(region.code)) continue
    // Outline Black 分类 → 保留
    let isOutlineRegion = false
    for (const ci of region.cells) {
      if (outlineClassification[ci] === 1) { isOutlineRegion = true; break }
    }
    if (isOutlineRegion) continue

    // 检查是否有高对比度格子 (Priority 2)
    let hasHighContrast = false
    for (const ci of region.cells) {
      if (edgeInfo[ci].localContrast > 0.30) { hasHighContrast = true; break }
    }
    if (hasHighContrast) continue

    // 找最常见的相邻区域
    const nbrRegions = new Map<number, number>()
    for (const ci of region.cells) {
      const cx = ci % gridW, cy = Math.floor(ci / gridW)
      const nbrs = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]
      for (const [nx, ny] of nbrs) {
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
        const ni = ny * gridW + nx
        const rid = regionId[ni]
        const ridIdx = regions.findIndex(r => r.cells.includes(ni))
        if (ridIdx >= 0 && ridIdx !== regions.indexOf(region)) {
          nbrRegions.set(ridIdx, (nbrRegions.get(ridIdx) || 0) + 1)
        }
      }
    }
    if (nbrRegions.size === 0) continue

    let bestId = -1, bestCount = 0
    for (const [rid, cnt] of nbrRegions) {
      if (cnt > bestCount) { bestCount = cnt; bestId = rid }
    }
    if (bestId < 0) continue

    const nbrRegion = regions[bestId]
    // 颜色相似度检查：Delta E < 12 才合并（避免合并重要颜色差异）
    const rColor = colorMap.get(region.code)
    const nColor = colorMap.get(nbrRegion.code)
    if (!rColor || !nColor) continue

    const rLab = rgbToLab(rColor.rgb[0], rColor.rgb[1], rColor.rgb[2])
    const nLab = rgbToLab(nColor.rgb[0], nColor.rgb[1], nColor.rgb[2])
    if (deltaE2000(rLab, nLab) < 12) {
      for (const ci of region.cells) result[ci] = nbrRegion.code
    }
  }

  return result
}

// ============================================================
// 10.7 Small Board V2: Safe Edge Preservation (no Pass 2)
// ============================================================

/**
 * V2 安全轮廓保护（52×52 专用）
 *
 * 与通用 applyEdgePreservation 的区别：
 * - 不执行 Pass 2（连通性扩展）→ 防止黑色膨胀
 * - Pass 1 只处理 Outline Black 格子
 * - Fill Black 格子完全不受轮廓保护影响
 */
function safeEdgePreservation52(
  matchedCodes: (string | null)[],
  edgeInfo: CellEdgeInfo[],
  outlineClassification: Uint8Array,
  outlineColors: LabColor[]
): { matchedCodes: (string | null)[]; edgeCellCount: number } {
  const result = [...matchedCodes]
  const outlineCodes = new Set(outlineColors.map(c => c.code))
  let edgeCellCount = 0

  // 只处理 Outline Black 格子
  for (let i = 0; i < edgeInfo.length; i++) {
    if (outlineClassification[i] !== 1) continue
    if (!edgeInfo[i].darkPixelColor) continue

    // 已经是轮廓色 → 计数并跳过
    if (outlineCodes.has(result[i]!)) {
      edgeCellCount++
      continue
    }

    // Outline Black 格子 → 使用轮廓色
    const darkLab = rgbToLab(
      edgeInfo[i].darkPixelColor![0],
      edgeInfo[i].darkPixelColor![1],
      edgeInfo[i].darkPixelColor![2]
    )
    const { color: outlineColor, deltaE } = findClosestPaletteColor(darkLab, outlineColors)
    if (deltaE < 25) {
      result[i] = outlineColor.code
      edgeCellCount++
    }
  }

  // 不执行 Pass 2 → 不做连通性扩展
  return { matchedCodes: result, edgeCellCount }
}

/**
 * 52×52 小板专用优化管线 V2
 *
 * V2 核心改进（解决黑色膨胀和粘连）：
 * 1. Outline Black vs Fill Black 分类 → 只有真正轮廓线变黑
 * 2. 结构感知颜色提取 V2 → Fill Black 保持原色，不强制变黑
 * 3. 保守小特征保护 → 30% 阈值 + 隔离检查，防止眼睛扩大
 * 4. 轮廓骨架细化 → 2+ 宽线条细化为中心线，不增加黑色面积
 * 5. 拓扑验证间隙修复 → 只修复同一条轮廓的 1 格间隙
 * 6. 细节优先级过滤 → 低优先级散点合并，高优先级保留
 * 7. 安全轮廓保护 → 不执行 Pass 2 连通性扩展
 *
 * 78×78 / 104×104 完全不受影响，继续使用标准管线
 */
async function generateSmallBoardPattern(
  image: HTMLImageElement,
  gridWidth: number,
  gridHeight: number,
  colors: PaletteColor[],
  matchMode: 'standard' | 'limited',
  maxColors: number,
  onStep?: (step: string) => void,
  options: {
    dither?: boolean
    ditherStrength?: number
    debug?: boolean
  } = {}
): Promise<QuantizationResult> {
  const debug = options.debug || false
  // 52×52 强制关闭抖动
  const dither = false

  // Step 1: 图片预处理
  onStep?.('preprocess')
  await nextFrame()
  const { data: rawData, width: rawW, height: rawH } = imagePreprocess(image)

  // Step 2: 主体检测与智能裁剪
  onStep?.('subjectDetection')
  await nextFrame()
  const { data: srcData, width: srcW, height: srcH } = cropToSubject(rawData, rawW, rawH)

  // Step 3: 边缘检测（在裁剪后的图片上）
  onStep?.('edgeDetection')
  await nextFrame()
  const edgeMap = detectEdges(srcData, srcW, srcH)

  // Step 4: 网格化
  onStep?.('gridding')
  await nextFrame()
  const { cellColors: rawCellColors, mapping, edgeInfo } = resizeToGrid(
    srcData, srcW, srcH, gridWidth, gridHeight, edgeMap
  )

  // Step 5: Outline Black vs Fill Black 分类（V2 核心改进）
  onStep?.('structureAnalysis')
  await nextFrame()
  const outlineClassification = classifyOutlineVsFill52(rawCellColors, edgeInfo, gridWidth, gridHeight)

  // Step 5b: V2 结构感知颜色提取（只有 Outline Black 使用深色色，Fill Black 保持原色）
  let cellColors = applyStructureAwareColorsV2(rawCellColors, edgeInfo, outlineClassification)

  // Step 6: 前景检测
  onStep?.('foreground')
  await nextFrame()
  const { mask: foregroundMask, bbox: foregroundBBox } = detectForeground(cellColors, gridWidth, gridHeight)

  // Step 7: 预计算 Lab
  onStep?.('precomputing')
  await nextFrame()
  const labColors = colors.map(c => ({
    code: c.code, name: c.name || c.code, hex: c.hex, rgb: c.rgb,
    lab: rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2]),
  }))

  // Step 8: 背景色检测 + 轮廓色
  const backgroundCodes = detectBackgroundPaletteColors(cellColors, gridWidth, gridHeight, labColors)
  const outlineColors = findOutlineColors(labColors)

  // Step 9: 受约束颜色匹配（颜色匹配逻辑不变）
  onStep?.('matching')
  await nextFrame()

  let effectiveLabColors = labColors
  if (matchMode === 'limited' && maxColors < colors.length) {
    const allowedCodes = selectHierarchicalColors(cellColors, labColors, maxColors, backgroundCodes, foregroundMask)
    effectiveLabColors = labColors.filter(c => allowedCodes.has(c.code))
  }

  const matchedCodes: (string | null)[] = []
  const debugGrid: DebugCellInfo[][] = debug ? [] : []

  for (let i = 0; i < cellColors.length; i++) {
    const rgb = cellColors[i]
    if (rgb[0] < 0) {
      matchedCodes.push(null)
      if (debug) {
        const y = Math.floor(i / gridWidth), x = i % gridWidth
        if (!debugGrid[y]) debugGrid[y] = []
        debugGrid[y][x] = {
          originalRgb: [-1, -1, -1], originalLab: [0, 0, 0],
          matchedCode: null, matchedHex: '', matchedLab: [0, 0, 0],
          deltaE: 0, hueDiff: 0, lightnessDiff: 0, saturationDiff: 0,
        }
      }
      continue
    }
    const origLab = rgbToLab(rgb[0], rgb[1], rgb[2])
    const isFg = foregroundMask[i]
    const { color, deltaE, hueDiff, lightnessDiff, saturationDiff } = findClosestPaletteColor(
      origLab, effectiveLabColors, backgroundCodes, isFg
    )
    matchedCodes.push(color.code)
    if (debug) {
      const y = Math.floor(i / gridWidth), x = i % gridWidth
      if (!debugGrid[y]) debugGrid[y] = []
      debugGrid[y][x] = {
        originalRgb: [rgb[0], rgb[1], rgb[2]], originalLab: origLab,
        matchedCode: color.code, matchedHex: color.hex, matchedLab: color.lab,
        deltaE, hueDiff, lightnessDiff, saturationDiff,
      }
    }
  }

  // 保存颜色匹配后的原始结果（用于骨架细化时恢复）
  const matchedAfterColorMatch = [...matchedCodes]

  // Step 10: V2 保守小特征保护（30% 阈值 + 隔离检查）
  onStep?.('featurePreservation')
  await nextFrame()
  const featureCodes = preserveCriticalFeatures52(
    matchedCodes, edgeInfo, outlineClassification, cellColors, outlineColors, gridWidth, gridHeight
  )
  for (let i = 0; i < matchedCodes.length; i++) matchedCodes[i] = featureCodes[i]

  // Step 11: 构建网格
  onStep?.('building')
  await nextFrame()
  let grid: PatternGrid = []
  for (let y = 0; y < gridHeight; y++) {
    const row: (string | null)[] = []
    for (let x = 0; x < gridWidth; x++) row.push(matchedCodes[y * gridWidth + x])
    grid.push(row)
  }
  const colorMap = new Map(colors.map(c => [c.code, c]))

  // Step 12: 颜色简化（逻辑不变）
  onStep?.('simplifying')
  await nextFrame()
  const { grid: simplifiedGrid, merged } = simplifyPalette(grid, colorMap)
  if (merged.size > 0) {
    grid = simplifiedGrid
    for (let i = 0; i < matchedCodes.length; i++) {
      if (matchedCodes[i] && merged.has(matchedCodes[i]!)) {
        matchedCodes[i] = merged.get(matchedCodes[i]!)!
      }
    }
  }

  // Step 13: 层次保持（逻辑不变）
  onStep?.('hierarchy')
  await nextFrame()
  const hierarchyCodes = preserveColorHierarchy(grid, cellColors, matchedCodes, colorMap, edgeInfo)
  grid = []
  for (let y = 0; y < gridHeight; y++) {
    const row: (string | null)[] = []
    for (let x = 0; x < gridWidth; x++) row.push(hierarchyCodes[y * gridWidth + x])
    grid.push(row)
  }
  for (let i = 0; i < matchedCodes.length; i++) matchedCodes[i] = hierarchyCodes[i]

  // Step 14: V2 安全轮廓保护（不执行 Pass 2 连通性扩展）
  onStep?.('edgePreservation')
  await nextFrame()
  const edgeResult = safeEdgePreservation52(matchedCodes, edgeInfo, outlineClassification, outlineColors)
  for (let i = 0; i < matchedCodes.length; i++) matchedCodes[i] = edgeResult.matchedCodes[i]
  grid = []
  for (let y = 0; y < gridHeight; y++) {
    const row: (string | null)[] = []
    for (let x = 0; x < gridWidth; x++) row.push(matchedCodes[y * gridWidth + x])
    grid.push(row)
  }

  // Step 14b: 轮廓骨架细化（将 2+ 宽线条细化为 1 宽中心线）
  onStep?.('skeletonThinning')
  await nextFrame()
  const thinnedCodes = thinOutlineSkeleton52(
    matchedCodes, matchedAfterColorMatch, outlineColors, edgeInfo, gridWidth, gridHeight
  )
  for (let i = 0; i < matchedCodes.length; i++) matchedCodes[i] = thinnedCodes[i]
  grid = []
  for (let y = 0; y < gridHeight; y++) {
    const row: (string | null)[] = []
    for (let x = 0; x < gridWidth; x++) row.push(matchedCodes[y * gridWidth + x])
    grid.push(row)
  }

  // Step 15: V2 细节优先级过滤（合并低优先级散点）
  onStep?.('regionSimplification')
  await nextFrame()
  const priorityCodes = applyDetailPriority52(
    matchedCodes, edgeInfo, outlineClassification, colorMap, gridWidth, gridHeight
  )
  for (let i = 0; i < matchedCodes.length; i++) matchedCodes[i] = priorityCodes[i]
  grid = []
  for (let y = 0; y < gridHeight; y++) {
    const row: (string | null)[] = []
    for (let x = 0; x < gridWidth; x++) row.push(matchedCodes[y * gridWidth + x])
    grid.push(row)
  }

  // Step 16: V2 拓扑验证间隙修复（只修复同一条轮廓的 1 格间隙）
  onStep?.('gapRepair')
  await nextFrame()
  const gapResult = repairGapsWithTopology52(matchedCodes, edgeInfo, outlineColors, gridWidth, gridHeight)
  if (gapResult.repairedCount > 0) {
    for (let i = 0; i < matchedCodes.length; i++) matchedCodes[i] = gapResult.matchedCodes[i]
    grid = []
    for (let y = 0; y < gridHeight; y++) {
      const row: (string | null)[] = []
      for (let x = 0; x < gridWidth; x++) row.push(matchedCodes[y * gridWidth + x])
      grid.push(row)
    }
  }

  // Step 17: Detail Loss Detection
  onStep?.('detailAnalysis')
  await nextFrame()
  const { detailWarning, recommendedBoardSize } = detectDetailLoss(edgeInfo, mapping, srcW, srcH)

  // Step 18: 统计
  onStep?.('counting')
  await nextFrame()
  const codeCounts = new Map<string, number>()
  for (const code of matchedCodes) {
    if (!code) continue
    codeCounts.set(code, (codeCounts.get(code) || 0) + 1)
  }
  const total = matchedCodes.filter(c => c !== null).length
  const stats: ColorStat[] = []
  for (const [code, count] of codeCounts) {
    const color = colorMap.get(code)
    if (!color) continue
    stats.push({
      code: color.code, name: color.name || color.code, hex: color.hex,
      rgb: color.rgb, count, percentage: (count / total) * 100,
    })
  }
  stats.sort((a, b) => b.count - a.count)
  const usedColors = stats.map(s => colorMap.get(s.code)!).filter(Boolean)

  onStep?.('done')

  return {
    grid, stats, totalBeads: total, usedColors, cellColors, mapping,
    foregroundMask, foregroundBBox: foregroundBBox || undefined,
    edgeInfo, edgeCellCount: edgeResult.edgeCellCount,
    detailWarning, recommendedBoardSize,
    debugGrid: debug ? debugGrid : undefined,
  }
}

// ============================================================
// 11. generateBeadPattern — 主入口
// ============================================================

/**
 * 完整颜色量化管线
 *
 * 52×52（minDim ≤ 60）：使用 generateSmallBoardPattern 专用优化管线
 * 78×78+：使用标准管线（不修改）
 *
 * 标准管线流程：
 * 1. imagePreprocess → 加载图片
 * 2. detectEdges → Sobel 边缘检测（在原始图片上）
 * 3. resizeToGrid → 网格化（Contain 映射 + 边缘指标计算）
 * 4. detectForeground → 前景检测
 * 5. detectBackgroundPaletteColors → 背景色检测
 * 6. findOutlineColors → 查找色卡深色作为轮廓候选
 * 7. findClosestPaletteColor → 受约束匹配（前景避免背景色）
 * 8. simplifyPalette → 颜色简化
 * 9. preserveColorHierarchy → 层次保持（跳过边缘格子）
 * 10. applyEdgePreservation → 轮廓保护（最后运行，不被覆盖）
 * 11. repairOutlineGaps → 轮廓间隙修复（仅 52/78）
 */
export async function generateBeadPattern(
  image: HTMLImageElement,
  gridWidth: number,
  gridHeight: number,
  colors: PaletteColor[],
  matchMode: 'standard' | 'limited',
  maxColors: number,
  onStep?: (step: string) => void,
  options: {
    dither?: boolean
    ditherStrength?: number
    debug?: boolean
  } = {}
): Promise<QuantizationResult> {
  // 52×52 小板：使用专用优化管线，78×78+ 不受影响
  const minDim = Math.min(gridWidth, gridHeight)
  if (minDim <= 60) {
    return generateSmallBoardPattern(image, gridWidth, gridHeight, colors, matchMode, maxColors, onStep, options)
  }

  const { dither = false, ditherStrength = 0.3, debug = false } = options

  // Step 1: 图片预处理
  onStep?.('preprocess')
  await nextFrame()
  const { data: srcData, width: srcW, height: srcH } = imagePreprocess(image)

  // Step 2: 边缘检测（在原始图片上运行 Sobel）
  onStep?.('edgeDetection')
  await nextFrame()
  const edgeMap = detectEdges(srcData, srcW, srcH)

  // Step 3: 网格化（Contain 映射 + 边缘指标计算）
  onStep?.('gridding')
  await nextFrame()
  const { cellColors: rawCellColors, mapping, edgeInfo } = resizeToGrid(
    srcData, srcW, srcH, gridWidth, gridHeight, edgeMap
  )
  let cellColors = rawCellColors

  // Step 4: 前景检测
  onStep?.('foreground')
  await nextFrame()
  const { mask: foregroundMask, bbox: foregroundBBox } = detectForeground(cellColors, gridWidth, gridHeight)

  // Step 5: 预计算 Lab
  onStep?.('precomputing')
  await nextFrame()
  const labColors = colors.map(c => ({
    code: c.code,
    name: c.name || c.code,
    hex: c.hex,
    rgb: c.rgb,
    lab: rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2]),
  }))

  // Step 6: 背景色检测
  const backgroundCodes = detectBackgroundPaletteColors(cellColors, gridWidth, gridHeight, labColors)

  // Step 7: 查找轮廓色（色卡中最深的 N 色）
  const outlineColors = findOutlineColors(labColors)

  // Step 7.5: 受控抖动（在匹配前应用）
  if (dither) {
    onStep?.('dithering')
    await nextFrame()
    cellColors = applyControlledDithering(cellColors, gridWidth, gridHeight, labColors, ditherStrength)
  }

  // Step 8: 受约束颜色匹配
  onStep?.('matching')
  await nextFrame()

  let effectiveLabColors = labColors

  // 限定模式：分层选色
  if (matchMode === 'limited' && maxColors < colors.length) {
    const allowedCodes = selectHierarchicalColors(cellColors, labColors, maxColors, backgroundCodes, foregroundMask)
    effectiveLabColors = labColors.filter(c => allowedCodes.has(c.code))
  }

  // 逐格匹配
  const matchedCodes: (string | null)[] = []
  const debugGrid: DebugCellInfo[][] = debug ? [] : []

  for (let i = 0; i < cellColors.length; i++) {
    const rgb = cellColors[i]

    // 透明格子
    if (rgb[0] < 0) {
      matchedCodes.push(null)
      if (debug) {
        const y = Math.floor(i / gridWidth)
        const x = i % gridWidth
        if (!debugGrid[y]) debugGrid[y] = []
        debugGrid[y][x] = {
          originalRgb: [-1, -1, -1],
          originalLab: [0, 0, 0],
          matchedCode: null,
          matchedHex: '',
          matchedLab: [0, 0, 0],
          deltaE: 0,
          hueDiff: 0,
          lightnessDiff: 0,
          saturationDiff: 0,
        }
      }
      continue
    }

    const origLab = rgbToLab(rgb[0], rgb[1], rgb[2])
    const isFg = foregroundMask[i]
    const { color, deltaE, hueDiff, lightnessDiff, saturationDiff } = findClosestPaletteColor(
      origLab, effectiveLabColors, backgroundCodes, isFg
    )

    matchedCodes.push(color.code)

    if (debug) {
      const y = Math.floor(i / gridWidth)
      const x = i % gridWidth
      if (!debugGrid[y]) debugGrid[y] = []
      debugGrid[y][x] = {
        originalRgb: [rgb[0], rgb[1], rgb[2]],
        originalLab: origLab,
        matchedCode: color.code,
        matchedHex: color.hex,
        matchedLab: color.lab,
        deltaE,
        hueDiff,
        lightnessDiff,
        saturationDiff,
      }
    }
  }

  // Step 9: 构建网格
  onStep?.('building')
  await nextFrame()
  let grid: PatternGrid = []
  for (let y = 0; y < gridHeight; y++) {
    const row: (string | null)[] = []
    for (let x = 0; x < gridWidth; x++) {
      row.push(matchedCodes[y * gridWidth + x])
    }
    grid.push(row)
  }

  const colorMap = new Map(colors.map(c => [c.code, c]))

  // Step 10: 颜色简化
  onStep?.('simplifying')
  await nextFrame()
  const { grid: simplifiedGrid, merged } = simplifyPalette(grid, colorMap)
  if (merged.size > 0) {
    grid = simplifiedGrid
    for (let i = 0; i < matchedCodes.length; i++) {
      if (matchedCodes[i] && merged.has(matchedCodes[i]!)) {
        matchedCodes[i] = merged.get(matchedCodes[i]!)!
      }
    }
  }

  // Step 11: 层次保持（跳过边缘格子，避免覆盖轮廓色）
  onStep?.('hierarchy')
  await nextFrame()
  const hierarchyCodes = preserveColorHierarchy(grid, cellColors, matchedCodes, colorMap, edgeInfo)

  // 更新网格和 matchedCodes
  grid = []
  for (let y = 0; y < gridHeight; y++) {
    const row: (string | null)[] = []
    for (let x = 0; x < gridWidth; x++) {
      row.push(hierarchyCodes[y * gridWidth + x])
    }
    grid.push(row)
  }
  for (let i = 0; i < matchedCodes.length; i++) {
    matchedCodes[i] = hierarchyCodes[i]
  }

  // Step 12: 轮廓保护后处理（最后运行，确保轮廓色不被覆盖）
  onStep?.('edgePreservation')
  await nextFrame()
  const edgeResult = applyEdgePreservation(
    grid, matchedCodes, edgeInfo, cellColors,
    srcData, srcW, mapping, gridWidth, gridHeight,
    outlineColors, effectiveLabColors
  )
  grid = edgeResult.grid
  for (let i = 0; i < matchedCodes.length; i++) {
    matchedCodes[i] = edgeResult.matchedCodes[i]
  }

  // Step 12.5: 轮廓间隙修复（仅 52×52 / 78×78，104×104+ 不修改）
  onStep?.('gapRepair')
  await nextFrame()
  const gapResult = repairOutlineGaps(matchedCodes, edgeInfo, gridWidth, gridHeight, outlineColors)
  if (gapResult.repairedCount > 0) {
    for (let i = 0; i < matchedCodes.length; i++) {
      matchedCodes[i] = gapResult.matchedCodes[i]
    }
    // 重建网格
    grid = []
    for (let y = 0; y < gridHeight; y++) {
      const row: (string | null)[] = []
      for (let x = 0; x < gridWidth; x++) {
        row.push(matchedCodes[y * gridWidth + x])
      }
      grid.push(row)
    }
  }

  // Step 13: Detail Loss Detection（分辨率不足检测 + 推荐画板尺寸）
  onStep?.('detailAnalysis')
  await nextFrame()
  const { detailWarning, recommendedBoardSize } = detectDetailLoss(
    edgeInfo, mapping, srcW, srcH
  )

  // Step 14: 统计（基于最终 matchedCodes，包含轮廓保护结果）
  onStep?.('counting')
  await nextFrame()
  const codeCounts = new Map<string, number>()
  for (const code of matchedCodes) {
    if (!code) continue
    codeCounts.set(code, (codeCounts.get(code) || 0) + 1)
  }

  const total = matchedCodes.filter(c => c !== null).length
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
      percentage: (count / total) * 100,
    })
  }
  stats.sort((a, b) => b.count - a.count)

  const usedColors = stats.map(s => colorMap.get(s.code)!).filter(Boolean)

  // Step 15: 完成
  onStep?.('done')

  return {
    grid,
    stats,
    totalBeads: total,
    usedColors,
    cellColors,
    mapping,
    foregroundMask,
    foregroundBBox: foregroundBBox || undefined,
    edgeInfo,
    edgeCellCount: edgeResult.edgeCellCount,
    detailWarning,
    recommendedBoardSize,
    debugGrid: debug ? debugGrid : undefined,
  }
}

// ============================================================
// 辅助函数
// ============================================================

/** 微任务延迟 */
function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

/** 预计算 Lab 值 */
function precomputeLabColors(colors: PaletteColor[]): LabColor[] {
  return colors.map(c => ({
    code: c.code,
    name: c.name || c.code,
    hex: c.hex,
    rgb: c.rgb,
    lab: rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2]),
  }))
}
