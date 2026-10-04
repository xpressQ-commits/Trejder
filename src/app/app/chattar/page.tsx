import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";
import { ChatCenter } from "@/components/chat/chat-center";
import { listDealerChatThreads } from "@/server/chat";

export const dynamic = "force-dynamic";

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const context = await getCurrentCompanyContext();
  const threads = await listDealerChatThreads(context.company.id);
  return <ChatCenter
    initialThreads={threads.map((thread) => ({ ...thread, updatedAt: thread.updatedAt.toISOString() }))}
    initialThreadId={(await searchParams).thread}
    canSend={context.membership.role !== "viewer"}
  />;
}
