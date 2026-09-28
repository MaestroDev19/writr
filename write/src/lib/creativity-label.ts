export type CreativityWorkflow = "generate" | "critique"

export interface CreativityLabel {
  label: string
  description: string
  badgeClass: string
}

/**
 * Shared creativity / temperature descriptor for Write, Review, and Settings.
 */
export function getCreativityLabel(
  temp: number,
  workflow: CreativityWorkflow = "generate"
): CreativityLabel {
  if (temp <= 0.3) {
    return {
      label: "Careful",
      badgeClass: "border-border bg-muted text-foreground",
      description:
        workflow === "critique"
          ? "Steady, consistent feedback."
          : "Stays close to your instructions.",
    }
  }
  if (temp <= 0.6) {
    return {
      label: "Balanced",
      badgeClass: "border-border bg-muted text-foreground",
      description: "Natural voice with steady pacing.",
    }
  }
  if (temp <= 0.9) {
    return {
      label: "Expressive",
      badgeClass: "border-border bg-muted text-foreground",
      description:
        workflow === "generate"
          ? "Richer detail and varied rhythm."
          : "More creative edit suggestions.",
    }
  }
  return {
    label: "Bold",
    badgeClass: "border-border bg-muted text-foreground",
    description: "More creative freedom. Results vary more.",
  }
}
