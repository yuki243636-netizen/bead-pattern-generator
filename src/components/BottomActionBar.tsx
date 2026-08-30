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
    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-paper-darker bg-paper-light flex-shrink-0">
      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
          canGenerate
            ? 'text-ink border border-paper-darker hover:bg-paper-darker'
            : 'text-ink-lightest border border-paper-darker cursor-not-allowed'
        }`}
      >
        重新生成
      </button>
      <button
        onClick={onDownload}
        disabled={!canDownload}
        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
          canDownload
            ? 'text-white bg-ink hover:bg-ink-light shadow-soft'
            : 'text-ink-lightest bg-paper-darker cursor-not-allowed'
        }`}
      >
        下载图纸
      </button>
    </div>
  )
}
