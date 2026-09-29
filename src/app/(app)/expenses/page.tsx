import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/primitives";
import { SectionTabs } from "@/components/topbar";
import { Stat, StatRow } from "@/components/stat";
import { ExpensesTable } from "@/components/tables/expenses";
import { getT } from "@/lib/prefs";
import { getRefs, listExpenses } from "@/lib/queries";
import { getMoney, monthBounds } from "@/lib/money-server";
import { expenseMonthRows } from "@/lib/expenses";

export const metadata: Metadata = { title: "Ostali troškovi" };

export default async function ExpensesPage() {
  await requireAccess("expenses");
  const [t, rows, { refs, names }, m] = await Promise.all([getT(), listExpenses(), getRefs(), getMoney()]);
  const sr = m.locale === "sr";

  // what falls on each month: spread and shifted costs count in their own months
  const slices = expenseMonthRows(rows);
  const inMonth = (off: number) => {
    const key = monthBounds(off).key;
    return m.sum(slices.filter((s) => s.date.startsWith(key)));
  };
  const cur = inMonth(0);
  const prev = inMonth(-1);
  const monthly = rows.filter((r) => r.recurring && r.recurringNext);
  const unpaid = rows.filter((r) => !r.paid);
  const noPrice = rows.filter((r) => r.amount === null).length;

  return (
    <>
      <PageHeader title={t("p.expenses.title")} sub={t("p.expenses.sub")} tabs={<SectionTabs group="costs" />} />
      <StatRow>
        <Stat
          label={t("c.thisMonth")}
          value={m.fmt(cur)}
          info={
            sr
              ? "Troškovi koji padaju na ovaj mesec: mesečni, raspoređeni i oni koji se računaju od ovog meseca."
              : "Costs that fall on this month: monthly ones, spread ones and those counted from this month."
          }
          sub={noPrice ? (sr ? `${noPrice} bez cene` : `${noPrice} without a price`) : undefined}
        />
        <Stat label={sr ? "Prošli mesec" : "Last month"} value={m.fmt(prev)} />
        <Stat
          label={sr ? "Mesečni fiksni" : "Monthly fixed"}
          value={m.fmt(m.sum(monthly))}
          sub={sr ? `${monthly.length} koji se ponavljaju` : `${monthly.length} repeating`}
          info={sr ? "Zbir troškova označenih sa „Ponavlja se svakog meseca“ koji su još aktivni." : "Sum of the active costs marked “Repeats every month”."}
        />
        <Stat
          label={t("c.unpaid")}
          value={m.fmt(m.sum(unpaid))}
          delta={unpaid.length ? `${unpaid.length} ${sr ? "računa" : "invoices"}` : undefined}
          deltaTone="warn"
        />
      </StatRow>
      <ExpensesTable rows={rows} refs={refs} names={names} />
    </>
  );
}
