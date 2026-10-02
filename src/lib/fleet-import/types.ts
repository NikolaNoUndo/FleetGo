/** Shapes shared by the Excel fleet import (server) and its dialog (client). */

export type ImportSheet = "employees" | "trailers" | "vehicles";

export type ImportIssue = { level: "error" | "warn"; text: string };

export type PreviewRow = {
  sheet: ImportSheet;
  /** row number in Excel, so people can find it */
  row: number;
  /** plate, or first and last name */
  label: string;
  action: "new" | "update" | "error";
  /** expiry dates that will be added */
  docs: number;
  issues: ImportIssue[];
};

export type SheetSummary = {
  sheet: ImportSheet;
  /** the sheet's name in the file, null when the file has no such sheet */
  name: string | null;
  /** false when this member can't edit that part of the app */
  allowed: boolean;
  added: number;
  updated: number;
  errors: number;
  docs: number;
  /** headers in the file that matched nothing (they are left out) */
  ignored: string[];
};

export type ImportPreview =
  | { ok: true; sheets: SheetSummary[]; rows: PreviewRow[]; docsAllowed: boolean }
  | { ok: false; message: string };

export type ImportResult = { ok: true; added: number; updated: number; docs: number; skipped: number } | { ok: false; message: string };
