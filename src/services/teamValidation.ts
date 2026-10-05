export interface TeamValidationResult {
  valid: boolean;
  format: string;
  showdownFormat: string;
  problems: string[];
}

export async function validateShowdownTeam(
  team: string,
  format: string,
  signal?: AbortSignal,
): Promise<TeamValidationResult> {
  const response = await fetch("/api/teams/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ team, format }),
    signal,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The team validation service returned an unreadable response.");
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || "Unable to validate the team. Please try again.");
  }
  if (
    typeof data?.valid !== "boolean" || data.format !== format ||
    typeof data.showdownFormat !== "string" || !Array.isArray(data.problems) ||
    !data.problems.every((problem) => typeof problem === "string") ||
    data.valid !== (data.problems.length === 0)
  ) {
    throw new Error("The team validation service returned an invalid response.");
  }
  return data;
}
