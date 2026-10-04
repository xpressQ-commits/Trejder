import Link from "next/link";
import { getCurrentPrivateCustomerContext } from "@/app/app/_lib/current-context";
import { listCompanyDeals } from "@/server/deals";
import { listUserNotifications } from "@/server/notifications";
import { listOwnListings } from "@/server/vehicles/listings";
import { NotificationCenter } from "@/components/account/notification-center";
import { countSellerActiveBids } from "@/server/bids";
import { getTranslations } from "@/i18n/server";

export default async function PrivateDashboardPage() {
  const context = await getCurrentPrivateCustomerContext();
  const { t } = await getTranslations();
  const [listings, deals, notifications, activeBids] = await Promise.all([
    listOwnListings(context.company.id),
    listCompanyDeals(context.company.id),
    listUserNotifications(context.user.id),
    countSellerActiveBids(context.company.id),
  ]);
  const active = listings.filter((item) => item.status === "active").length;
  const unreadMessages = notifications.filter(
    (item) => !item.readAt && item.type === "chat.message",
  ).length;
  return (
    <section>
      <p className="text-sm font-semibold text-[var(--primary)]">
        {t("dashboard.privateCustomer")}
      </p>
      <h1 className="mt-1 text-3xl font-semibold">{t("dashboard.title")}</h1>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label={t("dashboard.activeListings")}
          value={active}
          href="/app/bilar"
        />
        <Card
          label={t("dashboard.incomingBids")}
          value={activeBids}
          href="/app/bud"
        />
        <Card
          label={t("dashboard.unreadMessages")}
          value={unreadMessages}
          href="/app/chattar"
        />
        <Card
          label={t("dashboard.deals")}
          value={deals.length}
          href="/app/affarer"
        />
      </div>
      <div className="mt-7">
        <Link
          href="/app/bilar/ny"
          className="inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-4 font-semibold text-white"
        >
          {t("dashboard.sellVehicle")}
        </Link>
      </div>
      <NotificationCenter initialItems={notifications} />
    </section>
  );
}
function Card({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <strong className="mt-2 block text-3xl">{value}</strong>
    </Link>
  );
}
