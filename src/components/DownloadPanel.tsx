import { useState } from 'react'
import type { DownloadOptions } from '../types'

interface DownloadPanelProps {
  onDownload: (options: DownloadOptions) => void
  onClose: () => void
}

export default function DownloadPanel({ onDownload, onClose }: DownloadPanelProps) {
  const [includeGrid, setIncludeGrid] = useState(true)
  const [includeCoordinates, setIncludeCoordinates] = useState(false)
  const [includeColorLegend, setIncludeColorLegend] = useState(true)
  const [includeBeadCount, setIncludeBeadCount] = useState(true)

  const handleDownload = () => {
    onDownload({ format: 'png', includeGrid, includeCoordinates, includeColorLegend, includeBeadCount })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-paper-light rounded-2xl shadow-elevated w-[320px] max-w-[90vw] p-5 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-ink">下载图纸 (JPG)</h2>
          <button onClick={onClose} className="text-ink-lighter hover:text-ink">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 高级选项 */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-lighter mb-2 block">选项</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeGrid}
                  onChange={e => setIncludeGrid(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent-teal"
                />
                <span className="text-sm text-ink-light">显示网格</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCoordinates}
                  onChange={e => setIncludeCoordinates(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent-teal"
                />
                <span className="text-sm text-ink-light">显示坐标</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeColorLegend}
                  onChange={e => setIncludeColorLegend(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent-teal"
                />
                <span className="text-sm text-ink-light">颜色图例</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBeadCount}
                  onChange={e => setIncludeBeadCount(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent-teal"
                />
                <span className="text-sm text-ink-light">豆子数量清单</span>
              </label>
            </div>
          </div>

          {/* 下载按钮 */}
          <button
            onClick={handleDownload}
            className="w-full py-2.5 text-sm font-semibold text-white bg-accent-teal rounded-xl hover:bg-accent-tealDark transition-colors mt-2"
          >
            下载 JPG
          </button>
        </div>
      </div>
    </div>
  )
}
