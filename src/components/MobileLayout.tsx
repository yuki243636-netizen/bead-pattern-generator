import { useState } from 'react'
import type {
  Palette,
  PaletteColor,
  MatchMode,
  RefineMode,
  GenerateResult,
} from '../types'
import { BOARD_SIZES, type BoardSizeId } from './SettingsPanel'
import PatternCanvas from './PatternCanvas'
import ImageUploader from './ImageUploader'
import RefinePanel from './RefinePanel'
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
      <header className="flex items-center justify-between px-4 py-3 bg-paper-light flex-shrink-0 safe-area-top shadow-soft">
        <div className="flex items-center gap-2.5">
          <img
            src="/icon-192.png?v=2"
            alt="logo"
            className="w-8 h-8 rounded-xl flex-shrink-0 shadow-soft"
            style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
          />
          <h1 className="text-base font-semibold text-ink">甘薯么拼豆</h1>
        </div>

        <div className="flex items-center gap-2">
          {displayResult && (
            <div className="flex items-baseline gap-1 px-3 py-1.5 bg-paper rounded-full">
              <span className="text-sm font-bold text-ink">{displayResult.totalBeads.toLocaleString()}</span>
              <span className="text-[10px] text-ink-lighter">颗</span>
              <span className="text-sm font-bold text-ink ml-1.5">{displayResult.stats.length}</span>
              <span className="text-[10px] text-ink-lighter">色</span>
            </div>
          )}
        </div>
      </header>

      {/* ===== 画板区域 ===== */}
      <div className="flex-1 min-h-0 relative bg-paper flex flex-col">
        <PatternCanvas
          result={displayResult}
          colorMap={colorMap}
          beadSize="standard"
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

        {/* 移动端浮动坐标/图例切换 */}
        {displayResult && (
          <div className="absolute top-3 left-3 flex gap-1.5 z-10">
            <button
              onClick={() => onShowCoordinatesChange(!showCoordinates)}
              className={`px-3 h-8 rounded-full text-[11px] font-medium backdrop-blur-md transition-all shadow-soft ${
                showCoordinates
                  ? 'bg-accent-teal text-white'
                  : 'bg-paper-light/90 text-ink-lighter'
              }`}
            >
              坐标
            </button>
            <button
              onClick={() => onShowLegendChange(!showLegend)}
              className={`px-3 h-8 rounded-full text-[11px] font-medium backdrop-blur-md transition-all shadow-soft ${
                showLegend
                  ? 'bg-accent-teal text-white'
                  : 'bg-paper-light/90 text-ink-lighter'
              }`}
            >
              图例
            </button>
            {canUndo && (
              <button
                onClick={onUndo}
                className="w-8 h-8 rounded-full bg-paper-light/90 backdrop-blur-md shadow-soft flex items-center justify-center text-ink-lighter active:scale-90 transition-transform"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* 空状态遮罩 */}
        {!imagePreview && !displayResult && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-paper/80 backdrop-blur-sm pointer-events-none">
            <div className="w-20 h-20 rounded-3xl bg-paper-light shadow-card flex items-center justify-center mb-5">
              <svg className="text-accent-teal" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="3" width="7" height="7" rx="2" />
                <rect x="3" y="14" width="7" height="7" rx="2" />
                <rect x="14" y="14" width="7" height="7" rx="2" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-ink mb-1">开始制作</p>
            <p className="text-sm text-ink-lighter mb-5">上传一张图片生成拼豆图纸</p>
            <button
              onClick={() => setActiveTab('upload')}
              className="pointer-events-auto px-8 py-3 text-sm font-medium text-white bg-accent-teal rounded-full shadow-card active:scale-95 transition-transform"
            >
              ＋ 上传图片
            </button>
          </div>
        )}
      </div>

      {/* ===== 底部操作区 — 白色卡片带阴影 ===== */}
      <div className="flex-shrink-0 bg-paper-light rounded-t-3xl shadow-elevated safe-area-bottom">
        {/* 板型 — 始终展示 */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-medium text-ink-lighter flex-shrink-0">板型</span>
            <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1">
              {BOARD_SIZES.map(board => (
                <button
                  key={board.id}
                  onClick={() => onBoardSizeChange(board.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl transition-all text-center min-w-[60px] ${
                    boardSizeId === board.id
                      ? 'bg-accent-teal text-white shadow-soft'
                      : 'bg-paper text-ink-lighter'
                  }`}
                >
                  <div className="text-[12px] font-semibold leading-tight">{board.name}</div>
                  <div className={`text-[9px] leading-tight mt-0.5 ${boardSizeId === board.id ? 'text-white/70' : 'text-ink-lightest'}`}>
                    {board.width}×{board.height}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] text-ink-lightest">实际 {canvasWidth}×{canvasHeight} · ≈{(canvasWidth * 0.5).toFixed(0)}×{(canvasHeight * 0.5).toFixed(0)}cm</span>
          </div>
        </div>

        {/* 色卡 — 始终展示 */}
        <div className="px-4 py-2">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-medium text-ink-lighter flex-shrink-0">色卡</span>
            <select
              value={currentPaletteId}
              onChange={e => onPaletteChange(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-paper rounded-xl focus:outline-none min-h-[36px] text-ink"
            >
              {palettes.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name_cn || p.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => onMatchModeChange(matchMode === 'standard' ? 'limited' : 'standard')}
              className={`px-3 py-2 text-[10px] font-medium rounded-xl transition-all flex-shrink-0 min-h-[36px] ${
                matchMode === 'limited' ? 'bg-accent-teal text-white shadow-soft' : 'bg-paper text-ink-lighter'
              }`}
            >
              {matchMode === 'limited' ? `限${maxColors}色` : '标准'}
            </button>
            <button
              onClick={() => onDitherChange(!dither)}
              className={`px-2.5 py-2 text-[9px] font-medium rounded-xl transition-all flex-shrink-0 min-h-[36px] ${
                dither ? 'bg-accent-teal text-white shadow-soft' : 'bg-paper text-ink-lighter'
              }`}
            >
              抖动
            </button>
            <button
              onClick={() => onDebugModeChange(!debugMode)}
              className={`px-2.5 py-2 text-[9px] font-medium rounded-xl transition-all flex-shrink-0 min-h-[36px] ${
                debugMode ? 'bg-accent-teal text-white shadow-soft' : 'bg-paper text-ink-lighter'
              }`}
            >
              调试
            </button>
          </div>
          {matchMode === 'limited' && (
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="range"
                min={2}
                max={Math.min(48, colorCount)}
                value={maxColors}
                onChange={e => onMaxColorsChange(Number(e.target.value))}
                className="flex-1 mobile-slider h-1"
              />
              <span className="text-[11px] font-semibold text-ink w-6 text-right">{maxColors}</span>
            </div>
          )}
        </div>

        {/* Tab: 图片 / 精修 */}
        <div className="flex items-stretch px-4 pt-1">
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
          <div className="max-h-[22vh] overflow-y-auto px-4 py-2 animate-fade-in">
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
        )}

        {/* 底部核心操作按钮 */}
        <div className="flex gap-3 px-4 py-3">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`flex-1 py-3 text-sm font-semibold rounded-2xl transition-all min-h-[44px] ${
              canGenerate
                ? 'bg-paper text-ink active:scale-[0.98] shadow-soft'
                : 'bg-paper-dark text-ink-lightest'
            }`}
          >
            重新生成
          </button>
          <button
            onClick={() => {
              if (displayResult) {
                onDownload({
                  format: 'jpg',
                  includeGrid: true,
                  includeCoordinates: false,
                  includeColorLegend: true,
                  includeBeadCount: true,
                })
              }
            }}
            disabled={!displayResult}
            className={`flex-1 py-3 text-sm font-semibold rounded-2xl transition-all min-h-[44px] ${
              displayResult
                ? 'bg-accent-teal text-white active:scale-[0.98] shadow-card'
                : 'bg-paper-dark text-ink-lightest'
            }`}
          >
            下载图纸
          </button>
        </div>
      </div>

      {/* ===== 弹窗 ===== */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-paper-light rounded-3xl px-8 py-6 flex flex-col items-center gap-3 shadow-elevated">
            <div className="w-10 h-10 border-2 border-accent-teal border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-ink font-medium">{loadingStep || '处理中...'}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 px-5 py-3 bg-accent-amber text-white text-sm rounded-2xl shadow-elevated z-50 animate-fade-in max-w-[90vw]">
          {error}
          <button onClick={() => setError(null)} className="ml-2 opacity-70">×</button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 底部 Tab 按钮 — 胶囊式，柔和选中状态
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
      className={`flex-1 flex flex-col items-center justify-center py-2.5 transition-all min-h-[44px] relative ${
        disabled
          ? 'text-ink-lightest'
          : active
            ? `text-white font-bold rounded-xl ${highlight ? 'bg-accent-pink' : 'bg-accent-teal'} shadow-soft`
            : highlight
              ? 'text-accent-pink bg-paper active:scale-95 rounded-xl'
              : 'text-ink-lighter bg-paper active:scale-95 rounded-xl'
      }`}
    >
      <span className="text-[12px] font-medium">{label}</span>
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
