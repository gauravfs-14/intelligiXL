import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DatasetValidationError } from "@/lib/parsing";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string[],
  ) {
    super(message);
  }
}

export function notFound(what: string): never {
  throw new ApiError(404, `${what} not found.`);
}

/** Wraps a route handler so every failure mode returns a structured JSON
 * error instead of a raw 500 — the UI never has to guess what went wrong. */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
      }
      if (err instanceof DatasetValidationError) {
        return NextResponse.json({ error: err.message, details: err.details }, { status: 422 });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation failed.", details: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
          { status: 422 },
        );
      }
      console.error(err);
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
  };
}
