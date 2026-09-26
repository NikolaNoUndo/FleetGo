import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Prijava" };

export default async function LoginPage() {
  if (await getContext()) redirect("/");
  return <LoginForm />;
}
