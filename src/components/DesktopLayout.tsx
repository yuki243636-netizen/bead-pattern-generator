import { useState, useRef } from 'react'
import type {
  Palette, PaletteColor, BeadSize, MatchMode, DownloadOptions,
  GenerateResult, ReplacementSuggestion, RefineMode,
} from '../types'
import type { QuantizationResult, DebugCellInfo } from '../utils/colorQuantization'
import type { BoardSizeId } from './SettingsPanel'
import { BOARD_SIZES } from './SettingsPanel'
import BottomActionBar from './BottomActionBar'
import CanvasEmptyState from './CanvasEmptyState'
import PatternCanvas from './PatternCanvas'
import DownloadPanel from './DownloadPanel'
import LoadingOverlay from './LoadingOverlay'
import ErrorBanner from './ErrorBanner'
import ImageUploader from './ImageUploader'
import RefinePanel from './RefinePanel'

// 左侧面板内的子组件
import BoardPanel from './panels/BoardPanel'
import ColorPanel from './panels/ColorPanel'

interface DesktopLayoutProps {
  // Image
  imagePreview: string | null
  imageDimensions: { width: number; height: number } | null
  fileSize: number
  onImageUpload: (file: File) => void
  onImageRemove: () => void
  // Board
  boardSizeId: BoardSizeId
  onBoardSizeChange: (id: BoardSizeId) => void
  canvasWidth: number
  canvasHeight: number
  beadSize: BeadSize
  onBeadSizeChange: (val: BeadSize) => void
  // Color
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
  // Generate
  onGenerate: () => void
  canGenerate: boolean
  // Result
  displayResult: GenerateResult | null
  result: GenerateResult | null
  // Refine
  colors: PaletteColor[]
  colorMap: Map<string, PaletteColor>
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
  resetViewSignal: number
  // Display
  showCoordinates: boolean
  showLegend: boolean
  zoom: number
  pan: { x: number; y: number }
  onZoomChange: (v: number) => void
  onPanChange: (v: { x: number; y: number }) => void
  onShowCoordinatesChange: (v: boolean) => void
  onShowLegendChange: (v: boolean) => void
  onUndoCanvas: () => void
  // Download
  onDownload: (options: DownloadOptions) => void
  // Debug
  debugGrid?: DebugCellInfo[][]
  // Status
  loading: boolean
  loadingStep: string
  error: string | null
  setError: (e: string | null) => void
  detailWarning: string | null
  setDetailWarning: (w: string | null) => void
  recommendedBoardSize: string | null
  // Missing colors
  replacements: ReplacementSuggestion[]
}

export default function DesktopLayout(props: DesktopLayoutProps) {
  const [showDownload, setShowDownload] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasResult = !!props.displayResult

  const handleDownload = (options: DownloadOptions) => {
    props.onDownload(options)
    setShowDownload(false)
  }

  const handleGenerate = () => {
    props.onGenerate()
  }

  // 触发文件选择器
  const triggerFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) props.onImageUpload(file)
    e.target.value = ''
  }

  return (
    <div className="h-[100dvh] bg-paper flex flex-col overflow-hidden">
      {/* 隐藏的文件输入 — 供画布空状态的上传按钮使用 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 顶部 Header */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-paper-light shadow-soft flex-shrink-0">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="logo" className="w-6 h-6 rounded-md flex-shrink-0 object-cover" />
          <h1 className="text-sm font-semibold text-ink">甘薯么拼豆</h1>
          <span className="text-[10px] text-ink-lightest">Sweet Potato Beads</span>
        </div>
        {props.displayResult && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-ink">{props.displayResult.totalBeads.toLocaleString()}</span>
            <span className="text-[10px] text-ink-lighter">颗</span>
            <span className="text-lg font-bold text-ink ml-2">{props.displayResult.stats.length}</span>
            <span className="text-[10px] text-ink-lighter">色</span>
          </div>
        )}
      </header>

      {props.error && <ErrorBanner message={props.error} onClose={() => props.setError(null)} />}

      {/* Detail Loss 提示 */}
      {props.detailWarning && !props.error && (
        <div className="flex-shrink-0 bg-accent-amber/10 px-5 py-3 flex items-start gap-2 shadow-soft">
          <svg className="w-4 h-4 text-accent-amber mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink leading-relaxed">{props.detailWarning}</p>
            {props.recommendedBoardSize && (
              <button
                onClick={() => {
                  const boardId = BOARD_SIZES.find(b =>
                    `${b.width}×${b.height}` === props.recommendedBoardSize
                  )?.id
                  if (boardId) props.onBoardSizeChange(boardId)
                  props.setDetailWarning(null)
                }}
                className="mt-1.5 px-3 py-1 text-xs font-medium text-white bg-accent-amber hover:bg-accent-amber/80 rounded-xl transition-colors"
              >
                切换到 {props.recommendedBoardSize}
              </button>
            )}
          </div>
          <button
            onClick={() => props.setDetailWarning(null)}
            className="text-ink-lightest hover:text-accent-amber flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 工作区：左侧设置面板 + 中央画板 + 右侧精修面板 */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 左侧设置面板 — 所有设置直接可见 */}
        <aside className="w-80 bg-paper-light overflow-y-auto flex-shrink-0 shadow-soft">
          <div className="p-4 space-y-5">
            {/* 图片上传 */}
            <section>
              <h3 className="text-xs font-medium text-ink-lighter mb-3">图片</h3>
              <ImageUploader
                onUpload={props.onImageUpload}
                imagePreview={props.imagePreview}
                imageDimensions={props.imageDimensions}
                fileSize={props.fileSize}
                onRemove={props.onImageRemove}
              />
              {props.imagePreview && (
                <p className="text-[10px] text-ink-lightest leading-relaxed mt-1.5">
                  重新上传图片后需要重新生成图纸
                </p>
              )}
            </section>

            {/* 板型选择 */}
            <section>
              <BoardPanel
                boardSizeId={props.boardSizeId}
                onBoardSizeChange={props.onBoardSizeChange}
                canvasWidth={props.canvasWidth}
                canvasHeight={props.canvasHeight}
                beadSize={props.beadSize}
                onBeadSizeChange={props.onBeadSizeChange}
              />
            </section>

            {/* 色卡设置 */}
            <section>
              <ColorPanel
                palettes={props.palettes}
                currentPaletteId={props.currentPaletteId}
                onPaletteChange={props.onPaletteChange}
                matchMode={props.matchMode}
                onMatchModeChange={props.onMatchModeChange}
                maxColors={props.maxColors}
                onMaxColorsChange={props.onMaxColorsChange}
                colorCount={props.colorCount}
                dither={props.dither}
                onDitherChange={props.onDitherChange}
                debugMode={props.debugMode}
                onDebugModeChange={props.onDebugModeChange}
              />
            </section>

            {/* 颜色统计 — 有结果时显示 */}
            {props.result && (
              <section className="pt-4">
                <h3 className="text-xs font-medium text-ink-lighter mb-3">颜色统计</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-ink">{props.result.totalBeads.toLocaleString()}</span>
                    <span className="text-ink-lightest">颗</span>
                    <span className="font-semibold text-ink ml-1">{props.result.usedColors.length}</span>
                    <span className="text-ink-lightest">色</span>
                  </div>
                  <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                    {props.result.stats.map(stat => (
                      <div key={stat.code} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-paper-dark/60 transition-colors">
                        <div className="w-3.5 h-3.5 rounded flex-shrink-0" style={{ backgroundColor: stat.hex }} />
                        <span className="text-[11px] font-mono font-medium text-ink w-10 flex-shrink-0">{stat.code}</span>
                        <span className="text-[10px] text-ink-lighter flex-1 truncate">{stat.name}</span>
                        <span className="text-[11px] font-semibold text-ink w-8 text-right">{stat.count}</span>
                        <span className="text-[9px] text-ink-lightest w-8 text-right">{stat.percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 缺色替换 */}
                {props.replacements.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] font-medium text-accent-amber">缺色替换建议 ({props.replacements.length})</p>
                    <div className="space-y-0.5">
                      {props.replacements.map((r, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-paper-dark/60 transition-colors">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.originalHex }} />
                          <span className="text-[10px] font-mono text-ink-light line-through">{r.originalCode}</span>
                          <span className="text-[10px] text-ink-lightest">→</span>
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.recommendedHex }} />
                          <span className="text-[10px] font-mono text-ink font-medium">{r.recommendedCode}</span>
                          <span className="text-[9px] text-ink-lightest ml-auto">ΔE {r.deltaE.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </aside>

        {/* 中央画板 */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-paper">
          {props.displayResult ? (
            <PatternCanvas
              result={props.displayResult}
              colorMap={props.colorMap}
              beadSize={props.beadSize}
              showCoordinates={props.showCoordinates}
              showLegend={props.showLegend}
              zoom={props.zoom}
              pan={props.pan}
              onZoomChange={props.onZoomChange}
              onPanChange={props.onPanChange}
              onShowCoordinatesChange={props.onShowCoordinatesChange}
              onShowLegendChange={props.onShowLegendChange}
              onUndo={props.onUndoCanvas}
              canUndo={props.canUndo}
              imagePreview={props.imagePreview}
              onGenerate={handleGenerate}
              canGenerate={props.canGenerate}
              debugMode={props.debugMode}
              debugGrid={props.debugGrid}
              mapping={(props.result as QuantizationResult)?.mapping}
              foregroundBBox={(props.result as QuantizationResult)?.foregroundBBox}
              edgeInfo={(props.result as QuantizationResult)?.edgeInfo}
              edgeCellCount={(props.result as QuantizationResult)?.edgeCellCount}
              refineMode={props.refineMode}
              highlightCode={props.highlightCode}
              onCellClick={(x, y) => {
                if (props.refineMode === 'pixelEdit' && props.brushColor) {
                  props.onPixelEdit(x, y, props.brushColor)
                } else if (props.refineMode === 'pixelEdit') {
                  props.onToggleCell(x, y)
                }
              }}
              onCellDrag={(x, y) => {
                if (props.refineMode === 'pixelEdit' && props.brushColor) {
                  props.onPixelEdit(x, y, props.brushColor)
                } else if (props.refineMode === 'pixelEdit') {
                  props.onAddToSelection(x, y)
                }
              }}
              selectedCells={props.selectedCells}
              brushColor={props.brushColor}
              resetViewSignal={props.resetViewSignal}
            />
          ) : (
            <CanvasEmptyState
              imagePreview={props.imagePreview}
              canGenerate={props.canGenerate}
              onUploadClick={triggerFileUpload}
              onGenerate={handleGenerate}
            />
          )}
        </main>

        {/* 右侧精修面板 — 有结果时显示 */}
        {hasResult && (
          <aside className="w-72 bg-paper-light overflow-y-auto flex-shrink-0 shadow-soft">
            <div className="p-4">
              <h3 className="text-xs font-medium text-ink-lighter mb-3">精修</h3>
              <RefinePanel
                stats={props.result?.stats || []}
                colors={props.colors}
                colorMap={props.colorMap}
                currentPaletteId={props.currentPaletteId}
                refineMode={props.refineMode}
                onRefineModeChange={props.onRefineModeChange}
                highlightCode={props.highlightCode}
                onHighlightCodeChange={props.onHighlightCodeChange}
                onColorReplace={props.onColorReplace}
                onPixelEdit={props.onPixelEdit}
                onBatchPixelEdit={props.onBatchPixelEdit}
                selectedCells={props.selectedCells}
                onToggleCell={props.onToggleCell}
                onAddToSelection={props.onAddToSelection}
                onClearSelection={props.onClearSelection}
                brushColor={props.brushColor}
                onBrushColorChange={props.onBrushColorChange}
                onUndo={props.onUndo}
                onRedo={props.onRedo}
                canUndo={props.canUndo}
                canRedo={props.canRedo}
                onResetView={props.onResetView}
                onRestoreOriginal={props.onRestoreOriginal}
                canRestoreOriginal={props.canRestoreOriginal}
              />
            </div>
          </aside>
        )}
      </div>

      {/* 底部操作栏 */}
      <BottomActionBar
        onGenerate={handleGenerate}
        onDownload={() => setShowDownload(true)}
        canGenerate={props.canGenerate}
        canDownload={hasResult}
      />

      {/* 下载弹窗 */}
      {showDownload && props.displayResult && (
        <DownloadPanel
          onDownload={handleDownload}
          onClose={() => setShowDownload(false)}
        />
      )}

      {/* 加载遮罩 */}
      {props.loading && <LoadingOverlay step={props.loadingStep} />}

      {/* 错误提示 */}
      {props.error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500 text-white text-sm rounded-lg shadow-lg z-50 animate-fade-in">
          {props.error}
        </div>
      )}
    </div>
  )
}
