import { AgentProvider } from "@/components/providers/agent-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AgentProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </AgentProvider>
  );
}
