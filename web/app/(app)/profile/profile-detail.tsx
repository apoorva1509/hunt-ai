"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  Plus,
  X,
  MapPin,
  Globe2,
  Code2,
  Filter,
} from "lucide-react";
import type { ProfileDetail, SourceId } from "./types";
import { ALL_SOURCES, SOURCE_NAMES } from "./types";

export function ProfileDetailView({
  profile,
  onBack,
  onRefresh,
}: {
  profile: ProfileDetail;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [data, setData] = useState(profile);
  const [showRawYaml, setShowRawYaml] = useState(false);
  const [addKeywordType, setAddKeywordType] = useState<
    "positive" | "negative" | null
  >(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationDraft, setLocationDraft] = useState(data.location);
  const [saving, setSaving] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    const key = JSON.stringify(body);
    setSaving(key);
    try {
      const res = await fetch("/api/search-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: data.slug, ...body }),
      });
      if (res.ok) {
        const updated = await res.json();
        setData((prev) => ({
          ...prev,
          titleFilter: updated.titleFilter ?? prev.titleFilter,
          sources: updated.sources ?? prev.sources,
          location: updated.location ?? prev.location,
          remote: updated.remote ?? prev.remote,
          companyFilter: updated.companyFilter ?? prev.companyFilter,
          pipelineSettings: updated.pipelineSettings ?? prev.pipelineSettings,
        }));
        onRefresh();
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{data.slug}</h2>
            {data.active && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Active
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">
            {data.sources.length}/{ALL_SOURCES.length} sources | {data.location}
            {data.remote ? " (remote)" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowRawYaml(!showRawYaml)}
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <Code2 className="h-3.5 w-3.5" />
          {showRawYaml ? "Hide YAML" : "Raw YAML"}
        </button>
      </div>

      {showRawYaml && (
        <pre className="max-h-[400px] overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {data.rawContent}
        </pre>
      )}

      {/* Location & Remote */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Location
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <MapPin className="h-4 w-4 text-zinc-400" />
            {editingLocation ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={locationDraft}
                  onChange={(e) => setLocationDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      patch({ action: "setLocation", location: locationDraft });
                      setEditingLocation(false);
                    }
                    if (e.key === "Escape") setEditingLocation(false);
                  }}
                  className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  autoFocus
                />
                <button
                  onClick={() => {
                    patch({ action: "setLocation", location: locationDraft });
                    setEditingLocation(false);
                  }}
                  className="rounded bg-zinc-900 px-2 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setLocationDraft(data.location);
                  setEditingLocation(true);
                }}
                className="text-sm font-medium hover:underline"
              >
                {data.location || "Not set"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 border-l border-zinc-200 pl-4 dark:border-zinc-700">
            <Globe2 className="h-4 w-4 text-zinc-400" />
            <span className="text-sm text-zinc-500">Remote</span>
            <button
              onClick={() => patch({ action: "setRemote", remote: !data.remote })}
              disabled={saving !== null}
            >
              {data.remote ? (
                <ToggleRight className="h-5 w-5 text-green-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-zinc-300" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sources */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Job Sources ({data.sources.length}/{ALL_SOURCES.length})
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {ALL_SOURCES.map((sourceId) => {
            const enabled = data.sources.includes(sourceId);
            return (
              <button
                key={sourceId}
                onClick={() =>
                  patch({ action: "toggleSource", source: sourceId, enabled: !enabled })
                }
                disabled={saving !== null}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  enabled
                    ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
                    : "border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                {enabled ? (
                  <ToggleRight className="h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <ToggleLeft className="h-4 w-4 shrink-0 text-zinc-300" />
                )}
                <span className="text-sm font-medium">
                  {SOURCE_NAMES[sourceId]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pipeline Settings */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <Filter className="mr-1.5 inline h-4 w-4 text-zinc-400" />
          Score Threshold
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Filter by score</span>
            <button
              onClick={() =>
                patch({
                  action: "setFilterByScore",
                  enabled: !data.pipelineSettings.filter_by_score,
                })
              }
              disabled={saving !== null}
            >
              {data.pipelineSettings.filter_by_score ? (
                <ToggleRight className="h-5 w-5 text-green-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-zinc-300" />
              )}
            </button>
          </div>
          {data.pipelineSettings.filter_by_score && (
            <div className="flex items-center gap-2 border-l border-zinc-200 pl-4 dark:border-zinc-700">
              <span className="text-sm text-zinc-500">Min score</span>
              <input
                type="number"
                min={0}
                max={100}
                value={data.pipelineSettings.min_score}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 0 && val <= 100) {
                    setData((prev) => ({
                      ...prev,
                      pipelineSettings: { ...prev.pipelineSettings, min_score: val },
                    }));
                  }
                }}
                onBlur={() =>
                  patch({
                    action: "setMinScore",
                    minScore: data.pipelineSettings.min_score,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    patch({
                      action: "setMinScore",
                      minScore: data.pipelineSettings.min_score,
                    });
                  }
                }}
                className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-center text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <span className="text-xs text-zinc-400">/ 100</span>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {data.pipelineSettings.filter_by_score
            ? `Jobs scoring below ${data.pipelineSettings.min_score} will be skipped. Leads are only created for higher-scoring matches.`
            : "All scored jobs will become leads regardless of score. You can review and skip low-fit ones manually."}
        </p>
      </div>

      {/* Positive Keywords */}
      <KeywordSection
        title="Positive Keywords"
        description="Job titles must contain at least one of these"
        keywords={data.titleFilter.positive}
        onRemove={(kw) =>
          patch({ action: "removeKeyword", type: "positive", keyword: kw })
        }
        onAdd={(kw) =>
          patch({ action: "addKeyword", type: "positive", keyword: kw })
        }
        addOpen={addKeywordType === "positive"}
        onToggleAdd={() =>
          setAddKeywordType(addKeywordType === "positive" ? null : "positive")
        }
        newKeyword={addKeywordType === "positive" ? newKeyword : ""}
        setNewKeyword={setNewKeyword}
        saving={saving}
        color="green"
      />

      {/* Negative Keywords */}
      <KeywordSection
        title="Negative Keywords"
        description="Job titles containing these are excluded"
        keywords={data.titleFilter.negative}
        onRemove={(kw) =>
          patch({ action: "removeKeyword", type: "negative", keyword: kw })
        }
        onAdd={(kw) =>
          patch({ action: "addKeyword", type: "negative", keyword: kw })
        }
        addOpen={addKeywordType === "negative"}
        onToggleAdd={() =>
          setAddKeywordType(addKeywordType === "negative" ? null : "negative")
        }
        newKeyword={addKeywordType === "negative" ? newKeyword : ""}
        setNewKeyword={setNewKeyword}
        saving={saving}
        color="red"
      />
    </div>
  );
}

function KeywordSection({
  title,
  description,
  keywords,
  onRemove,
  onAdd,
  addOpen,
  onToggleAdd,
  newKeyword,
  setNewKeyword,
  saving,
  color,
}: {
  title: string;
  description: string;
  keywords: string[];
  onRemove: (kw: string) => void;
  onAdd: (kw: string) => void;
  addOpen: boolean;
  onToggleAdd: () => void;
  newKeyword: string;
  setNewKeyword: (v: string) => void;
  saving: string | null;
  color: "green" | "red";
}) {
  const styles = {
    green: {
      bg: "bg-green-50 dark:bg-green-950",
      text: "text-green-700 dark:text-green-300",
      x: "hover:text-green-900",
    },
    red: {
      bg: "bg-red-50 dark:bg-red-950",
      text: "text-red-700 dark:text-red-300",
      x: "hover:text-red-900",
    },
  };
  const s = styles[color];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {title}
          </h3>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
        <button
          onClick={onToggleAdd}
          className="flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {addOpen && (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newKeyword.trim()) {
                onAdd(newKeyword.trim());
                setNewKeyword("");
              }
            }}
            placeholder="Type keyword and press Enter..."
            className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            autoFocus
          />
          <button
            onClick={() => {
              if (newKeyword.trim()) {
                onAdd(newKeyword.trim());
                setNewKeyword("");
              }
            }}
            disabled={!newKeyword.trim() || saving !== null}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {keywords.map((kw) => (
          <span
            key={kw}
            className={`group flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${s.bg} ${s.text}`}
          >
            {kw}
            <button
              onClick={() => onRemove(kw)}
              className={`ml-0.5 opacity-0 transition-opacity group-hover:opacity-100 ${s.x}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <span className="text-xs text-zinc-400">No keywords</span>
        )}
      </div>
    </div>
  );
}
