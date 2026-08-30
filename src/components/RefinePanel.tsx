import { useState, useMemo, useEffect } from 'react'
import type { ColorStat, PaletteColor, RefineMode } from '../types'
import { findReplacementColors } from '../services/paletteService'

// ============================================================
// 精修面板 Props
// ============================================================
interface RefinePanelProps {
  stats: ColorStat[]
  colors: PaletteColor[]
  colorMap: Map<string, PaletteColor>
  currentPaletteId: string
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

export default function RefinePanel(props: RefinePanelProps) {
  const {
    stats,
    colors,
    colorMap,
    currentPaletteId,
    refineMode,
    onRefineModeChange,
    onResetView,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onRestoreOriginal,
    canRestoreOriginal,
  } = props

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-ink-lighter uppercase tracking-wide">精修</h3>
        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              canUndo ? 'text-ink-lighter hover:bg-paper-darker' : 'text-ink-lightest cursor-not-allowed'
            }`}
            title="撤销"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8" />
            </svg>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              canRedo ? 'text-ink-lighter hover:bg-paper-darker' : 'text-ink-lightest cursor-not-allowed'
            }`}
            title="重做"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6M21 13a9 9 0 1 1-3-7.7L21 8" />
            </svg>
          </button>
        </div>
      </div>

      {/* 三个功能按钮 */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => onRefineModeChange(refineMode === 'colorReplace' ? 'none' : 'colorReplace')}
          className={`py-2 text-[11px] font-medium rounded-lg transition-colors ${
            refineMode === 'colorReplace'
              ? 'bg-ink text-white'
              : 'bg-paper-darker text-ink-lighter hover:bg-paper-dark'
          }`}
        >
          颜色替换
        </button>
        <button
          onClick={() => onRefineModeChange(refineMode === 'pixelEdit' ? 'none' : 'pixelEdit')}
          className={`py-2 text-[11px] font-medium rounded-lg transition-colors ${
            refineMode === 'pixelEdit'
              ? 'bg-ink text-white'
              : 'bg-paper-darker text-ink-lighter hover:bg-paper-dark'
          }`}
        >
          像素编辑
        </button>
        <button
          onClick={onResetView}
          className="py-2 text-[11px] font-medium rounded-lg bg-paper-darker text-ink-lighter hover:bg-paper-dark transition-colors"
        >
          视图复位
        </button>
      </div>

      {/* 展开对应工具面板 */}
      {refineMode === 'colorReplace' && <ColorReplaceTool {...props} />}
      {refineMode === 'pixelEdit' && <PixelEditTool {...props} />}

      {/* 返回上一步 + 恢复原始图纸 */}
      <div className="flex gap-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-colors border ${
            canUndo
              ? 'text-ink-lighter bg-paper-darker/50 hover:bg-paper-darker border-paper-darker'
              : 'text-ink-lightest bg-paper-darker/30 border-paper-darker cursor-not-allowed'
          }`}
        >
          返回上一步
        </button>
        {canRestoreOriginal && (
          <button
            onClick={onRestoreOriginal}
            className="flex-1 py-1.5 text-[10px] font-medium text-ink-lighter bg-paper-darker/50 hover:bg-paper-darker rounded-lg transition-colors border border-paper-darker"
          >
            恢复原始图纸
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 颜色替换工具
// ============================================================
function ColorReplaceTool(props: RefinePanelProps) {
  const {
    stats,
    colors,
    colorMap,
    currentPaletteId,
    highlightCode,
    onHighlightCodeChange,
    onColorReplace,
  } = props

  const [recommendations, setRecommendations] = useState<{ code: string; name: string; hex: string; deltaE: number }[]>([])
  const [confirmReplace, setConfirmReplace] = useState<{ oldCode: string; newCode: string; count: number } | null>(null)
  const [showAllPalette, setShowAllPalette] = useState(false)

  const selectedStat = useMemo(
    () => stats.find(s => s.code === highlightCode) || null,
    [stats, highlightCode]
  )

  // 选中颜色后加载相近色推荐
  useEffect(() => {
    if (!highlightCode || !selectedStat) {
      setRecommendations([])
      return
    }
    let cancelled = false
    findReplacementColors(selectedStat.rgb, currentPaletteId, highlightCode).then(recs => {
      if (cancelled) return
      setRecommendations(recs.slice(0, 5).map(r => ({
        code: r.color.code,
        name: r.color.name,
        hex: r.color.hex,
        deltaE: r.deltaE,
      })))
    })
    return () => { cancelled = true }
  }, [highlightCode, selectedStat, currentPaletteId])

  // 画板上现有的全部颜色（排除当前选中色）
  const boardColors = useMemo(() => {
    return stats.filter(s => s.code !== highlightCode)
  }, [stats, highlightCode])

  const handleSelectColor = (code: string) => {
    if (highlightCode === code) {
      onHighlightCodeChange(null)
    } else {
      onHighlightCodeChange(code)
    }
    setConfirmReplace(null)
  }

  const handlePickReplacement = (newCode: string) => {
    if (!highlightCode || !selectedStat) return
    setConfirmReplace({
      oldCode: highlightCode,
      newCode,
      count: selectedStat.count,
    })
  }

  const handleConfirmReplace = () => {
    if (!confirmReplace) return
    onColorReplace(confirmReplace.oldCode, confirmReplace.newCode)
    setConfirmReplace(null)
    onHighlightCodeChange(null)
  }

  return (
    <div className="space-y-2 mt-2 p-2.5 bg-paper-darker/30 rounded-lg">
      <p className="text-[10px] text-ink-lightest">点击颜色高亮图纸中的位置，再选择替换色</p>

      {/* 当前使用颜色列表 */}
      <div className="space-y-0.5 max-h-40 overflow-y-auto">
        {stats.map(stat => (
          <button
            key={stat.code}
            onClick={() => handleSelectColor(stat.code)}
            className={`w-full flex items-center gap-2 px-1.5 py-1 rounded-md transition-colors ${
              highlightCode === stat.code ? 'bg-red-50 ring-1 ring-red-400' : 'hover:bg-paper-darker/50'
            }`}
          >
            <div
              className={`w-4 h-4 rounded border flex-shrink-0 ${
                highlightCode === stat.code ? 'border-red-400' : 'border-paper-darker'
              }`}
              style={{ backgroundColor: stat.hex }}
            />
            <span className="text-[11px] font-mono text-ink-light">{stat.code}</span>
            <span className="flex-1 text-left text-[10px] truncate text-ink-lighter">{stat.name}</span>
            <span className="text-[10px] text-ink-lighter">×{stat.count}</span>
          </button>
        ))}
      </div>

      {/* 选中颜色后的替换区域 */}
      {selectedStat && (
        <div className="space-y-2 pt-2 border-t border-paper-darker">
          {/* 当前选中色信息 */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ink-lighter">当前:</span>
            <div
              className="w-4 h-4 rounded border-2 border-red-400"
              style={{ backgroundColor: selectedStat.hex }}
            />
            <span className="text-[11px] font-mono text-ink">{selectedStat.code}</span>
            <span className="text-[10px] text-ink-lightest">×{selectedStat.count}</span>
          </div>

          {/* 推荐替换色 — 横排一行 */}
          {recommendations.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-ink-lighter">推荐替换色</div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {recommendations.map(rec => (
                  <button
                    key={rec.code}
                    onClick={() => handlePickReplacement(rec.code)}
                    className="flex flex-col items-center gap-0.5 p-1 rounded-md hover:bg-paper-darker/50 transition-colors flex-shrink-0"
                  >
                    <div className="w-7 h-7 rounded border border-paper-darker" style={{ backgroundColor: rec.hex }} />
                    <span className="text-[9px] font-mono text-ink-light">{rec.code}</span>
                    <span className="text-[8px] text-ink-lightest">ΔE{rec.deltaE.toFixed(1)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 展开/收起画板现有颜色 */}
          <button
            onClick={() => setShowAllPalette(!showAllPalette)}
            className="w-full flex items-center justify-between py-1 px-1.5 text-[10px] font-medium text-ink-lighter hover:bg-paper-darker/30 rounded-md transition-colors"
          >
            <span>{showAllPalette ? '收起画板颜色' : `画板全部颜色 (${boardColors.length}色)`}</span>
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${showAllPalette ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* 画板现有颜色 — 供用户自由选择，带色号 */}
          {showAllPalette && (
            <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
              {boardColors.map(c => (
                <button
                  key={c.code}
                  onClick={() => handlePickReplacement(c.code)}
                  className="flex flex-col items-center gap-0.5 p-1 rounded-md hover:bg-paper-darker/50 transition-colors"
                >
                  <div
                    className="w-7 h-7 rounded border border-paper-darker"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-[9px] font-mono text-ink-light">{c.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 替换确认 */}
      {confirmReplace && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded-md space-y-1.5">
          <p className="text-[11px] text-amber-800">
            将 <span className="font-mono font-bold">{confirmReplace.oldCode}</span> 替换为{' '}
            <span className="font-mono font-bold">{confirmReplace.newCode}</span>？
          </p>
          <p className="text-[10px] text-amber-600">影响拼豆数量: {confirmReplace.count}</p>
          <div className="flex gap-1.5">
            <button
              onClick={handleConfirmReplace}
              className="flex-1 py-1 text-[11px] font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
            >
              确认替换
            </button>
            <button
              onClick={() => setConfirmReplace(null)}
              className="px-3 py-1 text-[11px] font-medium text-ink-lighter bg-paper-light border border-paper-darker rounded-md hover:bg-paper-darker/50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 像素编辑工具
// ============================================================
function PixelEditTool(props: RefinePanelProps) {
  const {
    stats,
    colors,
    colorMap,
    selectedCells,
    onClearSelection,
    onBatchPixelEdit,
    brushColor,
    onBrushColorChange,
  } = props

  const [showAllColors, setShowAllColors] = useState(false)
  const [searchCode, setSearchCode] = useState('')

  // 使用过的颜色（当前图纸）
  const usedColorCodes = useMemo(() => new Set(stats.map(s => s.code)), [stats])

  // 筛选颜色列表
  const filteredColors = useMemo(() => {
    let list = showAllColors ? colors : colors.filter(c => usedColorCodes.has(c.code))
    if (searchCode.trim()) {
      const q = searchCode.trim().toUpperCase()
      list = list.filter(c => c.code.toUpperCase().includes(q) || c.name.includes(searchCode.trim()))
    }
    return list
  }, [colors, usedColorCodes, showAllColors, searchCode])

  const selectedCount = selectedCells.size

  const handleBatchReplace = () => {
    if (!brushColor || selectedCount === 0) return
    const cells = Array.from(selectedCells).map(key => {
      const [x, y] = key.split(',').map(Number)
      return { x, y }
    })
    onBatchPixelEdit(cells, brushColor)
  }

  return (
    <div className="space-y-2 mt-2 p-2.5 bg-paper-darker/30 rounded-lg">
      <p className="text-[10px] text-ink-lightest">
        {brushColor
          ? '已选画笔颜色，点击/拖动画板直接替换'
          : '点击画板色块选中，拖动可连续选中，选好后挑颜色一键替换'}
      </p>

      {/* 选中状态 + 操作按钮 */}
      {selectedCount > 0 && (
        <div className="p-1.5 bg-red-50 border border-red-200 rounded-md space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-red-700 font-medium">
              已选中 {selectedCount} 格
            </span>
            <button
              onClick={onClearSelection}
              className="text-[10px] text-red-500 hover:text-red-700"
            >
              清除选中
            </button>
          </div>
          {brushColor && (
            <button
              onClick={handleBatchReplace}
              className="w-full py-1.5 text-[11px] font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
            >
              替换选中为 {brushColor}
            </button>
          )}
          {!brushColor && (
            <p className="text-[10px] text-red-400">请先选择替换颜色</p>
          )}
        </div>
      )}

      {/* 搜索框 */}
      <input
        type="text"
        value={searchCode}
        onChange={e => setSearchCode(e.target.value)}
        placeholder="搜索色号..."
        className="w-full px-2 py-1 text-[11px] border border-paper-darker rounded-md bg-paper-light focus:border-ink focus:outline-none"
      />

      {/* 切换：仅已使用 / 全部色卡 */}
      <div className="flex gap-1">
        <button
          onClick={() => setShowAllColors(false)}
          className={`flex-1 py-1 text-[10px] font-medium rounded-md transition-colors ${
            !showAllColors ? 'bg-ink text-white' : 'bg-paper-darker text-ink-lighter'
          }`}
        >
          已使用 ({stats.length})
        </button>
        <button
          onClick={() => setShowAllColors(true)}
          className={`flex-1 py-1 text-[10px] font-medium rounded-md transition-colors ${
            showAllColors ? 'bg-ink text-white' : 'bg-paper-darker text-ink-lighter'
          }`}
        >
          全部 ({colors.length})
        </button>
      </div>

      {/* 颜色选择网格 — 带色号 */}
      <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
        {filteredColors.map(c => (
          <button
            key={c.code}
            onClick={() => onBrushColorChange(c.code)}
            className={`flex flex-col items-center gap-0.5 p-1 rounded-md transition-all ${
              brushColor === c.code
                ? 'ring-2 ring-ink bg-paper-light'
                : 'hover:bg-paper-darker/50'
            }`}
          >
            <div
              className={`w-7 h-7 rounded border ${
                brushColor === c.code ? 'border-ink' : 'border-paper-darker'
              }`}
              style={{ backgroundColor: c.hex }}
            />
            <span className="text-[9px] font-mono text-ink-light">{c.code}</span>
          </button>
        ))}
      </div>

      {/* 当前画笔色显示 */}
      {brushColor && (
        <div className="flex items-center gap-2 p-1.5 bg-paper-light border border-paper-darker rounded-md">
          <div
            className="w-5 h-5 rounded border border-paper-darker"
            style={{ backgroundColor: colorMap.get(brushColor)?.hex }}
          />
          <span className="text-[11px] font-mono text-ink">{brushColor}</span>
          <span className="text-[10px] text-ink-lighter truncate">{colorMap.get(brushColor)?.name}</span>
          <button
            onClick={() => onBrushColorChange(null)}
            className="ml-auto text-[10px] text-ink-lightest hover:text-ink-lighter"
          >
            清除
          </button>
        </div>
      )}
    </div>
  )
}
