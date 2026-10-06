"use client";

import {
  BadgeDollarSign,
  CarFront,
  Handshake,
  LayoutDashboard,
  MessageCircle,
  Settings,
  ShieldCheck,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  CompanySwitcher,
  LogoutButton,
} from "@/components/app-shell/session-controls";
import { BrandLogo } from "@/components/brand-logo";
import { usePreferences } from "@/components/preferences/preferences-provider";
import {
  NotificationBell,
  type HeaderNotification,
} from "@/components/account/notification-bell";

type CompanyOption = { companyId: string; legalName: string };

export function AppShell({
  children,
  userName,
  companyName,
  companyId,
  role,
  companies,
  isPlatformAdmin = false,
  initialNotifications,
  initialUnreadChatCount,
}: {
  children: ReactNode;
  userName: string;
  companyName: string;
  companyId: string;
  role: "admin" | "trader" | "viewer" | "private_customer";
  companies: CompanyOption[];
  isPlatformAdmin?: boolean;
  initialNotifications: HeaderNotification[];
  initialUnreadChatCount: number;
}) {
  const { t } = usePreferences();
  const [unreadChatCount, setUnreadChatCount] = useState(
    initialUnreadChatCount,
  );
  useEffect(() => {
    const update = (event: Event) =>
      setUnreadChatCount(Number((event as CustomEvent<number>).detail) || 0);
    window.addEventListener("trejder-chat-unread", update);
    return () => window.removeEventListener("trejder-chat-unread", update);
  }, []);
  const isPrivateCustomer = role === "private_customer";
  const navigation = isPrivateCustomer
    ? [
        {
          href: "/app/oversikt",
          label: t("nav.overview"),
          icon: LayoutDashboard,
        },
        { href: "/app/bilar/ny", label: t("nav.sellVehicle"), icon: CarFront },
        { href: "/app/bilar", label: t("nav.myListings"), icon: Store },
        { href: "/app/bud", label: t("nav.bids"), icon: BadgeDollarSign },
        {
          href: "/app/chattar",
          label: t("nav.messages"),
          icon: MessageCircle,
          badge: unreadChatCount,
        },
        { href: "/app/affarer", label: t("nav.deals"), icon: Handshake },
        { href: "/app/installningar", label: t("nav.account"), icon: Settings },
      ]
    : [
        { href: "/app/marknad", label: t("nav.marketplace"), icon: Store },
        { href: "/app/bilar", label: t("nav.vehicles"), icon: CarFront },
        {
          href: "/app/chattar",
          label: t("nav.chats"),
          icon: MessageCircle,
          badge: unreadChatCount,
        },
        { href: "/app/affarer", label: t("nav.deals"), icon: Handshake },
        ...(isPlatformAdmin
          ? [{ href: "/admin", label: t("nav.superadmin"), icon: ShieldCheck }]
          : []),
        {
          href: "/app/installningar",
          label: t("nav.settings"),
          icon: Settings,
        },
      ];
  const homeHref = isPrivateCustomer ? "/app/oversikt" : "/app/marknad";
  return (
    <div className="min-h-screen bg-[var(--background)] lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="border-b border-[var(--sidebar-border)] bg-[var(--sidebar)] text-white lg:min-h-screen lg:border-r lg:border-b-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 lg:block lg:px-5 lg:py-6">
          <Link
            href={homeHref}
            aria-label="Trejder"
            className="inline-flex items-center gap-3"
          >
            <BrandLogo compact inverse />
            <span className="hidden text-xl font-semibold tracking-[-0.04em] sm:inline">
              Trejder
            </span>
          </Link>
          <div className="flex items-center gap-2 lg:hidden">
            <NotificationBell
              initialItems={initialNotifications}
              showPushOnboarding
            />
            <LogoutButton compact />
          </div>
          <div className="mt-7 hidden lg:block">
            <CompanySwitcher
              companies={companies}
              selectedCompanyId={companyId}
            />
          </div>
          <nav aria-label="Huvudnavigation" className="mt-6 hidden lg:block">
            <ul className="space-y-1">
              {navigation.map(({ href, label, icon: Icon, badge }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex min-h-11 items-center gap-3 rounded-lg px-3 font-medium text-white/90 transition-colors hover:bg-[var(--surface)]/12 hover:text-white"
                  >
                    <Icon aria-hidden="true" size={19} />
                    <span className="min-w-0 flex-1">{label}</span>
                    {badge ? (
                      <span
                        aria-label={`${badge} olästa`}
                        className="min-w-6 rounded-full bg-white px-1.5 text-center text-xs leading-6 font-bold text-[var(--sidebar)]"
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-8 hidden border-t border-white/15 pt-5 lg:block">
            <div className="min-w-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{userName}</p>
                <p className="truncate text-sm text-white/60">{companyName}</p>
              </div>
            </div>
            <div className="mt-3">
              <LogoutButton compact />
            </div>
          </div>
        </div>
        <nav
          aria-label="Huvudnavigation mobil"
          className="overflow-x-auto border-t border-white/15 lg:hidden"
        >
          <ul className="mx-auto flex max-w-6xl px-2">
            {navigation.map(({ href, label, icon: Icon, badge }) => (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className="relative flex min-h-14 min-w-20 flex-col items-center justify-center gap-0.5 px-2 text-xs font-medium text-white/85 hover:bg-[var(--surface)]/10 hover:text-white"
                >
                  <Icon aria-hidden="true" size={18} />
                  {label}
                  {badge ? (
                    <span
                      aria-label={`${badge} olästa`}
                      className="absolute top-1.5 right-2 min-w-4 rounded-full bg-white px-1 text-[10px] leading-4 font-bold text-[var(--sidebar)]"
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="relative min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <div className="absolute top-6 right-6 z-30 hidden lg:right-10 lg:block">
          <NotificationBell
            initialItems={initialNotifications}
            desktopPlacement="header"
          />
        </div>
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
