import { PlatformChatMonitor } from "@/components/chat/platform-chat-monitor";
import { listPlatformChatThreads } from "@/server/chat";

export const dynamic = "force-dynamic";

export default async function PlatformChatsPage() {
  const threads = await listPlatformChatThreads();
  return <section aria-labelledby="monitor-title">
    <p className="text-sm font-semibold text-[var(--primary)]">Global administration</p>
    <h1 id="monitor-title" className="mt-1 text-3xl font-semibold tracking-tight">Chattövervakning</h1>
    <p className="mt-3 text-[var(--muted)]">Samtliga chattar visas med fullständig företags- och användaridentitet för superadmin.</p>
    <PlatformChatMonitor initialThreads={threads.map((thread) => ({ ...thread, updatedAt: thread.updatedAt.toISOString() }))} />
  </section>;
}
