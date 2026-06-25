/**
 * Formats an ISO string (YYYY-MM-DDTHH:mm) into a human-friendly date & time format.
 * Example: "2026-06-25T14:30" -> "Jun 25, 2026, 2:30 PM"
 */
export function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Checks the status of a deadline relative to the current time.
 * Returns:
 * - 'overdue': if the deadline has passed (and not completed)
 * - 'soon': if the deadline is within the next 24 hours
 * - 'normal': otherwise
 */
export function getDeadlineStatus(dateStr: string): "overdue" | "soon" | "normal" {
  if (!dateStr) return "normal";
  try {
    const deadlineTime = new Date(dateStr).getTime();
    const now = Date.now();
    
    if (deadlineTime < now) {
      return "overdue";
    }
    
    const oneDayInMs = 24 * 60 * 60 * 1000;
    if (deadlineTime - now <= oneDayInMs) {
      return "soon";
    }
    
    return "normal";
  } catch (e) {
    return "normal";
  }
}

/**
 * Returns a default string for local date-time input (YYYY-MM-DDTHH:mm)
 * corresponding to tomorrow at 9:00 AM or 5:00 PM.
 */
export function getDefaultDeadline(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0); // Default to tomorrow at 9:00 AM
  
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  const hours = String(tomorrow.getHours()).padStart(2, '0');
  const minutes = String(tomorrow.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
