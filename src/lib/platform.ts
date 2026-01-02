export type ProfileCreationMode = "self_serve" | "admin_only";

export function parseCsvEmails(csv?: string | null): string[] {
  if (!csv) return [];
  return csv.split(",").map(s => s.trim()).filter(Boolean);
}

export function buildWaText(payload: Record<string, any>) {
  const lines: string[] = [];
  if (payload.full_name) lines.push(`Name: ${payload.full_name}`);
  if (payload.phone) lines.push(`Phone: ${payload.phone}`);
  if (payload.email) lines.push(`Email: ${payload.email}`);
  if (payload.event_date) lines.push(`Event Date: ${payload.event_date}`);
  if (payload.event_location) lines.push(`Location: ${payload.event_location}`);
  if (payload.budget_range) lines.push(`Budget: ${payload.budget_range}`);
  if (payload.message) lines.push(`Message: ${payload.message}`);
  return encodeURIComponent("New booking inquiry:\n" + lines.join("\n"));
}
