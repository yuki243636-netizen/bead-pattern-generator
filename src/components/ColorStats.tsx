import type { ColorStat } from '../types'

interface ColorStatsProps {
  stats: ColorStat[]
  totalBeads: number
}

export default function ColorStats({ stats, totalBeads }: ColorStatsProps) {
  return (
    <div className="space-y-3">
      {/* 总计 */}
      <div className="flex items-baseline gap-4 pb-3 border-b border-paper-darker">
        <div>
          <div className="text-2xl font-bold text-ink">{totalBeads.toLocaleString()}</div>
          <div className="text-[10px] text-ink-lightest uppercase tracking-wide">总豆数</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-ink">{stats.length}</div>
          <div className="text-[10px] text-ink-lightest uppercase tracking-wide">颜色数</div>
        </div>
      </div>

      {/* 颜色列表 */}
      <div className="space-y-1">
        <div className="flex items-center text-[10px] text-ink-lightest uppercase tracking-wide py-1">
          <span className="w-6">色块</span>
          <span className="w-10">编号</span>
          <span className="flex-1">名称</span>
          <span className="w-12 text-right">数量</span>
          <span className="w-12 text-right">占比</span>
        </div>

        {stats.map((stat, i) => (
          <div
            key={stat.code}
            className="flex items-center text-xs py-1.5 rounded-md hover:bg-paper-darker/50 px-1 animate-fade-in"
            style={{ animationDelay: `${i * 20}ms` }}
          >
            <div className="w-6">
              <div
                className="w-5 h-5 rounded border border-paper-darker"
                style={{ backgroundColor: stat.hex }}
              />
            </div>
            <span className="w-10 font-mono text-ink-light">{stat.code}</span>
            <span className="flex-1 text-ink-lighter truncate">{stat.name || stat.code}</span>
            <span className="w-12 text-right font-medium text-ink">{stat.count}</span>
            <span className="w-12 text-right text-ink-lighter">{stat.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
