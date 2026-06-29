'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragEndEvent, closestCorners, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { KANBAN_COLUMNS } from '@/lib/utils';
import { ContentPlan } from '@/types';
import { useState } from 'react';
import Link from 'next/link';

function KanbanCard({ plan }: { plan: ContentPlan }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plan.id,
    data: { column: plan.kanban_column },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="bg-white rounded-card border border-gray-100 p-3 shadow-sm cursor-grab active:cursor-grabbing">
      <Link href={`/content-plans/${plan.id}`} onClick={e => e.stopPropagation()}>
        <p className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-brand">{plan.title}</p>
      </Link>
      <p className="text-xs text-gray-400 mt-1">{plan.channel}</p>
    </div>
  );
}

export default function KanbanPage() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: plans = [] } = useQuery({
    queryKey: ['content-plans', 'kanban'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('content_plans')
        .select('id, title, channel, status, kanban_column, position_in_kanban')
        .order('kanban_column')
        .order('position_in_kanban');
      return data as ContentPlan[];
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, kanban_column, position_in_kanban }: {
      id: string; kanban_column: string; position_in_kanban: number;
    }) => {
      await fetch(`/api/content-plans/${id}/kanban-move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kanban_column, position_in_kanban }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-plans', 'kanban'] }),
  });

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const newColumn = (over.data.current as { column: string } | undefined)?.column ?? over.id;
    moveMutation.mutate({
      id: active.id as string,
      kanban_column: newColumn as string,
      position_in_kanban: 0,
    });
  }

  const activePlan = activeId ? plans.find(p => p.id === activeId) : null;

  return (
    <div className="p-6 overflow-x-auto">
      <h1 className="text-xl font-semibold mb-6">Kanban Board</h1>
      <DndContext collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 min-w-max pb-4">
          {KANBAN_COLUMNS.map(col => {
            const colPlans = plans.filter(p => p.kanban_column === col.id);
            return (
              <div key={col.id} className="w-64 flex-shrink-0">
                <div className="bg-gray-50 rounded-card p-3 min-h-[400px]">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3">
                    {col.label} <span className="text-gray-400 font-normal">({colPlans.length})</span>
                  </h3>
                  <SortableContext
                    items={colPlans.map(p => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2 min-h-[60px]" data-column={col.id}>
                      {colPlans.map(plan => (
                        <KanbanCard key={plan.id} plan={plan} />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              </div>
            );
          })}
        </div>
        <DragOverlay>
          {activePlan && (
            <div className="bg-white rounded-card border border-brand/30 p-3 shadow-lg w-60 rotate-2">
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{activePlan.title}</p>
              <p className="text-xs text-gray-400 mt-1">{activePlan.channel}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
