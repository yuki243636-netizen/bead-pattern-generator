interface CanvasEmptyStateProps {
  imagePreview: string | null
  canGenerate: boolean
  onUploadClick: () => void
  onGenerate: () => void
}

export default function CanvasEmptyState({
  imagePreview,
  canGenerate,
  onUploadClick,
  onGenerate
}: CanvasEmptyStateProps) {
  if (imagePreview) {
    return (
      <div className="flex-1 flex items-center justify-center bg-paper p-4 overflow-hidden">
        <div className="text-center max-w-xs space-y-4">
          <img
            src={imagePreview}
            alt="原图预览"
            className="w-full max-w-[240px] mx-auto rounded-xl shadow-soft"
          />
          {canGenerate && (
            <button
              onClick={onGenerate}
              className="px-6 py-3 bg-accent-teal text-white rounded-xl font-medium shadow-soft hover:bg-accent-tealDark transition-colors"
            >
              生成图纸
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-paper p-4 overflow-hidden">
      <div className="text-center max-w-sm space-y-4">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-ink/5 flex items-center justify-center">
          <svg className="text-ink-lighter" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-ink">开始制作拼豆图纸</p>
          <p className="text-sm text-ink-lighter mt-1">上传一张图片，自动生成拼豆图纸</p>
        </div>
        <button
          onClick={onUploadClick}
          className="px-6 py-3 bg-accent-teal text-white rounded-xl font-medium shadow-soft hover:bg-accent-tealDark transition-colors"
        >
          ＋ 上传图片
        </button>
      </div>
    </div>
  )
}
