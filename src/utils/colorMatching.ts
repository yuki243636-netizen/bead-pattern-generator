// ============================================================
// 颜色匹配工具
// 使用 Lab 色彩空间 + Delta E (CIEDE2000) 进行最近色匹配
// 所有匹配操作都基于传入的 palette colors 数据
// ============================================================

import { rgbToLab, deltaE2000, deltaE76, getDifferenceLevel, type LabColor } from './colorSpace'
import type { PaletteColor, ReplacementSuggestion } from '../types'

/**
 * 预计算色卡颜色的 Lab 值，避免重复计算
 * 在生成图纸前调用一次，后续匹配全部使用缓存
 */
export function precomputeLabColors(colors: PaletteColor[]): LabColor[] {
  return colors.map(c => ({
    code: c.code,
    name: c.name || c.code,
    hex: c.hex,
    rgb: c.rgb,
    lab: rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2])
  }))
}

/**
 * 在色卡颜色中查找最接近的单一颜色
 * @param rgb 目标 RGB 值
 * @param labColors 预计算的 Lab 颜色数组
 * @returns 最接近的颜色（含 Lab 值）
 */
export function findClosestLabColor(
  rgb: [number, number, number],
  labColors: LabColor[]
): LabColor {
  const targetLab = rgbToLab(rgb[0], rgb[1], rgb[2])

  let best: LabColor = labColors[0]
  let bestDelta = Infinity

  for (const color of labColors) {
    const dE = deltaE2000(targetLab, color.lab)
    if (dE < bestDelta) {
      bestDelta = dE
      best = color
    }
  }

  return best
}

/**
 * 为图片像素数组匹配色卡颜色，返回每个像素对应的色卡编号
 * 透明像素（alpha < 128）返回 null
 * 支持 Floyd-Steinberg 抖动，提升颜色过渡的精准度
 */
export function matchPixelsToPalette(
  pixels: Uint8ClampedArray | number[][],
  labColors: LabColor[],
  width?: number,
  height?: number,
  dither: boolean = false
): (string | null)[] {
  if (dither && width && height) {
    return matchWithDithering(pixels as Uint8ClampedArray, width, height, labColors)
  }

  const result: (string | null)[] = []
  const len = Array.isArray(pixels[0]) ? pixels.length : pixels.length / 4

  for (let i = 0; i < len; i++) {
    let r: number, g: number, b: number, a: number
    if (Array.isArray(pixels[0])) {
      r = (pixels[i] as number[])[0]
      g = (pixels[i] as number[])[1]
      b = (pixels[i] as number[])[2]
      a = (pixels[i] as number[])[3] ?? 255
    } else {
      const arr = pixels as Uint8ClampedArray
      r = arr[i * 4]
      g = arr[i * 4 + 1]
      b = arr[i * 4 + 2]
      a = arr[i * 4 + 3]
    }

    if (a < 128) {
      result.push(null)
      continue
    }

    const targetLab = rgbToLab(r, g, b)
    let bestCode = labColors[0].code
    let bestDelta = Infinity

    for (const color of labColors) {
      const dE = deltaE2000(targetLab, color.lab)
      if (dE < bestDelta) {
        bestDelta = dE
        bestCode = color.code
      }
    }

    result.push(bestCode)
  }

  return result
}

/**
 * Floyd-Steinberg 抖动匹配
 * 将匹配误差扩散到相邻像素，显著提升颜色还原度
 */
function matchWithDithering(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  labColors: LabColor[]
): (string | null)[] {
  // 创建可写缓冲区（Float 防止误差累积溢出）
  const buffer = new Float32Array(width * height * 4)
  for (let i = 0; i < pixels.length; i++) {
    buffer[i] = pixels[i]
  }

  const result: (string | null)[] = []
  // 缓存 LabColor 的 RGB 值，避免重复查找
  const codeToRgb = new Map<string, [number, number, number]>()
  for (const c of labColors) {
    codeToRgb.set(c.code, c.rgb)
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const r = buffer[idx]
      const g = buffer[idx + 1]
      const b = buffer[idx + 2]
      const a = buffer[idx + 3]

      if (a < 128) {
        result.push(null)
        continue
      }

      // 匹配最接近的色卡颜色
      const targetLab = rgbToLab(
        Math.max(0, Math.min(255, r)),
        Math.max(0, Math.min(255, g)),
        Math.max(0, Math.min(255, b))
      )
      let bestCode = labColors[0].code
      let bestDelta = Infinity
      for (const color of labColors) {
        const dE = deltaE2000(targetLab, color.lab)
        if (dE < bestDelta) {
          bestDelta = dE
          bestCode = color.code
        }
      }

      result.push(bestCode)

      // 计算误差并扩散到相邻像素
      const matchedRgb = codeToRgb.get(bestCode)
      if (!matchedRgb) continue

      const errR = r - matchedRgb[0]
      const errG = g - matchedRgb[1]
      const errB = b - matchedRgb[2]

      // Floyd-Steinberg 误差扩散权重
      // → 右(7/16)  ↙(3/16)  ↓(5/16)  ↘(1/16)
      const distribute = [
        [1, 0, 7 / 16],   // 右
        [-1, 1, 3 / 16],  // 左下
        [0, 1, 5 / 16],   // 下
        [1, 1, 1 / 16],   // 右下
      ]

      for (const [dx, dy, weight] of distribute) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = (ny * width + nx) * 4
          buffer[nIdx] += errR * weight
          buffer[nIdx + 1] += errG * weight
          buffer[nIdx + 2] += errB * weight
        }
      }
    }
  }

  return result
}

/**
 * 有限颜色模式下，从色卡中选出最合适的 N 种颜色
 * 使用 k-means 思想的简化版：统计图片主色，与色卡做最近匹配后取用量最多的 N 种
 * 跳过透明像素
 */
export function selectLimitedColors(
  pixels: Uint8ClampedArray,
  labColors: LabColor[],
  maxColors: number
): Set<string> {
  const codeCounts = new Map<string, number>()
  const len = pixels.length / 4

  for (let i = 0; i < len; i++) {
    const a = pixels[i * 4 + 3]
    // 跳过透明像素
    if (a < 128) continue

    const r = pixels[i * 4]
    const g = pixels[i * 4 + 1]
    const b = pixels[i * 4 + 2]
    const targetLab = rgbToLab(r, g, b)

    let bestCode = labColors[0].code
    let bestDelta = Infinity
    for (const color of labColors) {
      const dE = deltaE2000(targetLab, color.lab)
      if (dE < bestDelta) {
        bestDelta = dE
        bestCode = color.code
      }
    }

    codeCounts.set(bestCode, (codeCounts.get(bestCode) || 0) + 1)
  }

  const sorted = [...codeCounts.entries()].sort((a, b) => b[1] - a[1])
  const selected = new Set<string>(sorted.slice(0, maxColors).map(e => e[0]))

  return selected
}

/**
 * 用有限的色卡子集重新匹配像素
 * 透明像素返回 null
 * 支持 Floyd-Steinberg 抖动
 */
export function matchPixelsToLimitedPalette(
  pixels: Uint8ClampedArray,
  labColors: LabColor[],
  allowedCodes: Set<string>,
  width?: number,
  height?: number,
  dither: boolean = false
): (string | null)[] {
  const limitedColors = labColors.filter(c => allowedCodes.has(c.code))

  if (dither && width && height) {
    return matchWithDithering(pixels, width, height, limitedColors)
  }

  const result: (string | null)[] = []
  const len = pixels.length / 4

  for (let i = 0; i < len; i++) {
    const a = pixels[i * 4 + 3]
    if (a < 128) {
      result.push(null)
      continue
    }

    const r = pixels[i * 4]
    const g = pixels[i * 4 + 1]
    const b = pixels[i * 4 + 2]
    const targetLab = rgbToLab(r, g, b)

    let bestCode = limitedColors[0].code
    let bestDelta = Infinity
    for (const color of limitedColors) {
      const dE = deltaE2000(targetLab, color.lab)
      if (dE < bestDelta) {
        bestDelta = dE
        bestCode = color.code
      }
    }

    result.push(bestCode)
  }

  return result
}

/**
 * 查找替换颜色推荐
 * 在排除当前颜色后，从色卡中找出最接近的替代色
 *
 * @param targetRgb 目标颜色的 RGB
 * @param labColors 预计算的 Lab 颜色数组
 * @param excludeCode 要排除的颜色编号
 * @param availableCodes 可用的颜色编号集合（用户拥有的颜色）
 * @returns 按色差排序的推荐数组
 */
export function findReplacementColors(
  targetRgb: [number, number, number],
  labColors: LabColor[],
  excludeCode: string,
  availableCodes?: Set<string>
): { color: LabColor; deltaE: number }[] {
  const targetLab = rgbToLab(targetRgb[0], targetRgb[1], targetRgb[2])
  const candidates = labColors.filter(c => {
    if (c.code === excludeCode) return false
    if (availableCodes && !availableCodes.has(c.code)) return false
    return true
  })

  const scored = candidates.map(c => ({
    color: c,
    deltaE: deltaE2000(targetLab, c.lab)
  }))

  scored.sort((a, b) => a.deltaE - b.deltaE)
  return scored.slice(0, 5)
}

/**
 * 生成替换建议
 */
export function buildReplacementSuggestions(
  stats: { code: string; name?: string; hex: string; rgb: [number, number, number]; count: number }[],
  labColors: LabColor[],
  missingCodes: Set<string>
): ReplacementSuggestion[] {
  const suggestions: ReplacementSuggestion[] = []

  for (const stat of stats) {
    if (!missingCodes.has(stat.code)) continue

    const replacements = findReplacementColors(stat.rgb, labColors, stat.code)
    if (replacements.length === 0) continue

    const best = replacements[0]
    suggestions.push({
      originalCode: stat.code,
      originalName: stat.name || stat.code,
      originalHex: stat.hex,
      originalRgb: stat.rgb,
      originalCount: stat.count,
      recommendedCode: best.color.code,
      recommendedName: best.color.name,
      recommendedHex: best.color.hex,
      recommendedRgb: best.color.rgb,
      deltaE: best.deltaE,
      difference: getDifferenceLevel(best.deltaE)
    })
  }

  return suggestions
}
