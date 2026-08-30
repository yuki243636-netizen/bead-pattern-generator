interface HeaderProps {
  onDownload: () => void
  canDownload: boolean
}

export default function Header({ onDownload, canDownload }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-paper-darker bg-paper-light">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-ink flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold text-ink leading-none">甘薯么拼豆</h1>
          <p className="text-[10px] text-ink-lightest mt-0.5 leading-none">Sweet Potato Beads</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onDownload}
          disabled={!canDownload}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            canDownload
              ? 'text-ink hover:bg-paper-darker'
              : 'text-ink-lightest cursor-not-allowed'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          <span className="hidden sm:inline">下载</span>
        </button>
      </div>
    </header>
  )
}
