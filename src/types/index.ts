// ============================================================
// 核心类型定义 — 色卡数据结构
// 所有颜色数据来自 /public/data/palettes/bead-palettes.json
// 禁止在组件中硬编码任何色号、HEX 或 RGB 数据
// ============================================================

/** 单个色卡颜色 */
export interface PaletteColor {
  /** 色卡编号，如 "Q01"、"M01"、"S01" */
  code: string;
  /** 颜色名称（中文），来自 JSON */
  name: string;
  /** HEX 颜色值，仅作屏幕显示参考 */
  hex: string;
  /** RGB 数组 [r, g, b]，仅作数字颜色匹配参考 */
  rgb: [number, number, number];
}

/** 一个完整的色卡 */
export interface Palette {
  /** 色卡唯一 ID，如 "quick-start"、"mard-221" */
  id: string;
  /** 色卡显示名称（英文） */
  name: string;
  /** 色卡中文名称 */
  name_cn: string;
  /** 品牌 */
  brand: string;
  /** 拼豆尺寸 */
  bead_size: string;
  /** 是否推荐 */
  recommended: boolean;
  /** 描述 */
  description: string;
  /** 颜色列表 */
  colors: PaletteColor[];
}

/** 色卡数据根结构 */
export interface PaletteData {
  schema_version: string;
  name: string;
  description: string;
  default_palette: string;
  notes: string[];
  palettes: Palette[];
}

// ============================================================
// 图纸与业务类型
// ============================================================

/** 拼豆尺寸选项 */
export type BeadSize = 'mini' | 'standard' | 'large';

/** 颜色匹配模式 */
export type MatchMode = 'standard' | 'limited';

/**
 * 图纸显示模式
 * - effect: 效果图（圆形拼豆，模拟成品效果）
 * - blueprint: 图纸模式（方格 + 网格线 + 坐标 + 颜色编号）
 */
export type DisplayMode = 'effect' | 'blueprint';

/** 图纸网格单元格：存储匹配到的色卡编号，null 表示空 */
export type GridCell = string | null;

/** 二维图纸网格 */
export type PatternGrid = GridCell[][];

/** 颜色统计项 */
export interface ColorStat {
  code: string;
  name: string;
  hex: string;
  rgb: [number, number, number];
  count: number;
  percentage: number;
}

/** 颜色替换建议 */
export interface ReplacementSuggestion {
  originalCode: string;
  originalName: string;
  originalHex: string;
  originalRgb: [number, number, number];
  originalCount: number;
  recommendedCode: string;
  recommendedName: string;
  recommendedHex: string;
  recommendedRgb: [number, number, number];
  deltaE: number;
  /** 色差级别：low / medium / high */
  difference: 'low' | 'medium' | 'high';
}

/** 生成图纸参数 */
export interface GenerateParams {
  image: HTMLImageElement;
  canvasWidth: number;
  canvasHeight: number;
  beadSize: BeadSize;
  paletteId: string;
  matchMode: MatchMode;
  maxColors: number;
}

/** 生成图纸结果 */
export interface GenerateResult {
  grid: PatternGrid;
  stats: ColorStat[];
  totalBeads: number;
  usedColors: PaletteColor[];
}

/** 加载步骤 */
export interface LoadingStep {
  label: string;
  status: 'pending' | 'active' | 'done';
}

/** 下载选项 */
export interface DownloadOptions {
  format: 'png' | 'pdf';
  includeGrid: boolean;
  includeCoordinates: boolean;
  includeColorLegend: boolean;
  includeBeadCount: boolean;
}

/** App 全局设置 */
export interface AppSettings {
  canvasWidth: number;
  canvasHeight: number;
  lockRatio: boolean;
  beadSize: BeadSize;
  paletteId: string;
  matchMode: MatchMode;
  maxColors: number;
  displayMode: DisplayMode;
  showGrid: boolean;
  showCoordinates: boolean;
}

// ============================================================
// 精修模块类型
// ============================================================

/** 精修模式 */
export type RefineMode = 'none' | 'colorReplace' | 'pixelEdit'

/** 精修操作历史记录项 */
export interface RefineHistoryEntry {
  grid: PatternGrid
  stats: ColorStat[]
  totalBeads: number
  label: string
}
