import { BOARD_SIZES, type BoardSizeId } from '../SettingsPanel'

interface BoardPanelProps {
  boardSizeId: BoardSizeId
  onBoardSizeChange: (id: BoardSizeId) => void
  canvasWidth: number
  canvasHeight: number
}

export default function BoardPanel({
  boardSizeId,
  onBoardSizeChange,
  canvasWidth,
  canvasHeight
}: BoardPanelProps) {
  return (
    <div className="space-y-5">
      <h3 className="text-xs font-semibold text-ink-lighter uppercase tracking-wide">板型</h3>

      {/* 板型选择 */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          {BOARD_SIZES.map(board => (
            <button
              key={board.id}
              onClick={() => onBoardSizeChange(board.id)}
              className={`px-2.5 py-2.5 rounded-xl transition-all text-left ${
                boardSizeId === board.id
                  ? 'bg-accent-teal text-white'
                  : 'bg-paper text-ink-lighter hover:bg-paper-dark shadow-soft'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{board.name}</span>
                <span className={`text-[9px] ${boardSizeId === board.id ? 'text-white/70' : 'text-ink-lightest'}`}>
                  {board.width}×{board.height}
                </span>
              </div>
              <div className={`text-[9px] mt-0.5 ${boardSizeId === board.id ? 'text-white/60' : 'text-ink-lightest'}`}>
                {board.desc}
              </div>
            </button>
          ))}
        </div>

        {/* 当前尺寸信息 */}
        <div className="flex items-center gap-2 px-2 py-1.5 bg-paper rounded-xl shadow-soft">
          <span className="text-[10px] text-ink-lighter">实际图纸:</span>
          <span className="text-xs font-semibold text-ink">{canvasWidth}×{canvasHeight}</span>
          <span className="text-[10px] text-ink-lightest">格</span>
          <span className="ml-auto text-[10px] text-ink-lightest">
            ≈{(canvasWidth * 0.5).toFixed(0)}×{(canvasHeight * 0.5).toFixed(0)}cm
          </span>
        </div>
      </div>
    </div>
  )
}
