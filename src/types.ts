export type EffortEstimate = "30 min" | "2 hours" | "8+ hours";

export interface Task {
  id: string;
  title: string;
  deadline: string; // ISO 8601 string or YYYY-MM-DDTHH:mm for datetime-local input compatibility
  effort: EffortEstimate;
  notes?: string;
  completed: boolean;
  createdAt: string; // ISO 8601 string
  userId: string;
}
