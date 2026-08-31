import { useRef, useState } from 'react'
import type { DragEvent } from 'react'

interface ImageUploaderProps {
  onUpload: (file: File) => void
  imagePreview: string | null
  imageDimensions: { width: number; height: number } | null
  fileSize: number
  onRemove: () => void
}

export default function ImageUploader({
  onUpload,
  imagePreview,
  imageDimensions,
  fileSize,
  onRemove
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (imagePreview) {
    return (
      <div className="space-y-2">
        <div className="relative group">
          <img
            src={imagePreview}
            alt="预览"
            className="w-full h-40 object-contain rounded-2xl bg-paper shadow-soft"
          />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <button
              onClick={() => inputRef.current?.click()}
              className="w-8 h-8 rounded-full bg-paper-light/90 backdrop-blur-md flex items-center justify-center text-ink-light hover:text-ink shadow-soft transition-all"
              title="替换图片"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button
              onClick={onRemove}
              className="w-8 h-8 rounded-full bg-paper-light/90 backdrop-blur-md flex items-center justify-center text-accent-amber hover:text-accent-amber shadow-soft transition-all"
              title="删除图片"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {imageDimensions && (
          <div className="flex items-center gap-3 text-xs text-ink-lighter">
            <span>{imageDimensions.width} × {imageDimensions.height}px</span>
            <span className="text-ink-lightest">·</span>
            <span>{formatSize(fileSize)}</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`cursor-pointer rounded-2xl transition-all p-8 text-center shadow-soft ${
        isDragging
          ? 'bg-accent-teal/10 ring-2 ring-accent-teal'
          : 'bg-paper-light hover:shadow-card'
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-paper flex items-center justify-center">
          <svg className="text-accent-teal" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
        </div>
        <p className="text-sm font-medium text-ink">上传参考图片</p>
        <p className="text-xs text-ink-lighter">点击或拖拽 · JPG / PNG / WEBP</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
