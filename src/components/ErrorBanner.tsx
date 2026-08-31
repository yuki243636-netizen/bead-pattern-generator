interface ErrorBannerProps {
  message: string
  onClose: () => void
}

export default function ErrorBanner({ message, onClose }: ErrorBannerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-accent-amber/10 shadow-soft animate-fade-in">
      <svg className="flex-shrink-0 text-accent-amber" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <p className="flex-1 text-sm text-ink">{message}</p>
      <button onClick={onClose} className="flex-shrink-0 text-ink-lighter hover:text-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
