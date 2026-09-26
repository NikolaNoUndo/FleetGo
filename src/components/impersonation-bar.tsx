import { Eye, LogOut } from "lucide-react";
import { stopImpersonation } from "@/app/admin/actions";

/** Shown while the administrator is viewing the app as a user. */
export function ImpersonationBar({ email, company }: { email: string; company: string }) {
  return (
    <div className="sticky top-0 z-50 flex h-9 items-center justify-center gap-3 bg-accent px-4 text-xs font-medium text-white">
      <Eye />
      <span className="truncate">
        Admin pregled: {email} · {company}
      </span>
      <form action={stopImpersonation}>
        <button type="submit" className="inline-flex h-6 items-center gap-1 rounded-md bg-white/15 px-2 hover:bg-white/25">
          <LogOut size={12} /> Izađi
        </button>
      </form>
    </div>
  );
}
