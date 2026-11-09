"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/components/ui/cn";
import type { FieldCover, TemplateField } from "@/lib/pdf/template";

type DragMode = "move" | "resize-left" | "resize-right" | "cover-move" | "cover-resize";

type FieldOverlayProps = {
  field: TemplateField;
  scale: number;
  pageHeight: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TemplateField>) => void;
};

const round = (value: number) => Math.round(value * 10) / 10;

/** Draggable box drawn over the certificate preview for one field (and its cover, when selected). */
export function FieldOverlay({ field, scale, pageHeight, selected, onSelect, onChange }: FieldOverlayProps) {
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; field: TemplateField } | null>(null);

  const begin = (mode: DragMode, event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { mode, startX: event.clientX, startY: event.clientY, field };
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = (event.clientX - state.startX) / scale;
    const dy = (event.clientY - state.startY) / scale;
    const origin = state.field;
    const cover = origin.cover;
    switch (state.mode) {
      case "move":
        onChange({ x: round(origin.x + dx), y: round(origin.y - dy) });
        break;
      case "resize-left": {
        const width = Math.max(12, origin.width - dx);
        onChange({ x: round(origin.x + origin.width - width), width: round(width) });
        break;
      }
      case "resize-right":
        onChange({ width: round(Math.max(12, origin.width + dx)) });
        break;
      case "cover-move":
        if (cover) onChange({ cover: { ...cover, x: round(cover.x + dx), y: round(cover.y - dy) } });
        break;
      case "cover-resize":
        if (cover) {
          const height = Math.max(2, cover.height + dy);
          const next: FieldCover = {
            ...cover,
            width: round(Math.max(4, cover.width + dx)),
            height: round(height),
            y: round(cover.y + cover.height - height),
          };
          onChange({ cover: next });
        }
        break;
    }
  };

  const end = () => {
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    if (event.altKey) onChange({ width: round(Math.max(12, field.width + d[0])) });
    else onChange({ x: round(field.x + d[0]), y: round(field.y + d[1]) });
  };

  const top = (pageHeight - field.y - field.size * 0.8) * scale;
  const baseline = field.size * 0.8 * scale;
  const cover = field.cover;

  return (
    <>
      {selected && cover && (
        <div
          aria-hidden
          onPointerDown={(event) => begin("cover-move", event)}
          onPointerMove={move}
          onPointerUp={end}
          className="absolute cursor-move border border-dashed border-bone-400/90 bg-[repeating-linear-gradient(135deg,rgb(246_241_233/0.10)_0_6px,transparent_6px_12px)]"
          style={{
            left: cover.x * scale,
            top: (pageHeight - cover.y - cover.height) * scale,
            width: cover.width * scale,
            height: cover.height * scale,
          }}
        >
          <span className="absolute -top-5 left-0 whitespace-nowrap font-mono text-[10px] text-bone-300">máscara</span>
          <span
            onPointerDown={(event) => begin("cover-resize", event)}
            onPointerMove={move}
            onPointerUp={end}
            className="absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize rounded-sm border border-bone-300 bg-ink-900"
          />
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label={`${field.label}: arraste para mover, use as setas para ajuste fino (Shift para 10 pt, Alt para largura)`}
        aria-pressed={selected}
        onPointerDown={(event) => begin("move", event)}
        onPointerMove={move}
        onPointerUp={end}
        onFocus={onSelect}
        onKeyDown={onKeyDown}
        className={cn(
          "absolute cursor-move rounded-[3px] border transition-colors focus:outline-none",
          selected
            ? "z-10 border-signal-500 bg-signal-500/10 shadow-[0_0_0_3px_rgb(233_31_38/0.18)]"
            : "border-signal-400/30 bg-transparent hover:border-signal-400/80 hover:bg-signal-500/5",
        )}
        style={{ left: field.x * scale, top, width: field.width * scale, height: field.size * scale }}
      >
        <span
          aria-hidden
          className={cn("absolute inset-x-0 border-t border-dashed", selected ? "border-signal-500" : "border-signal-400/50")}
          style={{ top: baseline }}
        />
        <span
          aria-hidden
          className={cn(
            "absolute -top-5 left-0 whitespace-nowrap rounded-sm px-1 font-mono text-[10px]",
            selected ? "bg-signal-500 text-white" : "text-signal-300/80",
          )}
        >
          {field.label}
        </span>
        {selected && (
          <>
            <span
              aria-hidden
              onPointerDown={(event) => begin("resize-left", event)}
              onPointerMove={move}
              onPointerUp={end}
              className="absolute -left-1.5 top-1/2 h-5 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-sm border border-signal-500 bg-ink-900"
            />
            <span
              aria-hidden
              onPointerDown={(event) => begin("resize-right", event)}
              onPointerMove={move}
              onPointerUp={end}
              className="absolute -right-1.5 top-1/2 h-5 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-sm border border-signal-500 bg-ink-900"
            />
          </>
        )}
      </div>
    </>
  );
}
