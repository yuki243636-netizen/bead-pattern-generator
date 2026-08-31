interface LoadingOverlayProps {
  step: string
}

export default function LoadingOverlay({ step }: LoadingOverlayProps) {
  const steps = [
    { key: '分析图像', order: 0 },
    { key: '预处理色卡', order: 1 },
    { key: '颜色匹配', order: 2 },
    { key: '构建网格', order: 3 },
    { key: '统计数量', order: 4 }
  ]

  const currentIdx = steps.findIndex(s => s.key === step)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-paper-light rounded-2xl shadow-card px-8 py-6 min-w-[280px]">
        <div className="flex flex-col items-center gap-4">
          {/* Spinner */}
          <div className="w-8 h-8 border-2 border-paper-dark border-t-accent-teal rounded-full animate-spin" />

          <p className="text-sm font-medium text-ink">生成图纸中…</p>

          {/* Steps */}
          <div className="w-full space-y-1.5">
            {steps.map((s, i) => {
              const isDone = currentIdx > i
              const isActive = currentIdx === i
              return (
                <div key={s.key} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 flex items-center justify-center">
                    {isDone ? (
                      <svg className="text-accent-teal" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : isActive ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-accent-teal animate-pulse-soft" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full border border-paper-dark" />
                    )}
                  </div>
                  <span className={`text-xs ${isDone || isActive ? 'text-ink' : 'text-ink-lightest'}`}>
                    {s.key}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
