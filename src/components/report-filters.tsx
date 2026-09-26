"use client";

import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import type { ReportKind, ReportParams } from "@/lib/reports";
import { usePrefs } from "./prefs";
import { Button } from "./ui/primitives";
import { FieldShell, Segmented, Select, TextInput } from "./ui/client";

type Opt = { id: string; label: string };

export function ReportFilters({
  params,
  kinds,
  vehicles,
  drivers,
  suppliers,
}: {
  params: ReportParams;
  kinds: { value: ReportKind; label: string }[];
  vehicles: Opt[];
  drivers: Opt[];
  suppliers: Opt[];
}) {
  const { locale } = usePrefs();
  const L = (sr: string, en: string) => (locale === "sr" ? sr : en);
  const router = useRouter();

  const query = (next: Partial<ReportParams>) => {
    const p = { ...params, ...next };
    const q = new URLSearchParams({ kind: p.kind, period: p.period });
    if (p.period === "custom") {
      q.set("from", p.from);
      q.set("to", p.to);
    }
    const k = p.kind;
    if (p.vehicle && k !== "payments") q.set("vehicle", p.vehicle);
    if (p.driver && (k === "fuel" || k === "payments")) q.set("driver", p.driver);
    if (p.supplier && k === "services") q.set("supplier", p.supplier);
    if (p.paid && k === "services") q.set("paid", p.paid);
    return q.toString();
  };
  const go = (next: Partial<ReportParams>) => router.replace(`/reports?${query(next)}`, { scroll: false });

  const k = params.kind;
  return (
    <div className="space-y-4 print:hidden">
      <Segmented value={k} onChange={(v) => go({ kind: v })} items={kinds} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px_repeat(4,minmax(0,1fr))_auto] lg:items-end">
        <FieldShell label={L("Period", "Period")} htmlFor="r-period">
          <Select id="r-period" value={params.period} onChange={(e) => go({ period: e.target.value as ReportParams["period"] })}>
            <option value="this_month">{L("Ovaj mesec", "This month")}</option>
            <option value="last_month">{L("Prošli mesec", "Last month")}</option>
            <option value="this_year">{L("Ova godina", "This year")}</option>
            <option value="last_year">{L("Prošla godina", "Last year")}</option>
            <option value="custom">{L("Od – do", "Custom range")}</option>
          </Select>
        </FieldShell>
        {params.period === "custom" && (
          <>
            <FieldShell label={L("Od", "From")} htmlFor="r-from">
              <TextInput id="r-from" type="date" value={params.from} onChange={(e) => e.target.value && go({ from: e.target.value })} />
            </FieldShell>
            <FieldShell label={L("Do", "To")} htmlFor="r-to">
              <TextInput id="r-to" type="date" value={params.to} onChange={(e) => e.target.value && go({ to: e.target.value })} />
            </FieldShell>
          </>
        )}
        {k !== "payments" && (
          <FieldShell label={k === "services" || k === "vehicles" ? L("Vozilo / prikolica", "Vehicle / trailer") : L("Vozilo", "Vehicle")} htmlFor="r-vehicle">
            <Select id="r-vehicle" value={params.vehicle} onChange={(e) => go({ vehicle: e.target.value })}>
              <option value="">{L("Sva", "All")}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
          </FieldShell>
        )}
        {(k === "fuel" || k === "payments") && (
          <FieldShell label={L("Vozač", "Driver")} htmlFor="r-driver">
            <Select id="r-driver" value={params.driver} onChange={(e) => go({ driver: e.target.value })}>
              <option value="">{L("Svi", "All")}</option>
              {drivers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
          </FieldShell>
        )}
        {k === "services" && (
          <>
            <FieldShell label={L("Servis / dobavljač", "Workshop / supplier")} htmlFor="r-supplier">
              <Select id="r-supplier" value={params.supplier} onChange={(e) => go({ supplier: e.target.value })}>
                <option value="">{L("Svi", "All")}</option>
                {suppliers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </FieldShell>
            <FieldShell label={L("Plaćeno", "Paid")} htmlFor="r-paid">
              <Select id="r-paid" value={params.paid} onChange={(e) => go({ paid: e.target.value as ReportParams["paid"] })}>
                <option value="">{L("Sve", "All")}</option>
                <option value="paid">{L("Plaćeno", "Paid")}</option>
                <option value="unpaid">{L("Nije plaćeno", "Unpaid")}</option>
              </Select>
            </FieldShell>
          </>
        )}
        <div className="lg:col-start-6 lg:justify-self-end">
          <Button variant="primary" onClick={() => window.open(`/print/reports?${query({})}`, "_blank", "noopener")}>
            <Printer /> {L("Štampaj / PDF", "Print / PDF")}
          </Button>
        </div>
      </div>
    </div>
  );
}
