const LINKED_ENTITY_PATTERN =
  /\{\{(?:plan|activity):[^|}]+\|([^}]+)\}\}/g;

export function formatCoachMessagePreview(content: string): string {
  return content
    .replace(LINKED_ENTITY_PATTERN, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
