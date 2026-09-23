import { cn } from "@/lib/utils";
import type { CrosstabResult } from "@/lib/insights/compute";

// FR-034 — cross-tabulation output + a simple heat intensity so patterns
// pop without relying on a gradient fill (flat opacity steps instead).
export function CrosstabTable({ result, labelA, labelB }: { result: CrosstabResult; labelA: string; labelB: string }) {
  const max = Math.max(1, ...result.labelsA.flatMap((a) => result.labelsB.map((b) => result.matrix[a]?.[b] ?? 0)));

  return (
    <div className="overflow-auto border border-border-strong">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border-b border-r border-border-strong bg-surface p-2 text-left">
              <span className="text-muted-foreground">{labelA}</span> \ <span className="text-muted-foreground">{labelB}</span>
            </th>
            {result.labelsB.map((b) => (
              <th key={b} className="border-b border-r border-border bg-surface p-2 text-left font-semibold last:border-r-0">
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.labelsA.map((a) => (
            <tr key={a}>
              <th className="border-r border-b border-border bg-surface p-2 text-left font-semibold">{a}</th>
              {result.labelsB.map((b) => {
                const value = result.matrix[a]?.[b] ?? 0;
                const intensity = value / max;
                return (
                  <td
                    key={b}
                    className={cn("border-r border-b border-border p-2 text-right font-mono last:border-r-0", value > 0 && "text-foreground")}
                    style={{ backgroundColor: value > 0 ? `color-mix(in srgb, var(--color-accent) ${Math.round(intensity * 45)}%, var(--color-surface))` : undefined }}
                  >
                    {value || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
