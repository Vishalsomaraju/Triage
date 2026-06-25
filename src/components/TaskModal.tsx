import React, { useState, useEffect, useRef } from "react";
import { X, Calendar, Clock, AlignLeft } from "lucide-react";
import { Task, EffortEstimate } from "../types";
import { getDefaultDeadline } from "../utils";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: {
    title: string;
    deadline: string;
    effort: EffortEstimate;
    notes: string;
  }) => void;
  task?: Task; // If provided, we are editing this task
}

export default function TaskModal({ isOpen, onClose, onSave, task }: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [effort, setEffort] = useState<EffortEstimate>("30 min");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);

  // Sync state when task changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (task) {
        setTitle(task.title);
        setDeadline(task.deadline || getDefaultDeadline());
        setEffort(task.effort);
        setNotes(task.notes || "");
      } else {
        // Reset to defaults for a new task
        setTitle("");
        setDeadline(getDefaultDeadline());
        setEffort("30 min");
        setNotes("");
      }
      setError("");
    }
  }, [isOpen, task]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a task title.");
      return;
    }
    if (!deadline) {
      setError("Please pick a deadline.");
      return;
    }

    onSave({
      title: title.trim(),
      deadline,
      effort,
      notes: notes.trim(),
    });
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div
      id="task-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/40 backdrop-blur-xs transition-opacity duration-200"
      onClick={handleOverlayClick}
    >
      <div
        id="task-modal-content"
        ref={modalRef}
        className="w-full max-w-lg bg-brand-white rounded-lg shadow-xl overflow-hidden border border-brand-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border bg-brand-bg/50">
          <h2 className="text-lg font-semibold tracking-tight text-brand-dark">
            {task ? "Edit Task" : "New Task"}
          </h2>
          <button
            id="close-modal-btn"
            onClick={onClose}
            className="p-1 text-brand-muted hover:text-brand-dark rounded-full hover:bg-brand-bg/60 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md p-3">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-brand-muted">
              Task Title
            </label>
            <input
              type="text"
              id="task-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prepare presentation slides"
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-md border border-brand-border bg-brand-white text-brand-dark placeholder-brand-muted/70 text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/30 transition-all shadow-xs"
            />
          </div>

          {/* Grid for Deadline & Effort */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Deadline */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                <Calendar size={13} className="text-brand-accent" />
                Deadline
              </label>
              <input
                type="datetime-local"
                id="task-deadline-input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-md border border-brand-border bg-brand-white text-brand-dark text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/30 transition-all shadow-xs"
              />
            </div>

            {/* Effort Estimate */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                <Clock size={13} className="text-brand-accent" />
                Effort Estimate
              </label>
              <select
                id="task-effort-select"
                value={effort}
                onChange={(e) => setEffort(e.target.value as EffortEstimate)}
                className="w-full px-3.5 py-2.5 rounded-md border border-brand-border bg-brand-white text-brand-dark text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/30 transition-all shadow-xs appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%237c726f%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:0.7em_auto] bg-[right_12px_center] bg-no-repeat"
              >
                <option value="30 min">30 min (Quick task)</option>
                <option value="2 hours">2 hours (Medium block)</option>
                <option value="8+ hours">8+ hours (Deep work)</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
              <AlignLeft size={13} className="text-brand-accent" />
              Notes (Optional)
            </label>
            <textarea
              id="task-notes-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add key objectives, specific topics, or sub-tasks..."
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-md border border-brand-border bg-brand-white text-brand-dark placeholder-brand-muted/70 text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/30 transition-all shadow-xs resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-brand-border">
            <button
              type="button"
              id="cancel-modal-btn"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-brand-muted hover:text-brand-dark hover:bg-brand-bg/50 rounded-md transition-all focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-modal-btn"
              className="px-5 py-2 text-sm font-medium text-brand-white bg-brand-accent hover:bg-brand-accent-hover active:scale-[0.98] rounded-md shadow-sm transition-all focus:outline-none"
            >
              {task ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
