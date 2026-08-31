interface BottomActionBarProps {
  onGenerate: () => void
  onDownload: () => void
  canGenerate: boolean
  canDownload: boolean
}

export default function BottomActionBar({
  onGenerate,
  onDownload,
  canGenerate,
  canDownload
}: BottomActionBarProps) {
  return (
    <div className="flex items-center gap-3 px-6 py-3 bg-paper-light flex-shrink-0 shadow-soft">
      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${
          canGenerate
            ? 'text-ink bg-paper hover:bg-paper-dark shadow-soft'
            : 'text-ink-lightest bg-paper-dark cursor-not-allowed'
        }`}
      >
        重新生成
      </button>
      <button
        onClick={onDownload}
        disabled={!canDownload}
        className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
          canDownload
            ? 'text-white bg-accent-teal hover:bg-accent-tealDark shadow-card'
            : 'text-ink-lightest bg-paper-dark cursor-not-allowed'
        }`}
      >
        下载图纸
      </button>
    </div>
  )
}
