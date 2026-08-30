import type { ReactNode } from 'react'
import type { Palette, BeadSize, MatchMode, ColorStat, ReplacementSuggestion, RefineMode, PaletteColor } from '../types'
import ImageUploader from './ImageUploader'
import ColorReplacement from './ColorReplacement'
import RefinePanel from './RefinePanel'

// ============================================================
// 拼豆板尺寸预设
// ============================================================
export const BOARD_SIZES = [
  { id: 'small', name: '小板', width: 52, height: 52, desc: '约2500颗', icon: '◆' },
  { id: 'medium', name: '中板', width: 78, height: 78, desc: '约4900颗', icon: '◆◆' },
  { id: 'large', name: '大板', width: 104, height: 104, desc: '约10000颗', icon: '◆◆◆' },
  { id: 'xlarge', name: '超大板', width: 120, height: 120, desc: '约14400颗', icon: '◆◆◆◆' },
  { id: 'long', name: '长板', width: 52, height: 104, desc: '约5400颗', icon: '▬' },
] as const

export type BoardSizeId = typeof BOARD_SIZES[number]['id']

interface SettingsPanelProps {
  palettes: Palette[]
  currentPaletteId: string
  onPaletteChange: (id: string) => void
  imagePreview: string | null
  imageDimensions: { width: number; height: number } | null
  fileSize: number
  canvasWidth: number
  canvasHeight: number
  boardSizeId: BoardSizeId
  onBoardSizeChange: (board: BoardSizeId) => void
  beadSize: BeadSize
  matchMode: MatchMode
  maxColors: number
  onBeadSizeChange: (val: BeadSize) => void
  onMatchModeChange: (val: MatchMode) => void
  onMaxColorsChange: (val: number) => void
  dither: boolean
  onDitherChange: (val: boolean) => void
  debugMode: boolean
  onDebugModeChange: (val: boolean) => void
  onImageUpload: (file: File) => void
  onImageRemove: () => void
  onGenerate: () => void
  canGenerate: boolean
  isMobile?: boolean
  hasResult: boolean
  resultStats: ColorStat[]
  displayTotalBeads: number
  colors: PaletteColor[]
  colorMap: Map<string, PaletteColor>
  // 精修模块
  refineMode: RefineMode
  onRefineModeChange: (mode: RefineMode) => void
  highlightCode: string | null
  onHighlightCodeChange: (code: string | null) => void
  onColorReplace: (oldCode: string, newCode: string) => void
  onPixelEdit: (x: number, y: number, newCode: string) => void
  onBatchPixelEdit: (cells: { x: number; y: number }[], newCode: string) => void
  selectedCells: Set<string>
  onToggleCell: (x: number, y: number) => void
  onAddToSelection: (x: number, y: number) => void
  onClearSelection: () => void
  brushColor: string | null
  onBrushColorChange: (code: string | null) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onResetView: () => void
  onRestoreOriginal: () => void
  canRestoreOriginal: boolean
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-xs font-semibold text-ink-lighter uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

export default function SettingsPanel(props: SettingsPanelProps) {
  const {
    palettes,
    currentPaletteId,
    onPaletteChange,
    imagePreview,
    imageDimensions,
    fileSize,
    canvasWidth,
    canvasHeight,
    boardSizeId,
    onBoardSizeChange,
    beadSize,
    matchMode,
    maxColors,
    onBeadSizeChange,
    onMatchModeChange,
    onMaxColorsChange,
    dither,
    onDitherChange,
    debugMode,
    onDebugModeChange,
    onImageUpload,
    onImageRemove,
    onGenerate,
    canGenerate,
    isMobile,
    hasResult,
    resultStats,
    displayTotalBeads,
    colors,
    colorMap,
    refineMode,
    onRefineModeChange,
    highlightCode,
    onHighlightCodeChange,
    onColorReplace,
    onPixelEdit,
    onBatchPixelEdit,
    selectedCells,
    onToggleCell,
    onAddToSelection,
    onClearSelection,
    brushColor,
    onBrushColorChange,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onResetView,
    onRestoreOriginal,
    canRestoreOriginal,
  } = props

  const currentPalette = palettes.find(p => p.id === currentPaletteId)
  const colorCount = colors.length || currentPalette?.colors.length || 0
  const currentBoard = BOARD_SIZES.find(b => b.id === boardSizeId) || BOARD_SIZES[0]

  return (
    <div className={`space-y-5 ${isMobile ? '' : 'p-4'}`}>
      {/* 图片上传 */}
      <Section title="参考图片">
        <ImageUploader
          onUpload={onImageUpload}
          imagePreview={imagePreview}
          imageDimensions={imageDimensions}
          fileSize={fileSize}
          onRemove={onImageRemove}
        />
      </Section>

      {/* 拼豆板尺寸 */}
      <Section title="拼豆板尺寸">
        <div className="space-y-2">
          {/* 板型选择按钮 */}
          <div className="grid grid-cols-2 gap-1.5">
            {BOARD_SIZES.map(board => (
              <button
                key={board.id}
                onClick={() => onBoardSizeChange(board.id)}
                className={`px-2.5 py-2 rounded-lg transition-all text-left ${
                  boardSizeId === board.id
                    ? 'bg-ink text-white'
                    : 'bg-paper-darker text-ink-lighter hover:bg-paper-dark'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{board.name}</span>
                  <span className={`text-[9px] ${boardSizeId === board.id ? 'text-white/70' : 'text-ink-lightest'}`}>
                    {board.width}×{board.height}
                  </span>
                </div>
                <div className={`text-[9px] mt-0.5 ${boardSizeId === board.id ? 'text-white/60' : 'text-ink-lightest'}`}>
                  {board.desc}
                </div>
              </button>
            ))}
          </div>

          {/* 当前尺寸信息 */}
          <div className="flex items-center gap-2 px-2 py-1.5 bg-paper-darker/50 rounded-md">
            <span className="text-[10px] text-ink-lighter">实际图纸:</span>
            <span className="text-xs font-semibold text-ink">{canvasWidth}×{canvasHeight}</span>
            <span className="text-[10px] text-ink-lightest">格</span>
            <span className="ml-auto text-[10px] text-ink-lightest">
              ≈{(canvasWidth * 0.5).toFixed(0)}×{(canvasHeight * 0.5).toFixed(0)}cm
            </span>
          </div>
        </div>
      </Section>

      {/* 拼豆尺寸 */}
      <Section title="拼豆尺寸">
        <div className="flex gap-1.5">
          {([
            { value: 'mini' as const, label: 'Mini' },
            { value: 'standard' as const, label: 'Standard' },
            { value: 'large' as const, label: 'Large' }
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => onBeadSizeChange(opt.value)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                beadSize === opt.value
                  ? 'bg-ink text-white'
                  : 'bg-paper-darker text-ink-lighter hover:bg-paper-dark'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      {/* 色卡选择 */}
      <Section title="色卡">
        <div className="space-y-2">
          <select
            value={currentPaletteId}
            onChange={e => onPaletteChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-paper-darker rounded-lg bg-paper-light focus:border-ink focus:outline-none cursor-pointer"
          >
            {palettes.map(p => (
              <option key={p.id} value={p.id}>
                {p.name_cn || p.name}
              </option>
            ))}
          </select>
          {currentPalette && (
            <>
              <p className="text-[10px] text-ink-lightest leading-relaxed">
                {currentPalette.description || `${currentPalette.brand} 色卡`}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-ink-lighter">品牌:</span>
                <span className="text-[10px] font-medium text-ink">{currentPalette.brand}</span>
              </div>
            </>
          )}
        </div>
      </Section>

      {/* 颜色匹配 */}
      <Section title="颜色匹配">
        <div className="space-y-2.5">
          <div className="flex gap-1.5">
            <button
              onClick={() => onMatchModeChange('standard')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                matchMode === 'standard'
                  ? 'bg-ink text-white'
                  : 'bg-paper-darker text-ink-lighter hover:bg-paper-dark'
              }`}
            >
              标准
            </button>
            <button
              onClick={() => onMatchModeChange('limited')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                matchMode === 'limited'
                  ? 'bg-ink text-white'
                  : 'bg-paper-darker text-ink-lighter hover:bg-paper-dark'
              }`}
            >
              限定颜色数
            </button>
          </div>

          {matchMode === 'limited' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-ink-lighter">最大颜色数</label>
                <span className="text-sm font-semibold text-ink">{maxColors}</span>
              </div>
              <input
                type="range"
                min={2}
                max={Math.min(48, colorCount)}
                value={maxColors}
                onChange={e => onMaxColorsChange(Number(e.target.value))}
                className="w-full"
              />
            </div>
          )}
          <p className="text-[10px] text-ink-lightest">
            {matchMode === 'standard'
              ? '自动匹配色卡中最接近的颜色'
              : '从色卡中选取用量最高的 N 种颜色'}
          </p>

          {/* 抖动开关 */}
          <button
            onClick={() => onDitherChange(!dither)}
            className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-paper-darker/50 hover:bg-paper-darker transition-colors"
          >
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium text-ink-lighter">抖动 (Dither)</span>
              <span className="text-[10px] text-ink-lightest">受控有序抖动，仅限渐变区域</span>
            </div>
            <div className={`w-9 h-5 rounded-full transition-colors flex items-center ${dither ? 'bg-ink' : 'bg-paper-darker'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${dither ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </button>

          {/* 调试模式开关 */}
          <button
            onClick={() => onDebugModeChange(!debugMode)}
            className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-paper-darker/50 hover:bg-paper-darker transition-colors"
          >
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium text-ink-lighter">调试模式 (Debug)</span>
              <span className="text-[10px] text-ink-lightest">显示每格原始色→匹配色→Delta E</span>
            </div>
            <div className={`w-9 h-5 rounded-full transition-colors flex items-center ${debugMode ? 'bg-ink' : 'bg-paper-darker'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${debugMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </button>
        </div>
      </Section>

      {/* 生成按钮 */}
      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        className={`w-full py-2.5 text-sm font-semibold rounded-xl transition-all ${
          canGenerate
            ? 'bg-ink text-white hover:bg-ink-light shadow-soft'
            : 'bg-paper-darker text-ink-lightest cursor-not-allowed'
        }`}
      >
        生成图纸
      </button>

      {/* 精修模块 — 仅生成后显示 */}
      {hasResult && (
        <RefinePanel
          stats={resultStats}
          colors={colors}
          colorMap={colorMap}
          currentPaletteId={currentPaletteId}
          refineMode={refineMode}
          onRefineModeChange={onRefineModeChange}
          highlightCode={highlightCode}
          onHighlightCodeChange={onHighlightCodeChange}
          onColorReplace={onColorReplace}
          onPixelEdit={onPixelEdit}
          onBatchPixelEdit={onBatchPixelEdit}
          selectedCells={selectedCells}
          onToggleCell={onToggleCell}
          onAddToSelection={onAddToSelection}
          onClearSelection={onClearSelection}
          brushColor={brushColor}
          onBrushColorChange={onBrushColorChange}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onResetView={onResetView}
          onRestoreOriginal={onRestoreOriginal}
          canRestoreOriginal={canRestoreOriginal}
        />
      )}
    </div>
  )
}
