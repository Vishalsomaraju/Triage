import { useState } from "react";
import { Task } from "../types";
import { formatFriendlyDate, getDeadlineStatus } from "../utils";
import { Edit2, Trash2, Calendar, Clock, Check } from "lucide-react";

interface TaskItemProps {
  key?: string;
  task: Task;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export default function TaskItem({ task, onToggleComplete, onEdit, onDelete }: TaskItemProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deadlineStatus = getDeadlineStatus(task.deadline);
  
  // Custom styling for deadline based on state and completion
  const getDeadlineStyle = () => {
    if (task.completed) return "text-brand-muted/50 line-through";
    if (deadlineStatus === "overdue") return "text-rose-600 font-medium";
    if (deadlineStatus === "soon") return "text-brand-accent font-medium";
    return "text-brand-muted";
  };

  return (
    <div
      id={`task-item-${task.id}`}
      className={`group relative flex flex-col md:flex-row md:items-center justify-between p-5 gap-4 bg-brand-white rounded-lg border transition-all ${
        task.completed
          ? "border-brand-border/60 bg-brand-white/60 opacity-75"
          : "border-brand-border hover:shadow-xs hover:border-brand-accent/50"
      }`}
    >
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        {/* Toggle Checkbox Button */}
        <button
          id={`toggle-complete-btn-${task.id}`}
          onClick={() => onToggleComplete(task)}
          className={`mt-1 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all focus:outline-none ${
            task.completed
              ? "bg-brand-accent/20 border border-brand-accent text-brand-accent"
              : "border border-brand-border hover:border-brand-accent text-transparent hover:text-brand-accent/40"
          }`}
          title={task.completed ? "Mark Incomplete" : "Mark Complete"}
        >
          <Check size={14} strokeWidth={3} className={task.completed ? "scale-100" : "scale-0"} />
        </button>

        {/* Task Details */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3
              id={`task-title-${task.id}`}
              className={`text-sm font-semibold tracking-tight text-brand-dark break-words ${
                task.completed ? "line-through text-brand-muted/60" : ""
              }`}
            >
              {task.title}
            </h3>
            
            {/* Effort Badge */}
            <span
              id={`task-effort-${task.id}`}
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                task.completed
                  ? "bg-brand-bg/40 text-brand-muted/50"
                  : "bg-brand-accent/10 text-brand-accent"
              }`}
            >
              <Clock size={10} />
              {task.effort}
            </span>
          </div>

          {/* Deadline Row */}
          <div className={`flex items-center gap-1.5 text-xs ${getDeadlineStyle()}`}>
            <Calendar size={12} className="opacity-80" />
            <span>
              {task.completed ? "Completed" : "Due"}: {formatFriendlyDate(task.deadline)}
            </span>
            {!task.completed && deadlineStatus === "overdue" && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-rose-50 text-rose-600 rounded">
                Overdue
              </span>
            )}
            {!task.completed && deadlineStatus === "soon" && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-brand-accent/10 text-brand-accent rounded">
                Soon
              </span>
            )}
          </div>

          {/* Optional Notes */}
          {task.notes && (
            <p
              id={`task-notes-${task.id}`}
              className={`text-xs text-brand-muted mt-2 pl-0.5 border-l-2 border-brand-border/70 break-words max-w-2xl whitespace-pre-line leading-relaxed ${
                task.completed ? "opacity-60 text-brand-muted/50" : ""
              }`}
            >
              {task.notes}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons & Confirmation Prompt */}
      <div className="flex items-center gap-1 self-end md:self-center bg-brand-white pl-2">
        {isConfirmingDelete ? (
          <div className="flex items-center gap-2 text-xs" id={`delete-confirm-box-${task.id}`}>
            <span className="text-rose-600 font-medium">Delete?</span>
            <button
              id={`confirm-delete-yes-${task.id}`}
              onClick={() => {
                onDelete(task.id);
                setIsConfirmingDelete(false);
              }}
              className="px-2 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded transition-colors cursor-pointer"
            >
              Yes
            </button>
            <button
              id={`confirm-delete-no-${task.id}`}
              onClick={() => setIsConfirmingDelete(false)}
              className="px-2 py-1 text-xs font-semibold bg-brand-bg hover:bg-brand-border text-brand-dark rounded transition-colors cursor-pointer"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 md:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
            <button
              id={`edit-task-btn-${task.id}`}
              onClick={() => onEdit(task)}
              className="p-1.5 text-brand-muted hover:text-brand-dark rounded-md hover:bg-brand-bg transition-colors focus:outline-none"
              title="Edit Task"
            >
              <Edit2 size={15} />
            </button>
            <button
              id={`delete-task-btn-${task.id}`}
              onClick={() => setIsConfirmingDelete(true)}
              className="p-1.5 text-brand-muted hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors focus:outline-none"
              title="Delete Task"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
