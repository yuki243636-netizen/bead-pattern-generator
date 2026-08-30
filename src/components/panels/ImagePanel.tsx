import ImageUploader from '../ImageUploader'

interface ImagePanelProps {
  imagePreview: string | null
  imageDimensions: { width: number; height: number } | null
  fileSize: number
  onImageUpload: (file: File) => void
  onImageRemove: () => void
}

export default function ImagePanel({
  imagePreview,
  imageDimensions,
  fileSize,
  onImageUpload,
  onImageRemove
}: ImagePanelProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-ink-lighter uppercase tracking-wide">图片</h3>
      <ImageUploader
        onUpload={onImageUpload}
        imagePreview={imagePreview}
        imageDimensions={imageDimensions}
        fileSize={fileSize}
        onRemove={onImageRemove}
      />
      {imagePreview && (
        <p className="text-[10px] text-ink-lightest leading-relaxed">
          重新上传图片后需要重新生成图纸
        </p>
      )}
    </div>
  )
}
