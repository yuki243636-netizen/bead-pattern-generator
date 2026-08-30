import { useState } from 'react'
import type {
  Palette,
  PaletteColor,
  BeadSize,
  MatchMode,
  RefineMode,
  GenerateResult,
} from '../types'
import { BOARD_SIZES, type BoardSizeId } from './SettingsPanel'
import PatternCanvas from './PatternCanvas'
import ImageUploader from './ImageUploader'
import RefinePanel from './RefinePanel'
import DownloadPanel from './DownloadPanel'
import type { QuantizationResult, DebugCellInfo } from '../utils/colorQuantization'

// ============================================================
// 移动端底部工具栏 Tab 类型
// ============================================================
type MobileTab = 'upload' | 'refine' | null

// ============================================================
// MobileLayout Props — 复用 App.tsx 全部状态
// ============================================================
interface MobileLayoutProps {
  // 色卡
  palettes: Palette[]
  currentPaletteId: string
  onPaletteChange: (id: string) => void
  colors: PaletteColor[]
  colorMap: Map<string, PaletteColor>

  // 图片
  imagePreview: string | null
  imageDimensions: { width: number; height: number } | null
  fileSize: number
  onImageUpload: (file: File) => void
  onImageRemove: () => void

  // 画板
  boardSizeId: BoardSizeId
  onBoardSizeChange: (id: BoardSizeId) => void
  canvasWidth: number
  canvasHeight: number
  beadSize: BeadSize
  onBeadSizeChange: (val: BeadSize) => void

  // 颜色匹配
  matchMode: MatchMode
  onMatchModeChange: (val: MatchMode) => void
  maxColors: number
  onMaxColorsChange: (val: number) => void
  dither: boolean
  onDitherChange: (val: boolean) => void
  debugMode: boolean
  onDebugModeChange: (val: boolean) => void

  // 生成
  onGenerate: () => void
  canGenerate: boolean

  // 结果
  displayResult: GenerateResult | null
  result: GenerateResult | null
  loading: boolean
  loadingStep: string
  error: string | null
  setError: (val: string | null) => void

  // 显示
  showCoordinates: boolean
  showLegend: boolean
  zoom: number
  pan: { x: number; y: number }
  onZoomChange: (zoom: number) => void
  onPanChange: (pan: { x: number; y: number }) => void
  onShowCoordinatesChange: (val: boolean) => void
  onShowLegendChange: (val: boolean) => void

  // 撤销
  onUndo: () => void
  canUndo: boolean

  // 下载
  onDownload: (options: import('../types').DownloadOptions) => void

  // 精修
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
  onResetView: () => void
  onRestoreOriginal: () => void
  canRestoreOriginal: boolean
  canRedo: boolean
  onRefineUndo: () => void
  onRefineRedo: () => void
  resetViewSignal: number

  // Debug
  debugGrid: DebugCellInfo[][] | undefined
}

export default function MobileLayout(props: MobileLayoutProps) {
  const {
    palettes,
    currentPaletteId,
    onPaletteChange,
    colors,
    colorMap,
    imagePreview,
    imageDimensions,
    fileSize,
    onImageUpload,
    onImageRemove,
    boardSizeId,
    onBoardSizeChange,
    canvasWidth,
    canvasHeight,
    beadSize,
    onBeadSizeChange,
    matchMode,
    onMatchModeChange,
    maxColors,
    onMaxColorsChange,
    dither,
    onDitherChange,
    debugMode,
    onDebugModeChange,
    onGenerate,
    canGenerate,
    displayResult,
    result,
    loading,
    loadingStep,
    error,
    setError,
    showCoordinates,
    showLegend,
    zoom,
    pan,
    onZoomChange,
    onPanChange,
    onShowCoordinatesChange,
    onShowLegendChange,
    onUndo,
    canUndo,
    onDownload,
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
    onResetView,
    onRestoreOriginal,
    canRestoreOriginal,
    canRedo,
    onRefineUndo,
    onRefineRedo,
    resetViewSignal,
    debugGrid,
  } = props

  const [activeTab, setActiveTab] = useState<MobileTab>(null)
  const [showDownload, setShowDownload] = useState(false)

  const currentPalette = palettes.find(p => p.id === currentPaletteId)
  const colorCount = colors.length || currentPalette?.colors.length || 0

  const handleTabClick = (tab: MobileTab) => {
    setActiveTab(prev => prev === tab ? null : tab)
  }

  const handleGenerate = () => {
    onGenerate()
    setActiveTab(null)
  }

  return (
    <div className="h-[100dvh] bg-paper flex flex-col overflow-hidden">
      {/* ===== 顶部导航栏 ===== */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-paper-darker bg-paper-light flex-shrink-0 safe-area-top">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold text-ink">甘薯么拼豆</h1>
        </div>

        <div className="flex items-center gap-2">
          {displayResult && (
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-ink">{displayResult.totalBeads.toLocaleString()}</span>
              <span className="text-[9px] text-ink-lighter">颗</span>
              <span className="text-sm font-bold text-ink ml-1">{displayResult.stats.length}</span>
              <span className="text-[9px] text-ink-lighter">色</span>
            </div>
          )}
        </div>
      </header>

      {/* ===== 画板区域（占 55-65% 高度）===== */}
      <div className="flex-1 min-h-0 relative bg-paper flex flex-col">
        <PatternCanvas
          result={displayResult}
          colorMap={colorMap}
          beadSize={beadSize}
          showCoordinates={showCoordinates}
          showLegend={showLegend}
          zoom={zoom}
          pan={pan}
          onZoomChange={onZoomChange}
          onPanChange={onPanChange}
          onShowCoordinatesChange={onShowCoordinatesChange}
          onShowLegendChange={onShowLegendChange}
          onUndo={onUndo}
          canUndo={canUndo}
          imagePreview={imagePreview}
          onGenerate={onGenerate}
          canGenerate={canGenerate}
          debugMode={debugMode}
          debugGrid={debugGrid}
          mapping={(result as QuantizationResult)?.mapping}
          foregroundBBox={(result as QuantizationResult)?.foregroundBBox}
          edgeInfo={(result as QuantizationResult)?.edgeInfo}
          edgeCellCount={(result as QuantizationResult)?.edgeCellCount}
          refineMode={refineMode}
          highlightCode={highlightCode}
          onCellClick={(x, y) => {
            if (refineMode === 'pixelEdit' && brushColor) {
              onPixelEdit(x, y, brushColor)
            } else if (refineMode === 'pixelEdit') {
              onToggleCell(x, y)
            }
          }}
          onCellDrag={(x, y) => {
            if (refineMode === 'pixelEdit' && brushColor) {
              onPixelEdit(x, y, brushColor)
            } else if (refineMode === 'pixelEdit') {
              onAddToSelection(x, y)
            }
          }}
          selectedCells={selectedCells}
          brushColor={brushColor}
          resetViewSignal={resetViewSignal}
          isMobile
        />

        {/* 移动端浮动坐标/图例切换 — 左上角小按钮 */}
        {displayResult && (
          <div className="absolute top-2 left-2 flex gap-1 z-10">
            <button
              onClick={() => onShowCoordinatesChange(!showCoordinates)}
              className={`px-2.5 h-7 rounded-lg text-[10px] font-medium border backdrop-blur-sm transition-colors ${
                showCoordinates
                  ? 'bg-ink text-white border-ink'
                  : 'bg-paper-light/90 text-ink-lighter border-paper-darker'
              }`}
            >
              坐标
            </button>
            <button
              onClick={() => onShowLegendChange(!showLegend)}
              className={`px-2.5 h-7 rounded-lg text-[10px] font-medium border backdrop-blur-sm transition-colors ${
                showLegend
                  ? 'bg-ink text-white border-ink'
                  : 'bg-paper-light/90 text-ink-lighter border-paper-darker'
              }`}
            >
              图例
            </button>
            {canUndo && (
              <button
                onClick={onUndo}
                className="w-7 h-7 rounded-lg bg-paper-light/90 backdrop-blur-sm border border-paper-darker flex items-center justify-center text-ink-lighter active:scale-90 transition-transform"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* 空状态遮罩 — 没有图片时显示 */}
        {!imagePreview && !displayResult && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-paper/80 backdrop-blur-sm pointer-events-none">
            <div className="w-16 h-16 rounded-2xl bg-ink/5 flex items-center justify-center mb-4">
              <svg className="text-ink-lighter" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <p className="text-base font-semibold text-ink mb-1">开始制作</p>
            <p className="text-xs text-ink-lighter mb-4">上传一张图片生成拼豆图纸</p>
            <button
              onClick={() => setActiveTab('upload')}
              className="pointer-events-auto px-6 py-2.5 text-sm font-medium text-white bg-ink rounded-xl shadow-soft active:scale-95 transition-transform"
            >
              ＋ 上传图片
            </button>
          </div>
        )}
      </div>

      {/* ===== 底部操作区 ===== */}
      <div className="flex-shrink-0 bg-paper-light border-t border-paper-darker safe-area-bottom">
        {/* 板型 — 始终展示 */}
        <div className="px-3 py-1.5 border-b border-paper-darker">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-ink-lighter flex-shrink-0 w-6">板型</span>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
              {BOARD_SIZES.map(board => (
                <button
                  key={board.id}
                  onClick={() => onBoardSizeChange(board.id)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-md transition-all text-center min-w-[56px] ${
                    boardSizeId === board.id
                      ? 'bg-ink text-white'
                      : 'bg-paper-darker text-ink-lighter'
                  }`}
                >
                  <div className="text-[11px] font-semibold leading-tight">{board.name}</div>
                  <div className={`text-[8px] leading-tight ${boardSizeId === board.id ? 'text-white/70' : 'text-ink-lightest'}`}>
                    {board.width}×{board.height}
                  </div>
                </button>
              ))}
            </div>
            {/* 豆子大小 — 紧凑选择 */}
            <div className="flex gap-0.5 flex-shrink-0">
              {([
                { value: 'mini' as const, label: 'M' },
                { value: 'standard' as const, label: 'S' },
                { value: 'large' as const, label: 'L' }
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onBeadSizeChange(opt.value)}
                  className={`w-6 h-6 text-[9px] font-bold rounded transition-colors ${
                    beadSize === opt.value ? 'bg-ink text-white' : 'bg-paper-darker text-ink-lighter'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[8px] text-ink-lightest">实际 {canvasWidth}×{canvasHeight} · ≈{(canvasWidth * 0.5).toFixed(0)}×{(canvasHeight * 0.5).toFixed(0)}cm</span>
          </div>
        </div>

        {/* 色卡 — 始终展示 */}
        <div className="px-3 py-1.5 border-b border-paper-darker">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-ink-lighter flex-shrink-0 w-6">色卡</span>
            <select
              value={currentPaletteId}
              onChange={e => onPaletteChange(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-paper-darker rounded-md bg-paper-light focus:border-ink focus:outline-none min-h-[32px]"
            >
              {palettes.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name_cn || p.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => onMatchModeChange(matchMode === 'standard' ? 'limited' : 'standard')}
              className={`px-2.5 py-1.5 text-[10px] font-medium rounded-md transition-colors flex-shrink-0 min-h-[32px] ${
                matchMode === 'limited' ? 'bg-ink text-white' : 'bg-paper-darker text-ink-lighter'
              }`}
            >
              {matchMode === 'limited' ? `限${maxColors}色` : '标准'}
            </button>
            <button
              onClick={() => onDitherChange(!dither)}
              className={`px-2 py-1.5 text-[9px] font-medium rounded-md transition-colors flex-shrink-0 min-h-[32px] ${
                dither ? 'bg-ink text-white' : 'bg-paper-darker text-ink-lighter'
              }`}
            >
              抖动
            </button>
            <button
              onClick={() => onDebugModeChange(!debugMode)}
              className={`px-2 py-1.5 text-[9px] font-medium rounded-md transition-colors flex-shrink-0 min-h-[32px] ${
                debugMode ? 'bg-ink text-white' : 'bg-paper-darker text-ink-lighter'
              }`}
            >
              调试
            </button>
          </div>
          {matchMode === 'limited' && (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min={2}
                max={Math.min(48, colorCount)}
                value={maxColors}
                onChange={e => onMaxColorsChange(Number(e.target.value))}
                className="flex-1 mobile-slider h-1"
              />
              <span className="text-[10px] font-semibold text-ink w-6 text-right">{maxColors}</span>
            </div>
          )}
        </div>

        {/* Tab: 图片 / 精修 */}
        <div className="flex items-stretch border-b border-paper-darker">
          <FlowTabButton
            label="图片"
            active={activeTab === 'upload'}
            onClick={() => handleTabClick('upload')}
          />
          <FlowTabButton
            label="精修"
            active={activeTab === 'refine'}
            onClick={() => handleTabClick('refine')}
            disabled={!displayResult}
            highlight
          />
        </div>

        {/* 展开面板区域 */}
        {activeTab && (
          <div className="max-h-[22vh] overflow-y-auto border-b border-paper-darker animate-fade-in">
            <div className="p-3">
              {activeTab === 'upload' && (
                <UploadPanel
                  imagePreview={imagePreview}
                  imageDimensions={imageDimensions}
                  fileSize={fileSize}
                  onImageUpload={onImageUpload}
                  onImageRemove={onImageRemove}
                  hasResult={!!displayResult}
                />
              )}
              {activeTab === 'refine' && displayResult && (
                <RefinePanel
                  stats={displayResult.stats}
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
                  onUndo={onRefineUndo}
                  onRedo={onRefineRedo}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onResetView={onResetView}
                  onRestoreOriginal={onRestoreOriginal}
                  canRestoreOriginal={canRestoreOriginal}
                />
              )}
            </div>
          </div>
        )}

        {/* 底部核心操作按钮 */}
        <div className="flex gap-2 px-3 py-2">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all min-h-[44px] ${
              canGenerate
                ? 'bg-paper-darker text-ink active:scale-[0.98]'
                : 'bg-paper-darker text-ink-lightest'
            }`}
          >
            重新生成
          </button>
          <button
            onClick={() => displayResult && setShowDownload(true)}
            disabled={!displayResult}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all min-h-[44px] ${
              displayResult
                ? 'bg-ink text-white active:scale-[0.98]'
                : 'bg-paper-darker text-ink-lightest'
            }`}
          >
            下载图纸
          </button>
        </div>
      </div>

      {/* ===== 弹窗 ===== */}
      {showDownload && displayResult && (
        <DownloadPanel
          onDownload={(opts) => { onDownload(opts); setShowDownload(false) }}
          onClose={() => setShowDownload(false)}
        />
      )}

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-paper-light rounded-2xl px-6 py-5 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-ink font-medium">{loadingStep || '处理中...'}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500 text-white text-sm rounded-lg shadow-lg z-50 animate-fade-in max-w-[90vw]">
          {error}
          <button onClick={() => setError(null)} className="ml-2 opacity-70">×</button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 底部 Tab 按钮 — 简洁文字标签
// ============================================================
function FlowTabButton({ label, active, onClick, disabled, highlight }: {
  label: string
  step?: number
  active: boolean
  onClick: () => void
  disabled?: boolean
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex items-center justify-center py-1.5 transition-colors min-h-[44px] ${
        disabled
          ? 'text-ink-lightest'
          : active
            ? highlight
              ? 'text-ink bg-amber-50'
              : 'text-ink bg-paper-darker'
            : highlight
              ? 'text-amber-600 active:bg-paper-darker/50'
              : 'text-ink-lighter active:bg-paper-darker/50'
      }`}
    >
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  )
}

// ============================================================
// 上传面板
// ============================================================
function UploadPanel({
  imagePreview,
  imageDimensions,
  fileSize,
  onImageUpload,
  onImageRemove,
  hasResult,
}: {
  imagePreview: string | null
  imageDimensions: { width: number; height: number } | null
  fileSize: number
  onImageUpload: (file: File) => void
  onImageRemove: () => void
  hasResult: boolean
}) {
  return (
    <div className="space-y-2">
      <ImageUploader
        onUpload={onImageUpload}
        imagePreview={imagePreview}
        imageDimensions={imageDimensions}
        fileSize={fileSize}
        onRemove={onImageRemove}
      />
      {hasResult && (
        <p className="text-[10px] text-ink-lightest text-center">
          重新上传后将需要重新生成图纸
        </p>
      )}
    </div>
  )
}


