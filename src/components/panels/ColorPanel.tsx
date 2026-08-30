import type { Palette, MatchMode } from '../../types'

interface ColorPanelProps {
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
}

export default function ColorPanel({
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
  onDebugModeChange
}: ColorPanelProps) {
  const currentPalette = palettes.find(p => p.id === currentPaletteId)

  return (
    <div className="space-y-5">
      <h3 className="text-xs font-semibold text-ink-lighter uppercase tracking-wide">色卡</h3>

      {/* 色卡选择 */}
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
          <div className="space-y-1">
            <p className="text-[10px] text-ink-lightest leading-relaxed">
              {currentPalette.description || `${currentPalette.brand} 色卡`}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-ink-lighter">品牌:</span>
              <span className="text-[10px] font-medium text-ink">{currentPalette.brand}</span>
              <span className="text-[10px] text-ink-lightest ml-auto">{colorCount} 色</span>
            </div>
          </div>
        )}
      </div>

      {/* 颜色匹配 */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold text-ink-lighter uppercase tracking-wide">颜色匹配</h3>
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
    </div>
  )
}
