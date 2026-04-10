"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface Agent {
  _id: Id<"agents">;
  name: string;
  type: string;
  status: string;
  config: unknown;
  accessRole: string;
}

interface AgentContextValue {
  agents: Agent[] | undefined;
  activeAgent: Agent | undefined;
  setActiveAgentId: (id: Id<"agents">) => void;
  isLoading: boolean;
}

const AgentContext = createContext<AgentContextValue>({
  agents: undefined,
  activeAgent: undefined,
  setActiveAgentId: () => {},
  isLoading: true,
});

export function AgentProvider({ children }: { children: ReactNode }) {
  const agents = useQuery(api.agents.getMyAgents) as Agent[] | undefined;
  const [activeAgentId, setActiveAgentId] = useState<Id<"agents"> | null>(null);

  useEffect(() => {
    if (agents && agents.length > 0 && !activeAgentId) {
      setActiveAgentId(agents[0]._id);
    }
  }, [agents, activeAgentId]);

  const activeAgent = agents?.find((a) => a._id === activeAgentId);

  return (
    <AgentContext.Provider
      value={{
        agents,
        activeAgent,
        setActiveAgentId,
        isLoading: agents === undefined,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  return useContext(AgentContext);
}
