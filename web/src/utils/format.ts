/**
 * Formats a duration in seconds into a human-readable string (e.g., "1h 25m" or "45m").
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0m';
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

/**
 * Formats a duration in seconds into a digital timer format (e.g., "01:25:30" or "45:12").
 */
export function formatTimer(seconds: number): string {
  if (isNaN(seconds)) return '00:00';
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const mStr = String(m).padStart(2, '0');
  const sStr = String(s).padStart(2, '0');

  if (h > 0) {
    const hStr = String(h).padStart(2, '0');
    return `${hStr}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

/**
 * Parses and formats an RSS pubDate string into a readable local date (e.g. "2026 ජූනි 03").
 * Supports simple local English rendering by default, fallback to simple date.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    // Using simple readable English format
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}
