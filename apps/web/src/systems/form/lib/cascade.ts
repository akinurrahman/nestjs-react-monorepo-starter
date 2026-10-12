export function normalizeDependsOn(dependsOn?: string | string[]): string[] {
  if (!dependsOn) return [];
  return Array.isArray(dependsOn) ? dependsOn : [dependsOn];
}

// Names the missing parent by its label, rather than leaving a disabled
// control with no explanation for why it will not open. Forms and the filter
// popover both say it this way.
export function gatedText(parentLabels: readonly string[]): string {
  return `Select ${parentLabels.join(', ')} first`;
}
