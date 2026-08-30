import { useState, useRef, type ReactNode } from 'react'
import type {
  Palette,
  PaletteColor,
  BeadSize,
  MatchMode,
  ColorStat,
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
type MobileTab = 'upload' | 'board' | 'color' | 'refine' | null

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
      <div className="flex-1 min-h-0 relative bg-paper">
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
        />

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
        {/* 展开面板区域 */}
        {activeTab && (
          <div className="max-h-[35vh] overflow-y-auto border-b border-paper-darker animate-fade-in">
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
              {activeTab === 'board' && (
                <BoardPanel
                  boardSizeId={boardSizeId}
                  onBoardSizeChange={onBoardSizeChange}
                  canvasWidth={canvasWidth}
                  canvasHeight={canvasHeight}
                  beadSize={beadSize}
                  onBeadSizeChange={onBeadSizeChange}
                />
              )}
              {activeTab === 'color' && (
                <ColorPanel
                  palettes={palettes}
                  currentPaletteId={currentPaletteId}
                  onPaletteChange={onPaletteChange}
                  matchMode={matchMode}
                  onMatchModeChange={onMatchModeChange}
                  maxColors={maxColors}
                  onMaxColorsChange={onMaxColorsChange}
                  colorCount={colorCount}
                  dither={dither}
                  onDitherChange={onDitherChange}
                  debugMode={debugMode}
                  onDebugModeChange={onDebugModeChange}
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
        <div className="flex gap-2 px-3 py-2 border-b border-paper-darker">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all min-h-[44px] ${
              canGenerate
                ? 'bg-ink text-white active:scale-[0.98]'
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
                ? 'bg-paper-darker text-ink active:scale-[0.98]'
                : 'bg-paper-darker text-ink-lightest'
            }`}
          >
            下载图纸
          </button>
        </div>

        {/* 底部工具栏 Tab */}
        <div className="flex items-center justify-around px-1 py-1">
          <TabButton
            label="上传图片"
            active={activeTab === 'upload'}
            onClick={() => handleTabClick('upload')}
          />
          <TabButton
            label="板型"
            active={activeTab === 'board'}
            onClick={() => handleTabClick('board')}
          />
          <TabButton
            label="颜色"
            active={activeTab === 'color'}
            onClick={() => handleTabClick('color')}
          />
          <TabButton
            label="精修"
            active={activeTab === 'refine'}
            onClick={() => handleTabClick('refine')}
            disabled={!displayResult}
          />
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
// Tab 按钮
// ============================================================
function TabButton({ label, active, onClick, disabled }: {
  label: string
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-colors min-h-[40px] ${
        disabled
          ? 'text-ink-lightest'
          : active
            ? 'text-ink bg-paper-darker'
            : 'text-ink-lighter active:bg-paper-darker/50'
      }`}
    >
      {label}
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

// ============================================================
// 板型面板
// ============================================================
function BoardPanel({
  boardSizeId,
  onBoardSizeChange,
  canvasWidth,
  canvasHeight,
  beadSize,
  onBeadSizeChange,
}: {
  boardSizeId: BoardSizeId
  onBoardSizeChange: (id: BoardSizeId) => void
  canvasWidth: number
  canvasHeight: number
  beadSize: BeadSize
  onBeadSizeChange: (val: BeadSize) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {BOARD_SIZES.map(board => (
          <button
            key={board.id}
            onClick={() => onBoardSizeChange(board.id)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg transition-all text-center min-w-[72px] ${
              boardSizeId === board.id
                ? 'bg-ink text-white'
                : 'bg-paper-darker text-ink-lighter'
            }`}
          >
            <div className="text-xs font-semibold">{board.name}</div>
            <div className={`text-[9px] mt-0.5 ${boardSizeId === board.id ? 'text-white/70' : 'text-ink-lightest'}`}>
              {board.width}×{board.height}
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-2 py-1.5 bg-paper-darker/50 rounded-md">
        <span className="text-[10px] text-ink-lighter">实际图纸:</span>
        <span className="text-xs font-semibold text-ink">{canvasWidth}×{canvasHeight}</span>
        <span className="ml-auto text-[10px] text-ink-lightest">
          ≈{(canvasWidth * 0.5).toFixed(0)}×{(canvasHeight * 0.5).toFixed(0)}cm
        </span>
      </div>

      <div className="flex gap-1.5">
        {([
          { value: 'mini' as const, label: 'Mini' },
          { value: 'standard' as const, label: 'Standard' },
          { value: 'large' as const, label: 'Large' }
        ]).map(opt => (
          <button
            key={opt.value}
            onClick={() => onBeadSizeChange(opt.value)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors min-h-[40px] ${
              beadSize === opt.value
                ? 'bg-ink text-white'
                : 'bg-paper-darker text-ink-lighter'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// 颜色面板
// ============================================================
function ColorPanel({
  palettes,
  currentPaletteId,
  onPaletteChange,
  matchMode,
  onMatchModeChange,
  maxColors,
  onMaxColorsChange,
  colorCount,
  dither,
  onDitherChange,
  debugMode,
  onDebugModeChange,
}: {
  palettes: Palette[]
  currentPaletteId: string
  onPaletteChange: (id: string) => void
  matchMode: MatchMode
  onMatchModeChange: (val: MatchMode) => void
  maxColors: number
  onMaxColorsChange: (val: number) => void
  colorCount: number
  dither: boolean
  onDitherChange: (val: boolean) => void
  debugMode: boolean
  onDebugModeChange: (val: boolean) => void
}) {
  const currentPalette = palettes.find(p => p.id === currentPaletteId)

  return (
    <div className="space-y-3">
      {/* 色卡选择 */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-ink-lighter">当前色卡</label>
        <select
          value={currentPaletteId}
          onChange={e => onPaletteChange(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-paper-darker rounded-lg bg-paper-light focus:border-ink focus:outline-none min-h-[44px]"
        >
          {palettes.map(p => (
            <option key={p.id} value={p.id}>
              {p.name_cn || p.name}
            </option>
          ))}
        </select>
        {currentPalette && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ink-lighter">品牌:</span>
            <span className="text-[10px] font-medium text-ink">{currentPalette.brand}</span>
          </div>
        )}
      </div>

      {/* 匹配模式 */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-ink-lighter">颜色匹配</label>
        <div className="flex gap-1.5">
          <button
            onClick={() => onMatchModeChange('standard')}
            className={`flex-1 py-2.5 text-xs font-medium rounded-lg transition-colors min-h-[44px] ${
              matchMode === 'standard' ? 'bg-ink text-white' : 'bg-paper-darker text-ink-lighter'
            }`}
          >
            标准
          </button>
          <button
            onClick={() => onMatchModeChange('limited')}
            className={`flex-1 py-2.5 text-xs font-medium rounded-lg transition-colors min-h-[44px] ${
              matchMode === 'limited' ? 'bg-ink text-white' : 'bg-paper-darker text-ink-lighter'
            }`}
          >
            限定颜色数
          </button>
        </div>
      </div>

      {/* 限定颜色数滑杆 */}
      {matchMode === 'limited' && (
        <div className="space-y-1.5 px-1">
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
            className="w-full mobile-slider"
          />
        </div>
      )}

      {/* 抖动开关 */}
      <button
        onClick={() => onDitherChange(!dither)}
        className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-paper-darker/50 active:bg-paper-darker transition-colors min-h-[48px]"
      >
        <div className="flex flex-col items-start">
          <span className="text-xs font-medium text-ink-lighter">抖动 (Dither)</span>
          <span className="text-[10px] text-ink-lightest">受控有序抖动，仅限渐变区域</span>
        </div>
        <div className={`w-11 h-6 rounded-full transition-colors flex items-center ${dither ? 'bg-ink' : 'bg-paper-darker'}`}>
          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${dither ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </button>

      {/* 调试模式 */}
      <button
        onClick={() => onDebugModeChange(!debugMode)}
        className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-paper-darker/50 active:bg-paper-darker transition-colors min-h-[48px]"
      >
        <div className="flex flex-col items-start">
          <span className="text-xs font-medium text-ink-lighter">调试模式 (Debug)</span>
          <span className="text-[10px] text-ink-lightest">显示每格原始色→匹配色→Delta E</span>
        </div>
        <div className={`w-11 h-6 rounded-full transition-colors flex items-center ${debugMode ? 'bg-ink' : 'bg-paper-darker'}`}>
          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${debugMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </button>
    </div>
  )
}
