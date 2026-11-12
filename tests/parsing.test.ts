import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { DatasetFormat } from "@/generated/prisma/client";
import { parseDataset } from "@/lib/parsing";

describe("dataset imports", () => {
  it("preserves quoted CSV fields and infers numeric columns", () => {
    const parsed = parseDataset(Buffer.from('Title,Severity\n"Crash, downtown",3\nParking,1'), DatasetFormat.CSV);
    expect(parsed.rows).toEqual([{ Title: "Crash, downtown", Severity: 3 }, { Title: "Parking", Severity: 1 }]);
    expect(parsed.columns.find((c) => c.name === "Severity")?.dataType).toBe("NUMBER");
  });

  it("reads the selected XLSX sheet and skips an empty cover sheet", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), "Cover");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Title: "Example", Severity: 3 }]), "Records");
    const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    expect(parseDataset(bytes, DatasetFormat.XLSX).rows).toEqual([{ Title: "Example", Severity: 3 }]);
    expect(() => parseDataset(bytes, DatasetFormat.XLSX, { sheet: "Missing" })).toThrow("no sheet");
  });

  it("rejects malformed JSONL rather than silently dropping records", () => {
    expect(() => parseDataset(Buffer.from('{"text":"ok"}\ninvalid'), DatasetFormat.JSONL)).toThrow();
  });
});
