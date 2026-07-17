"use client";

import { type CSSProperties, type PointerEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ScrollLockSnapshot = {
  scrollY: number;
  body: Pick<CSSStyleDeclaration, "overflow" | "position" | "top" | "width">;
};

let openSheetCount = 0;
let scrollLockSnapshot: ScrollLockSnapshot | null = null;

function lockPageScroll(openingScrollY: number | null) {
  openSheetCount += 1;
  if (openSheetCount !== 1) return;
  const scrollY = openingScrollY ?? window.scrollY;
  scrollLockSnapshot = {
    scrollY,
    body: {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    },
  };
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = "100%";
  document.documentElement.dataset.sheetOpen = "true";
}

function unlockPageScroll() {
  openSheetCount = Math.max(0, openSheetCount - 1);
  if (openSheetCount || !scrollLockSnapshot) return;
  const snapshot = scrollLockSnapshot;
  scrollLockSnapshot = null;
  document.body.style.overflow = snapshot.body.overflow;
  document.body.style.position = snapshot.body.position;
  document.body.style.top = snapshot.body.top;
  document.body.style.width = snapshot.body.width;
  delete document.documentElement.dataset.sheetOpen;
  if (snapshot.scrollY) {
    const restore = () => window.scrollTo(0, snapshot.scrollY);
    restore();
    window.requestAnimationFrame(restore);
  }
}

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
  const openingScrollY = useRef(typeof window !== "undefined" && openSheetCount === 0 ? window.scrollY : null);
  const onCloseRef = useRef(onClose);
  const dragStart = useRef<{ y: number; time: number; distance: number } | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    lockPageScroll(openingScrollY.current);
    sheetRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      const openSheets = document.querySelectorAll("[data-bottom-sheet]");
      if (event.key === "Escape" && openSheets.item(openSheets.length - 1) === sheetRef.current) onCloseRef.current();
    };
    const updateViewport = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--visual-viewport-height", `${height}px`);
      const activeField = document.activeElement as HTMLElement | null;
      if (activeField?.matches("input, textarea, select, [contenteditable='true']") && sheetRef.current?.contains(activeField)) {
        window.requestAnimationFrame(() => activeField.scrollIntoView({ block: "nearest" }));
      }
    };
    updateViewport();
    window.addEventListener("keydown", onKeyDown);
    window.visualViewport?.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      const isLastSheet = openSheetCount === 1;
      if (isLastSheet) previousFocus?.focus({ preventScroll: true });
      unlockPageScroll();
      if (isLastSheet) {
        document.documentElement.style.removeProperty("--visual-viewport-height");
      }
    };
  }, []);

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
    if (shouldClose) onCloseRef.current();
    else setDragY(0);
  }

  return (
    <div
      className={cn("sheet-backdrop", backdropClassName)}
      style={{ "--sheet-progress": Math.min(1, dragY / 320) } as CSSProperties}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
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
