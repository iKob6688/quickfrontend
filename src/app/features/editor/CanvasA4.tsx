import { useMemo } from 'react'
import { closestCenter, DndContext, type DragEndEvent, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { AnyBlock, TemplateV1 } from '@/app/core/types/template'
import type { AnyDocumentDTO } from '@/app/core/types/dto'
import type { Branding } from '@/app/core/types/branding'
import { cn } from '@/app/lib/utils'
import { RenderBlock, blockDisplayName } from './BlockRenderer'

type CanvasA4Props = {
  template: TemplateV1
  branding: Branding
  dto: AnyDocumentDTO
  selectedBlockId?: string
  onSelectBlock: (id: string) => void
  onBlocksReorder: (nextIds: string[]) => void
  onAddBlock: (type: AnyBlock['type'], index?: number) => void
}

function snapToGridModifier(grid: number) {
  return ({ transform }: any) => {
    const x = Math.round(transform.x / grid) * grid
    const y = Math.round(transform.y / grid) * grid
    return { ...transform, x, y }
  }
}

function SortableBlock({
  block,
  selected,
  onSelect,
  children,
}: {
  block: AnyBlock
  selected: boolean
  onSelect: () => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: !!block.locked,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative rounded-lg border bg-white p-3 shadow-sm',
        selected ? 'border-sky-500 ring-2 ring-sky-300' : 'border-slate-200',
        isDragging && 'opacity-70',
      )}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <div className="rs-no-print mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-700">{blockDisplayName(block.type)}</div>
        <button
          className={cn(
            'cursor-grab rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 active:cursor-grabbing',
            block.locked && 'cursor-not-allowed opacity-60',
          )}
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          type="button"
        >
          {block.locked ? 'Locked' : 'Drag'}
        </button>
      </div>
      {children}
    </div>
  )
}

function GroupedBlocks({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{left}{right}</div>
}

export function CanvasA4(props: CanvasA4Props) {
  const { template, selectedBlockId, onSelectBlock, onBlocksReorder, onAddBlock } = props
  const blocks = template.blocks
  const isThermal = props.dto?.docType === 'receipt_short' || template.docType === 'receipt_short'

  const ids = useMemo(() => blocks.map((b) => b.id), [blocks])

  const { setNodeRef } = useDroppable({ id: 'canvas', data: { to: 'canvas' } })

  const handleDragEnd = (evt: DragEndEvent) => {
    const { active, over } = evt
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith('palette:')) {
      const blockType = active.data.current?.blockType as AnyBlock['type'] | undefined
      if (!blockType) return
      const overIndex = blocks.findIndex((b) => b.id === overId)
      const insertAt = overId === 'canvas' || overIndex === -1 ? blocks.length : overIndex
      onAddBlock(blockType, insertAt)
      return
    }

    if (activeId === overId) return
    const oldIndex = blocks.findIndex((b) => b.id === activeId)
    const newIndex = blocks.findIndex((b) => b.id === overId)
    if (oldIndex === -1 || newIndex === -1) return

    const next = arrayMove(ids, oldIndex, newIndex)
    onBlocksReorder(next)
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[snapToGridModifier(template.page.gridPx)]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className="relative mx-auto rounded-xl border border-slate-200 bg-white shadow-sm"
          style={{ width: template.page.canvasPx.width, minHeight: template.page.canvasPx.height }}
          onClick={() => onSelectBlock('')}
        >
          {/* Margin guides */}
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute border border-dashed border-slate-200"
              style={{
                left: 38,
                top: 38,
                right: 38,
                bottom: 38,
              }}
            />
          </div>

          <div className="space-y-3 p-6" style={{ fontFamily: props.branding.defaultFont }}>
            <div className={isThermal ? 'mx-auto' : undefined} style={isThermal ? { maxWidth: 360 } : undefined}>
              {blocks.map((b, idx) => {
                const next = blocks[idx + 1]
                // Render customerInfo + docMeta side-by-side when adjacent
                if (b.type === 'customerInfo' && next?.type === 'docMeta') {
                  const left = (
                    <SortableBlock
                      key={b.id}
                      block={b}
                      selected={selectedBlockId === b.id}
                      onSelect={() => onSelectBlock(b.id)}
                    >
                      <RenderBlock block={b} branding={props.branding} dto={props.dto} theme={template.theme} />
                    </SortableBlock>
                  )
                  const right = (
                    <SortableBlock
                      key={next.id}
                      block={next}
                      selected={selectedBlockId === next.id}
                      onSelect={() => onSelectBlock(next.id)}
                    >
                      <RenderBlock block={next} branding={props.branding} dto={props.dto} theme={template.theme} />
                    </SortableBlock>
                  )
                  return <GroupedBlocks key={`${b.id}:${next.id}`} left={left} right={right} />
                }
                // If previous is customerInfo and this is docMeta, it has already been rendered by group.
                if (idx > 0 && blocks[idx - 1]?.type === 'customerInfo' && b.type === 'docMeta') return null

                return (
                  <SortableBlock
                    key={b.id}
                    block={b}
                    selected={selectedBlockId === b.id}
                    onSelect={() => onSelectBlock(b.id)}
                  >
                    <RenderBlock block={b} branding={props.branding} dto={props.dto} theme={template.theme} />
                  </SortableBlock>
                )
              })}
            </div>
          </div>
        </div>
      </SortableContext>
    </DndContext>
  )
}


