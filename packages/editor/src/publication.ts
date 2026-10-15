export interface PublicationIssue {
  code: string;
  message: string;
  severity?: "warning" | "error";
  path?: string;
  bindingId?: string;
}
export function assessPublication(output: { issues: PublicationIssue[] }): {
  allowed: boolean;
  issues: PublicationIssue[];
} {
  const warnings = new Set(["IMAGE_ALT_MISSING", "SOURCE_LOCALE_FALLBACK"]);
  const issues = output.issues.map((issue) => ({
    ...issue,
    severity:
      issue.severity ??
      ((warnings.has(issue.code) ? "warning" : "error") as "warning" | "error"),
  }));
  return {
    allowed: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}
export function assertPublishable(output: {
  issues: PublicationIssue[];
}): void {
  const result = assessPublication(output);
  if (!result.allowed)
    throw new Error(
      "Yayın engellendi: " +
        result.issues
          .filter((issue) => issue.severity === "error")
          .map((issue) => issue.message)
          .join(" "),
    );
}
