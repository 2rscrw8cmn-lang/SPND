"use client";

import { type CSSProperties, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  children: ReactNode;
  backdropClassName?: string;
  className?: string;
  label: string;
  onClose: () => void;
  handleLabel?: string;
};

export function BottomSheet({ children, backdropClassName, className, label, onClose, handleLabel = "Swipe down to close" }: BottomSheetProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const dragStart = useRef<{ y: number; time: number; distance: number } | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      const openSheets = document.querySelectorAll("[data-bottom-sheet]");
      if (event.key === "Escape" && openSheets.item(openSheets.length - 1) === sheetRef.current) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || sheetRef.current?.scrollTop) return;
    const target = event.target as HTMLElement;
    const isHandle = Boolean(target.closest("[data-sheet-handle]"));
    const isTouchingTop = event.pointerType === "touch" && event.clientY - event.currentTarget.getBoundingClientRect().top <= 72;
    if (!isHandle && !isTouchingTop) return;

    dragStart.current = { y: event.clientY, time: performance.now(), distance: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const start = dragStart.current;
    if (!start) return;
    event.preventDefault();
    const distance = Math.max(0, event.clientY - start.y);
    start.distance = Math.max(start.distance, distance);
    setDragY(distance);
  }

  function finishDrag() {
    const start = dragStart.current;
    if (!start) return;
    const velocity = start.distance / Math.max(1, performance.now() - start.time);
    const shouldClose = start.distance >= 96 || (start.distance >= 38 && velocity >= 0.55);
    dragStart.current = null;
    if (shouldClose) onClose();
    else setDragY(0);
  }

  return (
    <div
      className={cn("sheet-backdrop", backdropClassName)}
      style={{ "--sheet-progress": Math.min(1, dragY / 320) } as CSSProperties}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-bottom-sheet
        className={cn("bottom-sheet", className, dragY > 0 && "is-dragging")}
        style={{ transform: `translateY(${dragY}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={() => {
          dragStart.current = null;
          setDragY(0);
        }}
      >
        <button className="sheet-drag-handle" data-sheet-handle type="button" aria-label={handleLabel}>
          <span />
        </button>
        {children}
      </section>
    </div>
  );
}
