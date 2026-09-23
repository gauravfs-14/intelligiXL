import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CrosstabResult } from "@/lib/insights/compute";

// FR-034 — cross-tabulation output + a simple heat intensity so patterns
// pop without relying on a gradient fill (flat opacity steps instead).
export function CrosstabTable({ result, labelA, labelB }: { result: CrosstabResult; labelA: string; labelB: string }) {
  const max = Math.max(1, ...result.labelsA.flatMap((a) => result.labelsB.map((b) => result.matrix[a]?.[b] ?? 0)));

  return (
    <div className="overflow-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-muted-foreground">
              {labelA} <span className="text-border">\</span> {labelB}
            </TableHead>
            {result.labelsB.map((b) => (
              <TableHead key={b} className="font-semibold text-foreground">
                {b}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.labelsA.map((a) => (
            <TableRow key={a}>
              <TableCell className="font-semibold text-foreground">{a}</TableCell>
              {result.labelsB.map((b) => {
                const value = result.matrix[a]?.[b] ?? 0;
                const intensity = value / max;
                return (
                  <TableCell
                    key={b}
                    className={cn("text-right font-mono transition-colors", value > 0 && "text-foreground")}
                    style={{
                      backgroundColor:
                        value > 0 ? `color-mix(in srgb, var(--color-primary) ${Math.round(intensity * 30)}%, transparent)` : undefined,
                    }}
                  >
                    {value || ""}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
