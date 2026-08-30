// ============================================================
// Palette Service — 色卡数据服务层
//
// 职责：动态读取 /public/data/palettes/bead-palettes.json，
// 提供色卡查询、颜色匹配、替换色推荐等接口。
//
// 所有色号、HEX、RGB 数据均来自 JSON 文件，不硬编码在组件中。
// 未来新增色卡只需在 JSON 文件中追加，无需修改本文件或核心算法。
// ============================================================

import type {
  Palette,
  PaletteColor,
  PaletteData
} from '../types'
import { rgbToLab, deltaE2000, getDifferenceLevel, type LabColor } from '../utils/colorSpace'
import { precomputeLabColors, findClosestLabColor } from '../utils/colorMatching'

/** 色卡 JSON 文件路径 */
const PALETTE_FILE = '/data/palettes/bead-palettes.json'

/**
 * 品牌色卡注册表
 * 每个品牌对应一个独立的 JSON 文件
 * 新增品牌只需在此添加一条记录 + 对应 JSON 文件
 */
const BRAND_FILES: Record<string, string> = {
  'mard-221': '/data/palettes/bead-palettes.json',  // MARD 从主文件加载
  'coco': '/data/palettes/coco.json',
  'manman': '/data/palettes/manman.json',
  'panpan': '/data/palettes/panpan.json',
  'mixiaowo': '/data/palettes/mixiaowo.json',
}

/** 品牌显示信息 */
const BRAND_INFO: Record<string, { name: string; name_cn: string; brand: string }> = {
  'mard-221': { name: 'MARD 221', name_cn: 'MARD 221色', brand: 'MARD' },
  'coco': { name: 'COCO 291', name_cn: 'COCO 291色', brand: 'COCO' },
  'manman': { name: '漫漫 278', name_cn: '漫漫 278色', brand: '漫漫' },
  'panpan': { name: '盼盼 285', name_cn: '盼盼 285色', brand: '盼盼' },
  'mixiaowo': { name: '咪小窝 286', name_cn: '咪小窝 286色', brand: '咪小窝' },
}

/** 缓存已加载的色卡数据 */
let cachedData: PaletteData | null = null

/** 缓存独立品牌色卡文件 */
const brandFileCache = new Map<string, { colors: PaletteColor[]; count: number }>()

/** 缓存各色卡的 Lab 预计算结果 */
const labCache = new Map<string, LabColor[]>()

/**
 * 加载色卡 JSON 文件
 * 首次调用时 fetch，后续从缓存返回
 */
export async function loadPaletteData(): Promise<PaletteData> {
  if (cachedData) return cachedData

  const res = await fetch(PALETTE_FILE)
  if (!res.ok) {
    throw new Error(`Failed to load palette data: ${res.status} ${res.statusText}`)
  }

  const data: PaletteData = await res.json()
  cachedData = data
  return data
}

/**
 * 加载独立品牌色卡文件（coco/manman/panpan/mixiaowo）
 */
async function loadBrandFile(brandId: string): Promise<{ colors: PaletteColor[]; count: number }> {
  const cached = brandFileCache.get(brandId)
  if (cached) return cached

  const filePath = BRAND_FILES[brandId]
  if (!filePath) throw new Error(`Unknown brand: ${brandId}`)

  const res = await fetch(filePath)
  if (!res.ok) {
    throw new Error(`Failed to load brand palette: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const colors: PaletteColor[] = (data.colors || []).map((c: { code: string; hex: string; rgb: number[] }) => ({
    code: c.code,
    name: c.code,  // 新品牌用色号作为名称
    hex: c.hex,
    rgb: c.rgb as [number, number, number],
  }))

  const result = { colors, count: colors.length }
  brandFileCache.set(brandId, result)
  return result
}

// ============================================================
// 公开接口
// ============================================================

/**
 * 获取所有色卡列表（不含颜色详情，用于 UI 下拉选择）
 * 包含 MARD 和所有新品牌
 */
export async function getPalettes(): Promise<Palette[]> {
  const data = await loadPaletteData()

  // 从主文件获取 MARD 色卡列表
  const mardPalettes = data.palettes

  // 构建所有品牌的色卡列表
  const allPalettes: Palette[] = [...mardPalettes]

  // 添加新品牌（从 BRAND_INFO 中获取，排除已在 mardPalettes 中的）
  for (const [id, info] of Object.entries(BRAND_INFO)) {
    if (id === 'mard-221') continue  // MARD 已在 mardPalettes 中
    allPalettes.push({
      id,
      name: info.name,
      name_cn: info.name_cn,
      brand: info.brand,
      bead_size: '5mm',
      recommended: false,
      description: `${info.name_cn}色卡`,
      colors: [],  // 列表不需要颜色详情
    })
  }

  return allPalettes
}

/**
 * 根据 ID 获取完整色卡（含颜色列表）
 */
export async function getPaletteById(id: string): Promise<Palette | null> {
  const data = await loadPaletteData()
  return data.palettes.find(p => p.id === id) || null
}

/**
 * 获取默认色卡 ID
 * 默认为 "quick-start"（来自 JSON 的 default_palette 字段）
 */
export async function getDefaultPaletteId(): Promise<string> {
  const data = await loadPaletteData()
  return data.default_palette || 'quick-start'
}

/**
 * 获取指定色卡的颜色列表
 * MARD 从主文件加载，新品牌从独立 JSON 文件加载
 */
export async function getColors(paletteId: string): Promise<PaletteColor[]> {
  // 新品牌：从独立文件加载
  if (BRAND_FILES[paletteId] && paletteId !== 'mard-221') {
    const { colors } = await loadBrandFile(paletteId)
    return colors
  }

  // MARD 及其他：从主文件加载
  const palette = await getPaletteById(paletteId)
  if (!palette) {
    throw new Error(`Palette not found: ${paletteId}`)
  }
  return palette.colors
}

/**
 * 获取指定色卡的 Lab 预计算颜色（带缓存）
 */
export async function getLabColors(paletteId: string): Promise<LabColor[]> {
  const cached = labCache.get(paletteId)
  if (cached) return cached

  const colors = await getColors(paletteId)
  const labColors = precomputeLabColors(colors)
  labCache.set(paletteId, labColors)
  return labColors
}

/**
 * 在指定色卡中查找最接近的颜色
 * @param rgb 目标 RGB
 * @param paletteId 色卡 ID
 * @returns 最接近的色卡颜色
 */
export async function findClosestColor(
  rgb: [number, number, number],
  paletteId: string
): Promise<PaletteColor> {
  const labColors = await getLabColors(paletteId)
  const result = findClosestLabColor(rgb, labColors)
  return {
    code: result.code,
    name: result.name,
    hex: result.hex,
    rgb: result.rgb
  }
}

/**
 * 在指定色卡中查找替换色推荐
 * 排除当前颜色后，按色差从小到大返回候选列表
 *
 * @param rgb 目标颜色的 RGB
 * @param paletteId 色卡 ID
 * @param excludeCode 要排除的色卡编号
 * @param availableCodes 用户拥有的颜色集合（可选，不传则从全部色卡中推荐）
 * @returns 按色差排序的推荐颜色数组（最多 5 个）
 */
export async function findReplacementColors(
  rgb: [number, number, number],
  paletteId: string,
  excludeCode: string,
  availableCodes?: Set<string>
): Promise<{ color: PaletteColor; deltaE: number; difference: 'low' | 'medium' | 'high' }[]> {
  const labColors = await getLabColors(paletteId)
  const targetLab = rgbToLab(rgb[0], rgb[1], rgb[2])

  const candidates = labColors.filter(c => {
    if (c.code === excludeCode) return false
    if (availableCodes && !availableCodes.has(c.code)) return false
    return true
  })

  const scored = candidates.map(c => ({
    color: { code: c.code, name: c.name, hex: c.hex, rgb: c.rgb } as PaletteColor,
    deltaE: deltaE2000(targetLab, c.lab),
    difference: getDifferenceLevel(deltaE2000(targetLab, c.lab))
  }))

  scored.sort((a, b) => a.deltaE - b.deltaE)
  return scored.slice(0, 5)
}

/**
 * 清除 Lab 缓存（切换色卡时可选调用）
 */
export function clearLabCache(paletteId?: string): void {
  if (paletteId) {
    labCache.delete(paletteId)
  } else {
    labCache.clear()
  }
}
