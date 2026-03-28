'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Task {
  id: string;
  week: number;
  title: string;
  description: string;
  category: string;
  status: string;
}

interface TaskListProps {
  campaignId: string;
  tasks: Task[];
  currentWeek: number;
}

export function TaskList({ campaignId, tasks, currentWeek }: TaskListProps) {
  const weeks = Array.from({ length: 8 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {weeks.map((week) => {
        const weekTasks = tasks.filter((t) => t.week === week);
        if (weekTasks.length === 0) return null;

        const isCurrentWeek = week === currentWeek;
        const isPastWeek = week < currentWeek;

        return (
          <div key={week} className={`rounded-lg border ${isCurrentWeek ? 'border-primary' : 'border-border'} bg-card`}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${isCurrentWeek ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
              <h4 className="font-medium text-foreground">
                Week {week}
                {isCurrentWeek && <span className="ml-2 text-xs text-primary">(current)</span>}
                {isPastWeek && <span className="ml-2 text-xs text-muted-foreground">(past)</span>}
              </h4>
              <span className="text-xs text-muted-foreground">
                {weekTasks.filter((t) => t.status === 'completed').length}/{weekTasks.length} done
              </span>
            </div>
            <div className="divide-y divide-border/50">
              {weekTasks.map((task) => (
                <TaskRow key={task.id} campaignId={campaignId} task={task} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskRow({ campaignId, task }: { campaignId: string; task: Task }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) router.refresh();
    } finally {
      setUpdating(false);
    }
  };

  const categoryColors: Record<string, string> = {
    analysis: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    'playlist-setup': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    'readiness-check': 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    'release-monitoring': 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    momentum: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
    refresh: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
    'decay-detection': 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    'baseline-reset': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={() => handleStatusChange(task.status === 'completed' ? 'pending' : 'completed')}
        disabled={updating}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
          task.status === 'completed'
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border hover:border-primary'
        }`}
      >
        {task.status === 'completed' && (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {task.title}
        </p>
        <p className="text-xs text-muted-foreground">{task.description}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${categoryColors[task.category] ?? categoryColors['baseline-reset']}`}>
        {task.category}
      </span>
    </div>
  );
}
