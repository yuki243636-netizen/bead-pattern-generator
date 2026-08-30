import type { ColorStat, ReplacementSuggestion } from '../types'

interface ColorReplacementProps {
  stats: ColorStat[]
  missingCodes: Set<string>
  replacements: ReplacementSuggestion[]
  onToggleMissing: (code: string) => void
  onReplaceAll: () => void
}

const diffLabel: Record<string, { text: string; color: string }> = {
  low: { text: '低', color: 'text-green-600' },
  medium: { text: '中', color: 'text-amber-600' },
  high: { text: '高', color: 'text-red-500' }
}

export default function ColorReplacement({
  stats,
  missingCodes,
  replacements,
  onToggleMissing,
  onReplaceAll
}: ColorReplacementProps) {
  return (
    <div className="space-y-3 mt-4 pt-4 border-t border-paper-darker">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-ink-lighter uppercase tracking-wide">缺色替换</h3>
        {replacements.length > 0 && (
          <button
            onClick={onReplaceAll}
            className="px-2.5 py-1 text-xs font-medium text-white bg-ink rounded-lg hover:bg-ink-light transition-colors"
          >
            全部替换
          </button>
        )}
      </div>

      <p className="text-[10px] text-ink-lightest leading-relaxed">
        标记你没有的颜色，系统会自动推荐最接近的替代色
      </p>

      {/* 颜色列表（可标记缺色） */}
      <div className="space-y-1">
        {stats.map(stat => {
          const isMissing = missingCodes.has(stat.code)
          const suggestion = replacements.find(r => r.originalCode === stat.code)
          return (
            <div
              key={stat.code}
              className={`flex items-center gap-2 py-1.5 px-1 rounded-md transition-colors ${
                isMissing ? 'bg-red-50/50' : 'hover:bg-paper-darker/50'
              }`}
            >
              {/* 色块 */}
              <div
                className={`w-5 h-5 rounded border border-paper-darker flex-shrink-0 ${
                  isMissing ? 'opacity-40' : ''
                }`}
                style={{ backgroundColor: stat.hex }}
              />

              {/* 编号 + 名称 */}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-mono text-[11px] text-ink-light">{stat.code}</span>
                <span className="text-[10px] text-ink-lightest truncate">
                  {stat.name || stat.code} · {stat.count}颗
                </span>
              </div>

              {/* 替换建议 */}
              {suggestion && (
                <div className="flex items-center gap-1.5 ml-1 flex-shrink-0">
                  <svg className="text-ink-lightest" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <div
                    className="w-4 h-4 rounded border border-paper-darker"
                    style={{ backgroundColor: suggestion.recommendedHex }}
                  />
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] text-ink-light">
                      {suggestion.recommendedCode}
                    </span>
                    <span className="text-[9px] text-ink-lightest truncate max-w-[60px]">
                      {suggestion.recommendedName}
                    </span>
                  </div>
                  <span className={`text-[10px] font-medium ${diffLabel[suggestion.difference].color}`}>
                    {diffLabel[suggestion.difference].text}
                  </span>
                </div>
              )}

              {/* 标记按钮 */}
              <button
                onClick={() => onToggleMissing(stat.code)}
                className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  isMissing
                    ? 'bg-red-100 text-red-600'
                    : 'text-ink-lighter hover:bg-paper-darker'
                }`}
              >
                {isMissing ? '缺色' : '有'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
