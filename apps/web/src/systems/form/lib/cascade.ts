export function normalizeDependsOn(dependsOn?: string | string[]): string[] {
  if (!dependsOn) return [];
  return Array.isArray(dependsOn) ? dependsOn : [dependsOn];
}

// Names the missing parent, rather than leaving a disabled control with no
// explanation for why it will not open.
export function gatedText(dependsOnList: string[]): string {
  return `Select ${dependsOnList.join(', ')} first`;
}
