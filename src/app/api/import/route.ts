import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { getPrefs } from "@/lib/prefs";
import { MAX_FILE_BYTES, commitImport, previewImport } from "@/lib/fleet-import/server";

export const dynamic = "force-dynamic";

/**
 * The filled-in workbook. mode=preview says what would happen; mode=commit reads the
 * same file again and writes it, so nothing the browser sends is trusted as data.
 */
export async function POST(req: Request) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  const { locale } = await getPrefs();
  const sr = locale === "sr";
  if (!(["vehicles", "trailers", "employees"] as const).some((m) => can(ctx.perms, m, "edit"))) {
    return NextResponse.json({ ok: false, message: sr ? "Nemaš pravo da dodaješ vozila, prikolice ni zaposlene." : "You can't add vehicles, trailers or employees." }, { status: 403 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, message: sr ? "Fajl nije stigao." : "No file received." }, { status: 400 });
  }
  const file = form.get("file");
  const mode = form.get("mode") === "commit" ? "commit" : "preview";
  if (!(file instanceof File) || !file.size) return NextResponse.json({ ok: false, message: sr ? "Izaberi fajl." : "Choose a file." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, message: sr ? "Fajl je veći od 5 MB." : "The file is larger than 5 MB." }, { status: 400 });
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    return NextResponse.json({ ok: false, message: sr ? "Potreban je Excel fajl (.xlsx). Stari .xls sačuvaj kao .xlsx." : "An Excel file (.xlsx) is needed. Save an old .xls as .xlsx." }, { status: 400 });
  }
  const buf = await file.arrayBuffer();
  if (mode === "preview") return NextResponse.json(await previewImport(buf, ctx.company.id, ctx.perms, locale));

  try {
    const res = await commitImport(buf, ctx.company.id, ctx.perms, locale);
    if (res.ok) {
      await audit(ctx.user.email, "import.fleet", { added: res.added, updated: res.updated, docs: res.docs, skipped: res.skipped, file: file.name.slice(0, 120) }, ctx.company.id);
      revalidatePath("/", "layout");
    }
    return NextResponse.json(res);
  } catch (e) {
    console.error("fleet import failed", e);
    return NextResponse.json({ ok: false, message: sr ? "Upis nije uspeo, ništa nije sačuvano. Pokušaj ponovo." : "Saving failed, nothing was saved. Try again." }, { status: 500 });
  }
}
