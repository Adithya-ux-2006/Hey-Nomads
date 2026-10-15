import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { TOUR_STEPS, endTour, nextTour, onTourChange } from '../lib/tour';
import { Button } from './UI';

// Coach-marks for the walkthrough. One instance lives inside the Router for the
// whole session: the step state is module-level, so navigating between screens
// remounts the pages underneath but never the overlay.
//
// Design notes:
//   - The dim layer is pointer-events-none, so the highlighted control stays
//     live. A visitor can tap the heart while reading "tap the heart to like".
//   - The spotlight is one div with a huge box-shadow spread. No canvas, no
//     clip-path maths, and it stays a hole no matter the anchor's size.
//   - The card is placed with top or bottom only - it grows away from the
//     anchor - so it never needs the card's own height to be known first.
const EDGE = 16;
const GAP = 12;
const CARD_W = 320;
const ROOM_BELOW = 200; // roughly the card's height; below is preferred when there is this much space
const CARD_RESERVE = 120; // keep the card clear of the fixed bottom nav
const ANCHOR_POLL_MS = 100;
const ANCHOR_POLL_MAX = 50; // give up after ~5s; the anchor is not coming

function cardStyle(rect, width, height) {
  const w = Math.min(CARD_W, width - EDGE * 2);
  if (!rect) {
    return { width: w, left: (width - w) / 2, bottom: EDGE * 2 };
  }
  const spaceBelow = height - rect.bottom;
  const spaceAbove = rect.top;
  const below = spaceBelow >= ROOM_BELOW || spaceBelow >= spaceAbove;
  return {
    width: w,
    left: Math.max(EDGE, Math.min(rect.left, width - w - EDGE)),
    ...(below
      ? { top: Math.min(rect.bottom + GAP, height - CARD_RESERVE) }
      : { bottom: Math.max(EDGE, height - rect.top + GAP) }),
  };
}

export default function TourOverlay() {
  const navigate = useNavigate();
  const [state, setState] = useState({ active: false, index: 0 });
  const [rect, setRect] = useState(null);
  const rectRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => onTourChange(setState), []);

  const { active, index } = state;
  const step = TOUR_STEPS[index];

  // Scroll the anchor into view on each step change, then keep the spotlight
  // glued to it while the page moves underneath.
  useEffect(() => {
    if (!active || !step) return undefined;
    const anchor = () => document.querySelector(`[data-tour="${step.anchor}"]`);

    // Only commit a new rect when it actually moved. Polling and scroll both
    // call this, and a fresh object every tick would re-render the overlay
    // continuously for no visual change.
    const measure = () => {
      const el = anchor();
      if (!el) {
        if (rectRef.current !== null) {
          rectRef.current = null;
          setRect(null);
        }
        return;
      }
      const r = el.getBoundingClientRect();
      const next = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      const prev = rectRef.current;
      if (
        prev &&
        prev.top === next.top &&
        prev.bottom === next.bottom &&
        prev.left === next.left &&
        prev.right === next.right
      ) {
        return;
      }
      rectRef.current = next;
      setRect(next);
    };

    // The anchor mounts only after the page's data resolves, which is usually
    // after this effect first runs. Poll until it appears, then stop. The poll
    // only measures - scrolling again here would fight the visitor's own
    // scrolling for as long as the poll runs.
    //
    // The first scroll has to wait for the anchor to exist, so it is done
    // inside the poll rather than before it. Once done it is never repeated:
    // a step that scrolls the visitor back to the top every 100ms is worse
    // than one that leaves the anchor off-screen for a beat.
    let scrolled = false;
    const bringIntoView = () => {
      if (scrolled) return;
      const el = anchor();
      if (!el) return;
      scrolled = true;
      el.scrollIntoView({ block: 'center' });
    };
    bringIntoView();
    measure();
    let tries = 0;
    const poll = setInterval(() => {
      bringIntoView();
      measure();
      if (rectRef.current || ++tries > ANCHOR_POLL_MAX) clearInterval(poll);
    }, ANCHOR_POLL_MS);

    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      clearInterval(poll);
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [active, step]);

  // Escape ends the tour from anywhere. Focus moves to the card on each step
  // so keyboard users land on the controls they need without tabbing through
  // the page behind the spotlight.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') endTour();
    };
    window.addEventListener('keydown', onKey);
    cardRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [active, index]);

  // Next crosses screens. The pages remount underneath the overlay, so the
  // step's anchor simply has to exist on the destination.
  const goNext = () => {
    const upcoming = TOUR_STEPS[index + 1];
    if (upcoming) navigate(upcoming.path);
    nextTour();
  };

  if (!active || !step) return null;

  const style = cardStyle(rect, window.innerWidth, window.innerHeight);

  return (
    <>
      {/* The hole. pointer-events-none keeps the real interface clickable. */}
      {rect && (
        <div className="fixed inset-0 z-[60] pointer-events-none" aria-hidden="true">
          <div
            className="absolute rounded-xl motion-safe:transition-all duration-200"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.right - rect.left + 12,
              height: rect.bottom - rect.top + 12,
              boxShadow: '0 0 0 9999px rgba(31, 41, 51, 0.45)',
            }}
          />
        </div>
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-live="polite"
        aria-label={`Walkthrough step ${index + 1} of ${TOUR_STEPS.length}: ${step.title}`}
        className="fixed z-[60] bg-surface-card border border-surface-border rounded-xl shadow-hover p-4 space-y-3 motion-safe:transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2"
        style={style}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold text-text-primary">{step.title}</h2>
          <span className="text-xs text-text-muted tabular-nums shrink-0">
            {index + 1}/{TOUR_STEPS.length}
          </span>
        </div>

        <p className="text-sm text-text-secondary flex gap-2">
          <Check size={16} className="shrink-0 mt-0.5 text-brand-teal" aria-hidden="true" />
          <span>{step.do}</span>
        </p>
        <p className="text-sm text-text-secondary flex gap-2">
          <X size={16} className="shrink-0 mt-0.5 text-brand-coral" aria-hidden="true" />
          <span>{step.dont}</span>
        </p>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={endTour}
            className="px-3 py-2 text-sm font-semibold text-text-muted hover:text-text-primary transition-colors"
          >
            End tour
          </button>
          <Button onClick={goNext}>{step.cta}</Button>
        </div>
      </div>
    </>
  );
}
