import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { sha256 } from "@/lib/auth/crypto";
import { getUserSession } from "@/lib/auth/session";
import { AuthCard, SetPasswordForm } from "@/components/auth-forms";
import { getPrefs } from "@/lib/prefs";

export const metadata: Metadata = { title: "Lozinka" };

export default async function SetPasswordPage(props: PageProps<"/set-password">) {
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : undefined;
  const { locale } = await getPrefs();

  if (token) {
    const [row] = await db
      .select({ email: schema.users.email })
      .from(schema.authTokens)
      .innerJoin(schema.users, eq(schema.users.id, schema.authTokens.userId))
      .where(and(eq(schema.authTokens.id, sha256(token)), isNull(schema.authTokens.usedAt), gt(schema.authTokens.expiresAt, new Date())))
      .limit(1);
    if (!row)
      return (
        <AuthCard title={locale === "sr" ? "Link nije važeći" : "Link is not valid"}>
          <p className="text-sm text-ink-2">
            {locale === "sr"
              ? "Link je istekao ili je već iskorišćen. Zatraži novi od vlasnika firme ili administratora."
              : "This link has expired or was already used. Ask your company owner or the administrator for a new one."}
          </p>
        </AuthCard>
      );
    return <SetPasswordForm token={token} email={row.email} />;
  }

  const s = await getUserSession();
  if (!s) redirect("/login");
  if (!s.user.mustChangePassword) redirect("/");
  return <SetPasswordForm forced email={s.user.email} />;
}
