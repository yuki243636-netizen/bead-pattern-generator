import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import type { GenerateResult, PaletteColor, BeadSize, RefineMode } from '../types'
import { renderPatternToCanvas, BEAD_SIZE_PIXELS, getContentBounds } from '../utils/imageProcessing'
import type { DebugCellInfo, GridMappingInfo, CellEdgeInfo } from '../utils/colorQuantization'

interface PatternCanvasProps {
  result: GenerateResult | null
  colorMap: Map<string, PaletteColor>
  beadSize: BeadSize
  showCoordinates: boolean
  showLegend: boolean
  zoom: number
  pan: { x: number; y: number }
  onZoomChange: (zoom: number) => void
  onPanChange: (pan: { x: number; y: number }) => void
  onShowCoordinatesChange: (val: boolean) => void
  onShowLegendChange: (val: boolean) => void
  onUndo: () => void
  canUndo: boolean
  imagePreview: string | null
  onGenerate: () => void
  canGenerate: boolean
  debugMode: boolean
  debugGrid: DebugCellInfo[][] | undefined
  mapping?: GridMappingInfo
  foregroundBBox?: { x: number; y: number; w: number; h: number }
  edgeInfo?: CellEdgeInfo[]
  edgeCellCount?: number
  // 精修相关
  refineMode: RefineMode
  highlightCode: string | null
  onCellClick: (x: number, y: number) => void
  onCellDrag: (x: number, y: number) => void
  selectedCells: Set<string>
  brushColor: string | null
  resetViewSignal: number
}

export default function PatternCanvas({
  result,
  colorMap,
  beadSize,
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
  imagePreview,
  onGenerate,
  canGenerate,
  debugMode,
  debugGrid,
  mapping,
  foregroundBBox,
  edgeInfo,
  edgeCellCount,
  refineMode,
  highlightCode,
  onCellClick,
  onCellDrag,
  selectedCells,
  brushColor,
  resetViewSignal,
}: PatternCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 })
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)

  // 渲染图纸到 canvas — 始终使用图纸模式
  useEffect(() => {
    if (!result || !canvasRef.current) return

    const beadPx = BEAD_SIZE_PIXELS[beadSize]

    const canvas = renderPatternToCanvas(
      result.grid,
      colorMap,
      beadPx,
      true,           // showGrid
      showCoordinates,
      false,          // asBeads — 图纸模式
      true,           // showCodes
      showLegend,
      result.stats
    )

    const displayCanvas = canvasRef.current
    displayCanvas.width = canvas.width
    displayCanvas.height = canvas.height
    const ctx = displayCanvas.getContext('2d')!
    ctx.drawImage(canvas, 0, 0)

    // 高亮覆盖：颜色替换模式下，选中色发光边框 + 非选中色半透明遮罩
    // 必须使用与 renderPatternToCanvas 完全一致的坐标计算
    if (highlightCode && result.grid.length > 0) {
      // 复刻 renderPatternToCanvas 的坐标参数
      const bounds = getContentBounds(result.grid)
      const cellSize = Math.max(BEAD_SIZE_PIXELS[beadSize], 28) // 图纸模式至少 28px
      const dpr = 2
      const coordPad = showCoordinates ? 28 : 0
      const leftPad = coordPad
      const topPad = coordPad

      ctx.save()

      // 1. 非选中色半透明遮罩（降低视觉权重）
      for (let y = 0; y < result.grid.length; y++) {
        for (let x = 0; x < result.grid[y].length; x++) {
          const code = result.grid[y][x]
          if (!code || code === highlightCode) continue
          // 跳过被裁剪的区域
          if (x < bounds.minCol || x > bounds.maxCol || y < bounds.minRow || y > bounds.maxRow) continue
          const px = (leftPad + (x - bounds.minCol) * cellSize) * dpr
          const py = (topPad + (y - bounds.minRow) * cellSize) * dpr
          ctx.fillStyle = 'rgba(255, 255, 255, 0.62)'
          ctx.fillRect(px, py, cellSize * dpr, cellSize * dpr)
        }
      }

      // 2. 选中色发光边框 — 红色双层边框让选中颜色一目了然
      // 外层发光（粗、半透明红）
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)'
      ctx.lineWidth = 5 * dpr
      for (let y = 0; y < result.grid.length; y++) {
        for (let x = 0; x < result.grid[y].length; x++) {
          if (result.grid[y][x] !== highlightCode) continue
          if (x < bounds.minCol || x > bounds.maxCol || y < bounds.minRow || y > bounds.maxRow) continue
          const px = (leftPad + (x - bounds.minCol) * cellSize) * dpr
          const py = (topPad + (y - bounds.minRow) * cellSize) * dpr
          ctx.strokeRect(px + 1, py + 1, cellSize * dpr - 2, cellSize * dpr - 2)
        }
      }
      // 内层实心边框（细、亮红）
      ctx.strokeStyle = '#ff2222'
      ctx.lineWidth = 2 * dpr
      for (let y = 0; y < result.grid.length; y++) {
        for (let x = 0; x < result.grid[y].length; x++) {
          if (result.grid[y][x] !== highlightCode) continue
          if (x < bounds.minCol || x > bounds.maxCol || y < bounds.minRow || y > bounds.maxRow) continue
          const px = (leftPad + (x - bounds.minCol) * cellSize) * dpr
          const py = (topPad + (y - bounds.minRow) * cellSize) * dpr
          ctx.strokeRect(px + 1, py + 1, cellSize * dpr - 2, cellSize * dpr - 2)
        }
      }

      ctx.restore()
    }

    // 选中格子边框（像素编辑模式 — 多选点亮）
    if (selectedCells.size > 0 && refineMode === 'pixelEdit') {
      const bounds = getContentBounds(result.grid)
      const cellSize = Math.max(BEAD_SIZE_PIXELS[beadSize], 28)
      const dpr = 2
      const coordPad = showCoordinates ? 28 : 0

      ctx.save()
      // 外层发光（粗、半透明红）
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)'
      ctx.lineWidth = 5 * dpr
      for (const key of selectedCells) {
        const [sx, sy] = key.split(',').map(Number)
        const px = (coordPad + (sx - bounds.minCol) * cellSize) * dpr
        const py = (coordPad + (sy - bounds.minRow) * cellSize) * dpr
        ctx.strokeRect(px + 1, py + 1, cellSize * dpr - 2, cellSize * dpr - 2)
      }
      // 内层实心边框（细、亮红）
      ctx.strokeStyle = '#ff2222'
      ctx.lineWidth = 2 * dpr
      for (const key of selectedCells) {
        const [sx, sy] = key.split(',').map(Number)
        const px = (coordPad + (sx - bounds.minCol) * cellSize) * dpr
        const py = (coordPad + (sy - bounds.minRow) * cellSize) * dpr
        ctx.strokeRect(px + 1, py + 1, cellSize * dpr - 2, cellSize * dpr - 2)
      }
      ctx.restore()
    }
  }, [result, colorMap, beadSize, showCoordinates, showLegend, highlightCode, selectedCells, refineMode])

  // 自适应缩放 — 让画布完整显示在容器内
  const fitToScreen = useCallback(() => {
    if (!result || !containerRef.current || !canvasRef.current) return

    const container = containerRef.current
    const canvas = canvasRef.current
    // 容器实际可用尺寸（减去 padding）
    const containerW = container.clientWidth - 24
    const containerH = container.clientHeight - 24
    const canvasW = canvas.width
    const canvasH = canvas.height

    if (canvasW === 0 || canvasH === 0) return

    const scaleX = containerW / canvasW
    const scaleY = containerH / canvasH
    const newZoom = Math.min(scaleX, scaleY, 3)

    onZoomChange(newZoom)
    onPanChange({ x: 0, y: 0 })
  }, [result, onZoomChange, onPanChange])

  // 首次渲染或图纸尺寸变化时自适应 — 不在像素编辑/颜色替换时触发
  const gridDims = result ? `${result.grid.length}x${result.grid[0]?.length || 0}` : ''
  const hasResultRef = useRef(false)
  useEffect(() => {
    if (result) {
      if (!hasResultRef.current) {
        // 首次有结果时自适应
        hasResultRef.current = true
        const timer = setTimeout(fitToScreen, 100)
        return () => clearTimeout(timer)
      }
    } else {
      hasResultRef.current = false
    }
  }, [gridDims, result])

  // 视图复位信号 — 外部触发 fitToScreen
  useEffect(() => {
    if (resetViewSignal > 0 && result) {
      const timer = setTimeout(fitToScreen, 50)
      return () => clearTimeout(timer)
    }
  }, [resetViewSignal])

  // 缩放控制
  const handleZoomIn = () => onZoomChange(Math.min(zoom * 1.3, 8))
  const handleZoomOut = () => onZoomChange(Math.max(zoom / 1.3, 0.1))
  const handleReset = () => {
    onZoomChange(1)
    onPanChange({ x: 0, y: 0 })
  }

  // 拖拽平移 / 像素编辑
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!result) return

    // 像素编辑模式
    if (refineMode === 'pixelEdit') {
      const cell = getGridCellFromMouse(e.clientX, e.clientY)
      if (cell) {
        onCellClick(cell.x, cell.y)
        // 标记开始拖动选择/绘制
        setPanStart({ x: e.clientX, y: e.clientY, panX: 0, panY: 0 })
        setIsPanning(true)
        return
      }
    }

    // 颜色替换模式：不允许拖拽
    if (refineMode === 'colorReplace') return

    setIsPanning(true)
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    // 像素编辑模式：拖动连续选中/绘制
    if (refineMode === 'pixelEdit' && isPanning && (e.buttons & 1)) {
      const cell = getGridCellFromMouse(e.clientX, e.clientY)
      if (cell) {
        onCellDrag(cell.x, cell.y)
      }
      return
    }

    if (!isPanning) return
    const dx = e.clientX - panStart.x
    const dy = e.clientY - panStart.y
    onPanChange({ x: panStart.panX + dx, y: panStart.panY + dy })
  }

  const handleMouseUp = () => setIsPanning(false)

  // 计算鼠标位置对应的网格坐标 — 必须与 renderPatternToCanvas 坐标一致
  const getGridCellFromMouse = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!result || !canvasRef.current || !containerRef.current) return null
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    // 复刻 renderPatternToCanvas 的坐标参数
    const bounds = getContentBounds(result.grid)
    const cellSize = Math.max(BEAD_SIZE_PIXELS[beadSize], 28)
    const dpr = 2
    const coordPad = showCoordinates ? 28 : 0

    // 鼠标 → canvas 像素坐标
    const canvasPx = (clientX - rect.left) / rect.width * canvas.width
    const canvasPy = (clientY - rect.top) / rect.height * canvas.height

    // canvas 像素 → 逻辑坐标（除以 dpr）
    const logicX = canvasPx / dpr
    const logicY = canvasPy / dpr

    // 逻辑坐标 → 网格坐标（减去偏移，除以格子大小，加上裁剪偏移）
    const gx = Math.floor((logicX - coordPad) / cellSize) + bounds.minCol
    const gy = Math.floor((logicY - coordPad) / cellSize) + bounds.minRow

    if (gx < 0 || gx >= result.grid[0]?.length || gy < 0 || gy >= result.grid.length) return null
    return { x: gx, y: gy }
  }, [result, beadSize, showCoordinates])

  // Debug: 悬停处理
  const handleDebugMouseMove = (e: React.MouseEvent) => {
    if (!debugMode || !debugGrid) return
    const cell = getGridCellFromMouse(e.clientX, e.clientY)
    setHoverCell(cell)
  }

  // Debug: 最差匹配统计
  const worstMatches = useMemo(() => {
    if (!debugGrid) return []
    const all: { cell: DebugCellInfo; x: number; y: number }[] = []
    for (let y = 0; y < debugGrid.length; y++) {
      for (let x = 0; x < debugGrid[y].length; x++) {
        const cell = debugGrid[y][x]
        if (cell && cell.matchedCode) {
          all.push({ cell, x, y })
        }
      }
    }
    all.sort((a, b) => b.cell.deltaE - a.cell.deltaE)
    return all.slice(0, 10)
  }, [debugGrid])

  // Debug: 当前悬停格子的信息
  const hoverDebugInfo = useMemo<DebugCellInfo | null>(() => {
    if (!debugGrid || !hoverCell) return null
    return debugGrid[hoverCell.y]?.[hoverCell.x] || null
  }, [debugGrid, hoverCell])

  // Debug: 平均 Delta E
  const avgDeltaE = useMemo(() => {
    if (!debugGrid) return 0
    let sum = 0, count = 0
    for (const row of debugGrid) {
      for (const cell of row) {
        if (cell && cell.matchedCode) {
          sum += cell.deltaE
          count++
        }
      }
    }
    return count > 0 ? sum / count : 0
  }, [debugGrid])

  // 触摸事件
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!result || e.touches.length !== 1) return
    const touch = e.touches[0]
    setIsPanning(true)
    setPanStart({
      x: touch.clientX,
      y: touch.clientY,
      panX: pan.x,
      panY: pan.y
    })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPanning || e.touches.length !== 1) return
    const touch = e.touches[0]
    const dx = touch.clientX - panStart.x
    const dy = touch.clientY - panStart.y
    onPanChange({ x: panStart.panX + dx, y: panStart.panY + dy })
  }

  const handleTouchEnd = () => setIsPanning(false)

  // 双指缩放
  const [pinchStart, setPinchStart] = useState<{ dist: number; zoom: number } | null>(null)
  const handleTouchStartPinch = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return
    const t1 = e.touches[0]
    const t2 = e.touches[1]
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    setPinchStart({ dist, zoom })
  }
  const handleTouchMovePinch = (e: React.TouchEvent) => {
    if (!pinchStart || e.touches.length !== 2) return
    const t1 = e.touches[0]
    const t2 = e.touches[1]
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    const newZoom = Math.max(0.1, Math.min(8, pinchStart.zoom * (dist / pinchStart.dist)))
    onZoomChange(newZoom)
  }

  // 空状态
  if (!result) {
    return (
      <div ref={containerRef} className="flex-1 flex items-center justify-center bg-paper p-4 overflow-hidden">
        <div className="text-center max-w-xs">
          {imagePreview ? (
            <div className="space-y-4">
              <img
                src={imagePreview}
                alt="原图预览"
                className="w-full max-w-[200px] mx-auto rounded-xl border border-paper-darker"
              />
              {canGenerate && (
                <button
                  onClick={onGenerate}
                  className="px-6 py-3 bg-ink text-white rounded-xl font-medium shadow-soft"
                >
                  生成图纸
                </button>
              )}
            </div>
          ) : (
            <>
              <svg className="mx-auto text-ink-lightest mb-3" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <p className="text-sm text-ink-lighter">点击左上角菜单</p>
              <p className="text-sm text-ink-lighter">上传图片并生成图纸</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* 画布区域 — 居中显示 */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden bg-paper relative touch-none min-h-0 ${
          refineMode === 'pixelEdit' && brushColor
            ? 'cursor-crosshair'
            : refineMode === 'colorReplace'
            ? 'cursor-default'
            : 'cursor-grab active:cursor-grabbing'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => { handleMouseMove(e); handleDebugMouseMove(e) }}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setHoverCell(null) }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            handleTouchStartPinch(e)
          } else {
            handleTouchStart(e)
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2) {
            handleTouchMovePinch(e)
          } else {
            handleTouchMove(e)
          }
        }}
        onTouchEnd={(e) => {
          handleTouchEnd()
          setPinchStart(null)
        }}
        onWheel={(e) => {
          if (!result) return
          const delta = e.deltaY > 0 ? 0.9 : 1.1
          onZoomChange(Math.max(0.1, Math.min(8, zoom * delta)))
        }}
      >
        {/* 画布居中 — 使用 flex 居中 + transform 缩放 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center'
            }}
          >
            <canvas
              ref={canvasRef}
              className="block"
              style={{ imageRendering: 'auto' }}
            />
          </div>
        </div>
      </div>

      {/* Debug 叠加面板 */}
      {debugMode && debugGrid && (
        <div className="absolute top-2 right-2 z-20 w-72 max-h-[60vh] overflow-y-auto bg-black/85 text-white rounded-xl shadow-lg p-3 text-xs space-y-3 backdrop-blur-sm">
          {/* 映射信息 */}
          {mapping && (
            <div className="border-b border-white/20 pb-2 space-y-1">
              <div className="font-semibold text-blue-300">网格映射</div>
              <div className="flex justify-between text-white/60">
                <span>原图尺寸:</span>
                <span className="font-mono text-white/80">{mapping.srcW}×{mapping.srcH}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>网格尺寸:</span>
                <span className="font-mono text-white/80">{mapping.gridW}×{mapping.gridH}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>映射区域:</span>
                <span className="font-mono text-white/80">{mapping.mappedW}×{mapping.mappedH}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>偏移:</span>
                <span className="font-mono text-white/80">({mapping.offsetX}, {mapping.offsetY})</span>
              </div>
            </div>
          )}

          {/* 前景边界框 */}
          {foregroundBBox && (
            <div className="border-b border-white/20 pb-2 space-y-1">
              <div className="font-semibold text-green-300">前景区域</div>
              <div className="flex justify-between text-white/60">
                <span>位置:</span>
                <span className="font-mono text-white/80">({foregroundBBox.x}, {foregroundBBox.y})</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>尺寸:</span>
                <span className="font-mono text-white/80">{foregroundBBox.w}×{foregroundBBox.h}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>占比:</span>
                <span className="font-mono text-white/80">
                  {((foregroundBBox.w * foregroundBBox.h) / (mapping!.gridW * mapping!.gridH) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {/* 轮廓信息 */}
          {edgeCellCount !== undefined && edgeCellCount > 0 && (
            <div className="border-b border-white/20 pb-2 space-y-1">
              <div className="font-semibold text-purple-300">轮廓保护</div>
              <div className="flex justify-between text-white/60">
                <span>轮廓格子数:</span>
                <span className="font-mono text-white/80">{edgeCellCount}</span>
              </div>
              {mapping && (
                <div className="flex justify-between text-white/60">
                  <span>轮廓占比:</span>
                  <span className="font-mono text-white/80">
                    {(edgeCellCount / (mapping.gridW * mapping.gridH) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 平均色差 */}
          <div className="flex items-center justify-between border-b border-white/20 pb-2">
            <span className="font-semibold">平均 Delta E</span>
            <span className={`font-mono font-bold ${avgDeltaE > 10 ? 'text-red-400' : avgDeltaE > 5 ? 'text-yellow-400' : 'text-green-400'}`}>
              {avgDeltaE.toFixed(1)}
            </span>
          </div>

          {/* 悬停格子信息 */}
          {hoverDebugInfo && hoverCell ? (
            <div className="space-y-1.5 border-b border-white/20 pb-2">
              <div className="font-semibold text-yellow-400">格子 ({hoverCell.x}, {hoverCell.y})</div>
              <div className="flex items-center gap-2">
                <span className="text-white/60">原始色:</span>
                <div className="w-4 h-4 rounded border border-white/30" style={{ background: hoverDebugInfo.originalRgb[0] >= 0 ? `rgb(${hoverDebugInfo.originalRgb.join(',')})` : 'transparent' }} />
                <span className="font-mono text-white/80">RGB({hoverDebugInfo.originalRgb.join(', ')})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/60">匹配色:</span>
                <div className="w-4 h-4 rounded border border-white/30" style={{ background: hoverDebugInfo.matchedHex || 'transparent' }} />
                <span className="font-mono text-white/80">{hoverDebugInfo.matchedCode}</span>
              </div>
              <div className="flex items-center gap-3 text-white/60">
                <span>Delta E: <span className={`font-mono font-bold ${hoverDebugInfo.deltaE > 10 ? 'text-red-400' : hoverDebugInfo.deltaE > 5 ? 'text-yellow-400' : 'text-green-400'}`}>{hoverDebugInfo.deltaE.toFixed(1)}</span></span>
                <span>色相差: {hoverDebugInfo.hueDiff.toFixed(0)}°</span>
              </div>
              <div className="flex items-center gap-3 text-white/60">
                <span>明度差: {hoverDebugInfo.lightnessDiff.toFixed(1)}</span>
                <span>饱和度差: {(hoverDebugInfo.saturationDiff * 100).toFixed(0)}%</span>
              </div>
              {/* 边缘指标 */}
              {edgeInfo && hoverCell && (() => {
                const ei = edgeInfo[hoverCell.y * (mapping?.gridW || 0) + hoverCell.x]
                if (!ei) return null
                return (
                  <div className="flex items-center gap-3 text-white/60 pt-1 border-t border-white/10">
                    <span className={ei.isEdge ? 'text-purple-400 font-semibold' : ''}>
                      {ei.isEdge ? '◉ 轮廓格' : '○ 填充格'}
                    </span>
                    <span>边缘: {ei.edgeScore.toFixed(2)}</span>
                    <span>深色: {(ei.darkPixelRatio * 100).toFixed(0)}%</span>
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="text-white/40 text-[10px] text-center py-1">悬停在格子上查看详情</div>
          )}

          {/* 最差匹配 Top 10 */}
          <div className="space-y-1">
            <div className="font-semibold text-white/80">最差匹配 Top 10</div>
            {worstMatches.map((m, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <span className="text-white/40 w-4">{i+1}</span>
                <div className="w-3 h-3 rounded border border-white/20 flex-shrink-0" style={{ background: m.cell.originalRgb[0] >= 0 ? `rgb(${m.cell.originalRgb.join(',')})` : 'transparent' }} />
                <span className="text-white/40">→</span>
                <div className="w-3 h-3 rounded border border-white/20 flex-shrink-0" style={{ background: m.cell.matchedHex || 'transparent' }} />
                <span className="font-mono text-white/60 flex-1 truncate">{m.cell.matchedCode}</span>
                <span className={`font-mono font-bold ${m.cell.deltaE > 10 ? 'text-red-400' : m.cell.deltaE > 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {m.cell.deltaE.toFixed(1)}
                </span>
                <span className="text-white/30 text-[9px]">({m.x},{m.y})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 底部工具栏 — 手指可达 */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-paper-darker bg-paper-light flex-shrink-0 gap-2">
        {/* 左侧：缩放 */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="w-9 h-9 rounded-lg hover:bg-paper-darker flex items-center justify-center text-ink-lighter active:scale-95 transition-transform"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
            </svg>
          </button>
          <button
            onClick={fitToScreen}
            className="px-2 h-9 rounded-lg hover:bg-paper-darker flex items-center justify-center text-xs text-ink-lighter min-w-[52px]"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            className="w-9 h-9 rounded-lg hover:bg-paper-darker flex items-center justify-center text-ink-lighter active:scale-95 transition-transform"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {/* 右侧：功能按钮 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onShowCoordinatesChange(!showCoordinates)}
            className={`px-3 h-9 text-xs rounded-lg transition-colors ${
              showCoordinates ? 'text-ink bg-paper-darker' : 'text-ink-lighter hover:bg-paper-darker'
            }`}
          >
            坐标
          </button>
          <button
            onClick={() => onShowLegendChange(!showLegend)}
            className={`px-3 h-9 text-xs rounded-lg transition-colors ${
              showLegend ? 'text-ink bg-paper-darker' : 'text-ink-lighter hover:bg-paper-darker'
            }`}
          >
            图例
          </button>
          {canUndo && (
            <button
              onClick={onUndo}
              className="w-9 h-9 rounded-lg hover:bg-paper-darker flex items-center justify-center text-ink-lighter active:scale-95 transition-transform"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
