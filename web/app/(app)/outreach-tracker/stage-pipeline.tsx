"use client";

import type { ContactStage } from "./types";
import { STAGE_ORDER, STAGE_LABELS, STAGE_COLORS } from "./types";

interface StagePipelineProps {
  currentStage: ContactStage;
}

export function StagePipeline({ currentStage }: StagePipelineProps) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  return (
    <div className="flex items-center gap-0.5 w-full">
      {STAGE_ORDER.map((stage, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        const colorClass = STAGE_COLORS[stage];
        const [textColor, bgColor] = colorClass.split(" ");

        return (
          <div key={stage} className="flex items-center flex-1 min-w-0">
            {/* Dot */}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`relative flex h-3 w-3 items-center justify-center rounded-full ${
                  isCompleted
                    ? bgColor
                    : isCurrent
                      ? `${bgColor} animate-pulse`
                      : "bg-zinc-700 ring-1 ring-zinc-600"
                }`}
              >
                {isCompleted && (
                  <svg className="h-2 w-2 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                className={`text-[9px] font-medium whitespace-nowrap ${
                  isCurrent ? textColor : isCompleted ? "text-zinc-400" : "text-zinc-600"
                }`}
              >
                {STAGE_LABELS[stage]}
              </span>
            </div>

            {/* Connector line (not after last) */}
            {i < STAGE_ORDER.length - 1 && (
              <div
                className={`flex-1 h-px mx-1 ${
                  isCompleted ? `${bgColor} opacity-60` : ""
                }`}
                style={
                  !isCompleted
                    ? {
                        backgroundImage: `repeating-linear-gradient(to right, rgb(82 82 91) 0, rgb(82 82 91) 4px, transparent 4px, transparent 8px)`,
                        backgroundSize: "8px 1px",
                        backgroundColor: "transparent",
                      }
                    : undefined
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
