import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth/session";
import { userCompanies } from "@/lib/auth/context";
import { CompanyPicker } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Izbor firme" };

export default async function SelectCompanyPage() {
  const s = await getUserSession();
  if (!s) redirect("/login");
  if (s.user.mustChangePassword) redirect("/set-password");
  const companies = (await userCompanies(s.user.id)).filter((c) => c.status === "active");
  return <CompanyPicker email={s.user.email} companies={companies.map((c) => ({ id: c.id, name: c.name, role: c.role }))} />;
}
