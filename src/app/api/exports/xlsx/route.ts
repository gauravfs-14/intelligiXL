import { NextResponse } from "next/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { withErrorHandling } from "@/lib/api/respond";

// The `xlsx` package doesn't bundle cleanly for the browser under Turbopack
// (it statically references `node:module`), so XLSX generation happens here
// server-side; the client only ever downloads the resulting file.
const requestSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  filename: z.string().min(1),
});

export const POST = withErrorHandling(async (req: Request) => {
  const { rows, filename } = requestSchema.parse(await req.json());

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Data");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
