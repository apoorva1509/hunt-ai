"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import { Plus } from "lucide-react";

export default function SettingsPage() {
  const { activeAgent, agents } = useAgent();
  const createAgent = useMutation(api.agents.createAgent);
  const updateAgent = useMutation(api.agents.updateAgent);
  const strategies = useQuery(
    api.outreachStrategies.list,
    activeAgent ? { agentId: activeAgent._id } : "skip"
  );

  const [showCreate, setShowCreate] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    type: "job_hunter" as const,
  });

  const handleCreateAgent = async () => {
    if (!newAgent.name) return;
    await createAgent({
      name: newAgent.name,
      type: newAgent.type,
      config: {},
    });
    setNewAgent({ name: "", type: "job_hunter" });
    setShowCreate(false);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Agents section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Agents</h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            <Plus className="h-4 w-4" />
            New Agent
          </button>
        </div>

        {showCreate && (
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex gap-4">
              <input
                type="text"
                value={newAgent.name}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, name: e.target.value })
                }
                placeholder="Agent name"
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <select
                value={newAgent.type}
                onChange={(e) =>
                  setNewAgent({
                    ...newAgent,
                    type: e.target.value as typeof newAgent.type,
                  })
                }
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="job_hunter">Job Hunter</option>
                <option value="outreach_scout">Outreach Scout</option>
                <option value="contact_crafter">Contact Crafter</option>
              </select>
              <button
                onClick={handleCreateAgent}
                className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Create
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {agents?.map((agent) => (
            <div
              key={agent._id}
              className="flex items-center justify-between px-5 py-3"
            >
              <div>
                <p className="font-medium">{agent.name}</p>
                <p className="text-xs text-zinc-500">
                  {agent.type} | {agent.status} | {agent.accessRole}
                </p>
              </div>
              {agent.status === "active" && (
                <button
                  onClick={() =>
                    updateAgent({ agentId: agent._id, status: "paused" })
                  }
                  className="rounded bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                  title="Disable scheduled runs for this agent"
                >
                  Disable
                </button>
              )}
              {agent.status === "paused" && (
                <button
                  onClick={() =>
                    updateAgent({ agentId: agent._id, status: "active" })
                  }
                  className="rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                  title="Enable scheduled runs for this agent"
                >
                  Enable
                </button>
              )}
            </div>
          ))}
          {(!agents || agents.length === 0) && (
            <p className="p-5 text-sm text-zinc-500">
              No agents. Create one above to get started.
            </p>
          )}
        </div>
      </section>

      {/* Strategies section */}
      {activeAgent && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">
            Outreach Strategies ({strategies?.length ?? 0})
          </h2>
          <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {strategies?.map((s: any) => (
              <div key={s._id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-zinc-500">{s.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.channel === "linkedin"
                          ? "bg-blue-100 text-blue-800"
                          : s.channel === "email"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-green-100 text-green-800"
                      }`}
                    >
                      {s.channel}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Angle: {s.angle} | Goal: {s.goal}
                </p>
              </div>
            ))}
            {(!strategies || strategies.length === 0) && (
              <p className="p-5 text-sm text-zinc-500">
                No strategies configured. The runner will use default outreach.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
