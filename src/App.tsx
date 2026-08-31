import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type {
  Palette,
  PaletteColor,
  BeadSize,
  MatchMode,
  GenerateResult,
  ReplacementSuggestion,
  DownloadOptions,
  PatternGrid,
  RefineMode
} from './types'
import { getPalettes, getColors, getDefaultPaletteId, findReplacementColors } from './services/paletteService'
import { generateBeadPattern, type QuantizationResult, type DebugCellInfo } from './utils/colorQuantization'
import { detectBackgroundColors, filterGrid } from './utils/imageProcessing'
import { BEAD_SIZE_PIXELS } from './utils/imageProcessing'
import { exportPNG } from './utils/exporter'
import { BOARD_SIZES, type BoardSizeId } from './components/SettingsPanel'
import DesktopLayout from './components/DesktopLayout'
import MobileLayout from './components/MobileLayout'
import { useIsMobile } from './hooks/useIsMobile'

export default function App() {
  const isMobile = useIsMobile()

  // ========== 色卡数据 ==========
  const [palettes, setPalettes] = useState<Palette[]>([])
  const [currentPaletteId, setCurrentPaletteId] = useState('mard-221')
  const [colors, setColors] = useState<PaletteColor[]>([])
  const [colorMap, setColorMap] = useState<Map<string, PaletteColor>>(new Map())

  // ========== 图片 ==========
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const [fileSize, setFileSize] = useState(0)

  // ========== 画板设置 ==========
  const [boardSizeId, setBoardSizeId] = useState<BoardSizeId>('medium')
  const [canvasWidth, setCanvasWidth] = useState(78)
  const [canvasHeight, setCanvasHeight] = useState(78)
  const [beadSize, setBeadSize] = useState<BeadSize>('standard')
  const [matchMode, setMatchMode] = useState<MatchMode>('standard')
  const [maxColors, setMaxColors] = useState(15)
  const [dither, setDither] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [debugGrid, setDebugGrid] = useState<DebugCellInfo[][] | undefined>(undefined)

  // ========== 显示 ==========
  const [showCoordinates, setShowCoordinates] = useState(false)
  const [showLegend, setShowLegend] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  // ========== 生成结果 ==========
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // ========== 缺色替换 ==========
  const [missingCodes, setMissingCodes] = useState<Set<string>>(new Set())
  const [replacements, setReplacements] = useState<ReplacementSuggestion[]>([])

  // ========== 背景排除 ==========
  const [excludedColors, setExcludedColors] = useState<Set<string>>(new Set())

  // ========== UI 状态 ==========
  const [showSettings, setShowSettings] = useState(false)
  const [showDownload, setShowDownload] = useState(false)

  // ========== Detail Loss 提示 ==========
  const [detailWarning, setDetailWarning] = useState<string | null>(null)
  const [recommendedBoardSize, setRecommendedBoardSize] = useState<string | null>(null)

  // ========== 撤销栈 ==========
  const historyRef = useRef<GenerateResult[]>([])
  const redoRef = useRef<GenerateResult[]>([])

  // ========== 精修模块状态 ==========
  const [refineMode, setRefineMode] = useState<RefineMode>('none')
  const [highlightCode, setHighlightCode] = useState<string | null>(null)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [brushColor, setBrushColor] = useState<string | null>(null)
  const [originalPattern, setOriginalPattern] = useState<GenerateResult | null>(null)
  const [resetViewSignal, setResetViewSignal] = useState(0)

  // ========== 派生：过滤背景色后的显示结果 ==========
  const displayResult = useMemo<GenerateResult | null>(() => {
    if (!result) return null
    if (excludedColors.size === 0) return result

    const filteredGrid: PatternGrid = filterGrid(result.grid, excludedColors)

    const codeCounts = new Map<string, number>()
    for (const row of filteredGrid) {
      for (const code of row) {
        if (code) codeCounts.set(code, (codeCounts.get(code) || 0) + 1)
      }
    }
    const total = [...codeCounts.values()].reduce((a, b) => a + b, 0)
    const newStats = [...codeCounts.entries()].map(([code, count]) => {
      const color = colorMap.get(code)
      return {
        code,
        name: color?.name || code,
        hex: color?.hex || '#000000',
        rgb: color?.rgb || [0, 0, 0],
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }
    }).sort((a, b) => b.count - a.count)

    const usedColors = newStats
      .map(s => colorMap.get(s.code))
      .filter((c): c is PaletteColor => !!c)

    return {
      grid: filteredGrid,
      stats: newStats,
      totalBeads: total,
      usedColors
    }
  }, [result, excludedColors, colorMap])

  // ========== 加载色卡 ==========
  useEffect(() => {
    loadPalettes()
  }, [])

  const loadPalettes = async () => {
    try {
      const [pals, defaultId] = await Promise.all([getPalettes(), getDefaultPaletteId()])
      setPalettes(pals)
      setCurrentPaletteId(defaultId)
      const cols = await getColors(defaultId)
      setColors(cols)
      setColorMap(new Map(cols.map(c => [c.code, c])))
    } catch (e) {
      setError('色卡数据加载失败，请刷新页面重试。')
    }
  }

  // ========== 切换色卡 ==========
  const handlePaletteChange = async (id: string) => {
    setCurrentPaletteId(id)
    const cols = await getColors(id)
    setColors(cols)
    setColorMap(new Map(cols.map(c => [c.code, c])))
    setResult(null)
    setMissingCodes(new Set())
    setReplacements([])
    setExcludedColors(new Set())
  }

  // ========== 图片上传 ==========
  const handleImageUpload = useCallback((file: File) => {
    setError(null)

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('不支持的图片格式。请上传 JPG、PNG 或 WEBP 图片。')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('图片太大。请选择小于 20MB 的图片。')
      return
    }

    setFileSize(file.size)
    setImageFile(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string
      setImagePreview(src)

      const img = new Image()
      img.onload = () => {
        setImageElement(img)
        setImageDimensions({ width: img.width, height: img.height })

        const board = BOARD_SIZES.find(b => b.id === boardSizeId) || BOARD_SIZES[1]
        const fitted = fitImageToBoard(img.width, img.height, board.width, board.height)
        setCanvasWidth(fitted.width)
        setCanvasHeight(fitted.height)
      }
      img.onerror = () => {
        setError('无法处理此图片，请尝试其他图片。')
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }, [boardSizeId])

  const handleImageRemove = () => {
    setImageFile(null)
    setImageElement(null)
    setImagePreview(null)
    setImageDimensions(null)
    setResult(null)
    setMissingCodes(new Set())
    setReplacements([])
    setExcludedColors(new Set())
    setDetailWarning(null)
    setRecommendedBoardSize(null)
  }

  // ========== 拼豆板尺寸切换 ==========
  const handleBoardSizeChange = (id: BoardSizeId) => {
    setBoardSizeId(id)
    const board = BOARD_SIZES.find(b => b.id === id)!
    if (imageDimensions) {
      const fitted = fitImageToBoard(imageDimensions.width, imageDimensions.height, board.width, board.height)
      setCanvasWidth(fitted.width)
      setCanvasHeight(fitted.height)
    } else {
      setCanvasWidth(board.width)
      setCanvasHeight(board.height)
    }
  }

  function fitImageToBoard(
    imgWidth: number, imgHeight: number,
    boardW: number, boardH: number
  ): { width: number; height: number } {
    const ratio = imgWidth / imgHeight
    const boardRatio = boardW / boardH
    if (ratio > boardRatio) {
      return { width: boardW, height: Math.max(1, Math.round(boardW / ratio)) }
    } else {
      return { width: Math.max(1, Math.round(boardH * ratio)), height: boardH }
    }
  }

  // ========== 生成图纸 ==========
  const handleGenerate = async () => {
    if (!imageElement) {
      setError('请先上传图片。')
      return
    }
    if (colors.length === 0) {
      setError('色卡未加载完成，请稍后重试。')
      return
    }

    setError(null)
    setLoading(true)
    setResult(null)
    setMissingCodes(new Set())
    setReplacements([])
    setExcludedColors(new Set())
    setShowSettings(false)
    setDetailWarning(null)
    setRecommendedBoardSize(null)
    setRefineMode('none')
    setHighlightCode(null)
    setSelectedCells(new Set())
    setBrushColor(null)
    redoRef.current = []

    try {
      const steps: Record<string, string> = {
        preprocess: '加载图片',
        subjectDetection: '主体检测',
        edgeDetection: '边缘检测',
        gridding: '网格映射',
        structureAnalysis: '结构分析',
        foreground: '前景检测',
        precomputing: '预计算色卡',
        dithering: '抖动处理',
        matching: '颜色匹配',
        featurePreservation: '特征保护',
        building: '构建网格',
        edgePreservation: '轮廓保护',
        skeletonThinning: '骨架细化',
        regionSimplification: '区域简化',
        gapRepair: '间隙修复',
        simplifying: '颜色简化',
        hierarchy: '层次保持',
        detailAnalysis: '细节分析',
        counting: '统计数量',
        done: '完成'
      }

      const res = await generateBeadPattern(
        imageElement,
        canvasWidth,
        canvasHeight,
        colors,
        matchMode,
        maxColors,
        (step) => {
          setLoadingStep(steps[step] || step)
        },
        {
          dither,
          ditherStrength: 0.3,
          debug: debugMode,
        }
      ) as GenerateResult

      // 保存调试信息
      if (debugMode && (res as QuantizationResult).debugGrid) {
        setDebugGrid((res as QuantizationResult).debugGrid)
      } else {
        setDebugGrid(undefined)
      }

      // 提取 Detail Loss 提示
      const quantRes = res as QuantizationResult
      if (quantRes.detailWarning) {
        setDetailWarning(quantRes.detailWarning)
      }
      if (quantRes.recommendedBoardSize) {
        setRecommendedBoardSize(quantRes.recommendedBoardSize)
      }

      setResult(res)
      setOriginalPattern(res)
      historyRef.current = [res]
      redoRef.current = []
    } catch (e) {
      setError('图纸生成失败，请尝试减小画板尺寸。')
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  // ========== 缺色替换 ==========
  const handleToggleMissing = async (code: string) => {
    const newMissing = new Set(missingCodes)
    if (newMissing.has(code)) {
      newMissing.delete(code)
    } else {
      newMissing.add(code)
    }
    setMissingCodes(newMissing)

    if (result && newMissing.size > 0) {
      const stats = result.stats.filter(s => newMissing.has(s.code))
      const suggestions: ReplacementSuggestion[] = []

      for (const stat of stats) {
        const recs = await findReplacementColors(
          stat.rgb,
          currentPaletteId,
          stat.code
        )
        if (recs.length > 0) {
          const best = recs[0]
          suggestions.push({
            originalCode: stat.code,
            originalName: stat.name,
            originalHex: stat.hex,
            originalRgb: stat.rgb,
            originalCount: stat.count,
            recommendedCode: best.color.code,
            recommendedName: best.color.name,
            recommendedHex: best.color.hex,
            recommendedRgb: best.color.rgb,
            deltaE: best.deltaE,
            difference: best.difference
          })
        }
      }

      setReplacements(suggestions)
    } else {
      setReplacements([])
    }
  }

  const handleReplaceAll = () => {
    if (!result || replacements.length === 0) return

    const replaceMap = new Map<string, string>()
    for (const r of replacements) {
      replaceMap.set(r.originalCode, r.recommendedCode)
    }

    const newGrid = result.grid.map(row =>
      row.map(code => {
        if (code && replaceMap.has(code)) {
          return replaceMap.get(code)!
        }
        return code
      })
    )

    const codeCounts = new Map<string, number>()
    for (const row of newGrid) {
      for (const code of row) {
        if (code) {
          codeCounts.set(code, (codeCounts.get(code) || 0) + 1)
        }
      }
    }

    const total = newGrid.flat().filter(c => c !== null).length
    const newStats = [...codeCounts.entries()].map(([code, count]) => {
      const color = colorMap.get(code)!
      return {
        code: color.code,
        name: color.name || color.code,
        hex: color.hex,
        rgb: color.rgb,
        count,
        percentage: (count / total) * 100
      }
    }).sort((a, b) => b.count - a.count)

    const newResult = {
      ...result,
      grid: newGrid,
      stats: newStats,
      totalBeads: total
    }

    historyRef.current.push(newResult)
    redoRef.current = []
    setResult(newResult)
    setMissingCodes(new Set())
    setReplacements([])
  }

  const handleUndo = () => {
    if (historyRef.current.length > 1) {
      const current = historyRef.current.pop()!
      redoRef.current.push(current)
      const prev = historyRef.current[historyRef.current.length - 1]
      setResult(prev)
      setMissingCodes(new Set())
      setReplacements([])
      setHighlightCode(null)
      setSelectedCells(new Set())
    }
  }

  const handleDownload = async (options: DownloadOptions) => {
    if (!displayResult) return

    const beadPx = BEAD_SIZE_PIXELS[beadSize]
    const result = await exportPNG(displayResult.grid, colorMap, beadPx, options, displayResult.stats)
    setShowDownload(false)

    if (result === 'shared') {
      setToast('保存成功！图片已保存到相册')
    } else if (result === 'downloaded') {
      setToast('保存成功！图片已开始下载')
    } else {
      setToast('已打开图片，长按图片可保存到相册')
    }
    setTimeout(() => setToast(null), 3000)
  }

  const handleToggleExcludeColor = (code: string) => {
    const newExcluded = new Set(excludedColors)
    if (newExcluded.has(code)) {
      newExcluded.delete(code)
    } else {
      newExcluded.add(code)
    }
    setExcludedColors(newExcluded)
  }

  const handleAutoRemoveBackground = () => {
    if (!result) return
    const bgColors = detectBackgroundColors(result.grid)
    if (bgColors.length > 0) {
      setExcludedColors(new Set(bgColors))
    }
  }

  const handleClearExcluded = () => {
    setExcludedColors(new Set())
  }

  // ========== 精修：颜色替换 ==========
  const handleColorReplace = (oldCode: string, newCode: string) => {
    if (!result) return

    const newGrid = result.grid.map(row =>
      row.map(code => code === oldCode ? newCode : code)
    )

    const newResult = recomputeStats(result, newGrid, colorMap)
    pushHistory(newResult, `颜色替换: ${oldCode} → ${newCode}`)
    setResult(newResult)
  }

  // ========== 精修：像素编辑（单格替换） ==========
  const handlePixelEdit = (x: number, y: number, newCode: string) => {
    if (!result) return
    if (result.grid[y]?.[x] === newCode) return

    const newGrid = result.grid.map((row, ry) =>
      ry === y ? row.map((code, rx) => rx === x ? newCode : code) : row
    )

    const newResult = recomputeStats(result, newGrid, colorMap)
    pushHistory(newResult, `像素编辑: (${x},${y}) → ${newCode}`)
    setResult(newResult)
  }

  // ========== 精修：像素编辑（批量替换） ==========
  const handleBatchPixelEdit = (cells: { x: number; y: number }[], newCode: string) => {
    if (!result || cells.length === 0) return
    const cellSet = new Set(cells.map(c => `${c.x},${c.y}`))

    const newGrid = result.grid.map((row, ry) =>
      row.map((code, rx) => cellSet.has(`${rx},${ry}`) ? newCode : code)
    )

    const newResult = recomputeStats(result, newGrid, colorMap)
    pushHistory(newResult, `批量编辑: ${cells.length}格 → ${newCode}`)
    setResult(newResult)
    setSelectedCells(new Set())
  }

  // ========== 精修：选中/取消选中格子 ==========
  const handleToggleCell = (x: number, y: number) => {
    setSelectedCells(prev => {
      const key = `${x},${y}`
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ========== 精修：添加选中格子（拖动连续选中） ==========
  const handleAddToSelection = (x: number, y: number) => {
    setSelectedCells(prev => {
      const key = `${x},${y}`
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  // ========== 精修：清除选中 ==========
  const handleClearSelection = () => setSelectedCells(new Set())

  // ========== 精修：视图复位 ==========
  const handleResetView = () => {
    setResetViewSignal(v => v + 1)
  }

  // ========== 精修：恢复原始图纸 ==========
  const handleRestoreOriginal = () => {
    if (!originalPattern) return
    pushHistory(originalPattern, '恢复原始图纸')
    setResult(originalPattern)
    setRefineMode('none')
    setHighlightCode(null)
    setSelectedCells(new Set())
    setBrushColor(null)
  }

  // ========== 精修：撤销/重做 ==========
  const handleRefineUndo = () => {
    if (historyRef.current.length > 1) {
      const current = historyRef.current.pop()!
      redoRef.current.push(current)
      const prev = historyRef.current[historyRef.current.length - 1]
      setResult(prev)
      setHighlightCode(null)
      setSelectedCells(new Set())
    }
  }

  const handleRefineRedo = () => {
    if (redoRef.current.length > 0) {
      const next = redoRef.current.pop()!
      historyRef.current.push(next)
      setResult(next)
    }
  }

  // ========== 辅助：推入历史记录 ==========
  function pushHistory(newResult: GenerateResult, _label: string) {
    historyRef.current.push(newResult)
    redoRef.current = []
  }

  // ========== 辅助：重新计算统计 ==========
  function recomputeStats(
    base: GenerateResult,
    newGrid: PatternGrid,
    cmap: Map<string, PaletteColor>
  ): GenerateResult {
    const codeCounts = new Map<string, number>()
    for (const row of newGrid) {
      for (const code of row) {
        if (code) codeCounts.set(code, (codeCounts.get(code) || 0) + 1)
      }
    }
    const total = [...codeCounts.values()].reduce((a, b) => a + b, 0)
    const newStats = [...codeCounts.entries()].map(([code, count]) => {
      const color = cmap.get(code)!
      return {
        code: color.code,
        name: color.name || color.code,
        hex: color.hex,
        rgb: color.rgb,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }
    }).sort((a, b) => b.count - a.count)

    const usedColors = newStats
      .map(s => cmap.get(s.code))
      .filter((c): c is PaletteColor => !!c)

    return {
      ...base,
      grid: newGrid,
      stats: newStats,
      totalBeads: total,
      usedColors,
    }
  }

  const canUndo = historyRef.current.length > 1
  const canRedo = redoRef.current.length > 0
  const canRestoreOriginal = originalPattern !== null && historyRef.current.length > 1

  // ========== 移动端布局 ==========
  if (isMobile) {
    return (
      <>
        <MobileLayout
          palettes={palettes}
          currentPaletteId={currentPaletteId}
          onPaletteChange={handlePaletteChange}
          colors={colors}
          colorMap={colorMap}
          imagePreview={imagePreview}
          imageDimensions={imageDimensions}
          fileSize={fileSize}
          onImageUpload={handleImageUpload}
          onImageRemove={handleImageRemove}
          boardSizeId={boardSizeId}
          onBoardSizeChange={handleBoardSizeChange}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          beadSize={beadSize}
          onBeadSizeChange={setBeadSize}
          matchMode={matchMode}
          onMatchModeChange={setMatchMode}
          maxColors={maxColors}
          onMaxColorsChange={setMaxColors}
          dither={dither}
          onDitherChange={setDither}
        debugMode={debugMode}
        onDebugModeChange={setDebugMode}
        onGenerate={handleGenerate}
        canGenerate={!!imageElement}
        displayResult={displayResult}
        result={result}
        loading={loading}
        loadingStep={loadingStep}
        error={error}
        setError={setError}
        showCoordinates={showCoordinates}
        showLegend={showLegend}
        zoom={zoom}
        pan={pan}
        onZoomChange={setZoom}
        onPanChange={setPan}
        onShowCoordinatesChange={setShowCoordinates}
        onShowLegendChange={setShowLegend}
        onUndo={handleUndo}
        canUndo={canUndo}
        onDownload={handleDownload}
        refineMode={refineMode}
        onRefineModeChange={setRefineMode}
        highlightCode={highlightCode}
        onHighlightCodeChange={setHighlightCode}
        onColorReplace={handleColorReplace}
        onPixelEdit={handlePixelEdit}
        onBatchPixelEdit={handleBatchPixelEdit}
        selectedCells={selectedCells}
        onToggleCell={handleToggleCell}
        onAddToSelection={handleAddToSelection}
        onClearSelection={handleClearSelection}
        brushColor={brushColor}
        onBrushColorChange={setBrushColor}
        onResetView={handleResetView}
        onRestoreOriginal={handleRestoreOriginal}
        canRestoreOriginal={canRestoreOriginal}
        canRedo={canRedo}
        onRefineUndo={handleRefineUndo}
        onRefineRedo={handleRefineRedo}
        resetViewSignal={resetViewSignal}
        debugGrid={debugGrid}
        />
        <Toast message={toast} />
      </>
    )
  }

  // ========== 桌面端布局 ==========
  return (
    <>
    <DesktopLayout
      imagePreview={imagePreview}
      imageDimensions={imageDimensions}
      fileSize={fileSize}
      onImageUpload={handleImageUpload}
      onImageRemove={handleImageRemove}
      boardSizeId={boardSizeId}
      onBoardSizeChange={handleBoardSizeChange}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      beadSize={beadSize}
      onBeadSizeChange={setBeadSize}
      palettes={palettes}
      currentPaletteId={currentPaletteId}
      onPaletteChange={handlePaletteChange}
      matchMode={matchMode}
      onMatchModeChange={setMatchMode}
      maxColors={maxColors}
      onMaxColorsChange={setMaxColors}
      colorCount={colors.length}
      dither={dither}
      onDitherChange={setDither}
      debugMode={debugMode}
      onDebugModeChange={setDebugMode}
      onGenerate={handleGenerate}
      canGenerate={!!imageElement}
      displayResult={displayResult}
      result={result}
      colors={colors}
      colorMap={colorMap}
      refineMode={refineMode}
      onRefineModeChange={setRefineMode}
      highlightCode={highlightCode}
      onHighlightCodeChange={setHighlightCode}
      onColorReplace={handleColorReplace}
      onPixelEdit={handlePixelEdit}
      onBatchPixelEdit={handleBatchPixelEdit}
      selectedCells={selectedCells}
      onToggleCell={handleToggleCell}
      onAddToSelection={handleAddToSelection}
      onClearSelection={handleClearSelection}
      brushColor={brushColor}
      onBrushColorChange={setBrushColor}
      onUndo={handleRefineUndo}
      onRedo={handleRefineRedo}
      canUndo={canUndo}
      canRedo={canRedo}
      onResetView={handleResetView}
      onRestoreOriginal={handleRestoreOriginal}
      canRestoreOriginal={canRestoreOriginal}
      resetViewSignal={resetViewSignal}
      showCoordinates={showCoordinates}
      showLegend={showLegend}
      zoom={zoom}
      pan={pan}
      onZoomChange={setZoom}
      onPanChange={setPan}
      onShowCoordinatesChange={setShowCoordinates}
      onShowLegendChange={setShowLegend}
      onUndoCanvas={handleUndo}
      onDownload={handleDownload}
      debugGrid={debugGrid}
      loading={loading}
      loadingStep={loadingStep}
      error={error}
      setError={setError}
      detailWarning={detailWarning}
      setDetailWarning={setDetailWarning}
      recommendedBoardSize={recommendedBoardSize}
      replacements={replacements}
    />
    <Toast message={toast} />
    </>
  )
}

// ============================================================
// Toast 成功提示组件
// ============================================================
function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 bg-accent-teal text-white text-sm font-medium rounded-2xl shadow-elevated animate-fade-in flex items-center gap-2 max-w-[90vw]"
      style={{ pointerEvents: 'none' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span>{message}</span>
    </div>
  )
}
