import { Statement } from "./statement";

export function StatementPreview({ text }: { text: string | null }) {
  if (!text?.trim()) return <p className="small muted">Statement preview unavailable.</p>;
  const opening = text.trim().split(/\n\s*\n/).slice(0, 2).join("\n\n");
  return <div className="statement-preview"><Statement text={opening} /></div>;
}
