import React, { useEffect, useRef, useState } from "react";
import { createDeskThing } from "@deskthing/client";

type Story = {
  id: string;
  title: string;
  summary?: string;
  url?: string;
  source?: string;
};

type ToClientEvent =
  | { type: "stories"; payload: Story[] }
  | { type: "status"; payload: string }
  | { type: "config"; payload: { scrollSpeed: number } };
type ToServerEvent =
  | { type: "request_stories" }
  | { type: "force_refresh" }
  | { type: "open_url"; payload: string };

const DeskThing = createDeskThing<ToClientEvent, ToServerEvent>();

const App: React.FC = () => {
    const [stories, setStories] = useState<Story[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [scrollSpeed, setScrollSpeed] = useState(3);

    useEffect(() => {
        const offStories = DeskThing.on("stories", (data) => {
            const list = Array.isArray(data?.payload) ? data.payload : [];
            setStories(list);
            setError(list.length ? null : "Waiting for stories…");
        });
        const offStatus = DeskThing.on("status", (data) => {
            const msg = typeof data?.payload === "string" ? data.payload : null;
            setStatusMsg(msg);
            if (msg) setTimeout(() => setStatusMsg(null), 5000);
        });
        const offConfig = DeskThing.on("config", (data) => {
            const n = Number(data?.payload?.scrollSpeed);
            if (Number.isFinite(n) && n > 0) setScrollSpeed(n);
        });
        DeskThing.send({ type: "request_stories" });
        setError("Loading…");
        return () => { offStories?.(); offStatus?.(); offConfig?.(); };
    }, []);

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-white">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-slate-950 to-transparent z-10" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950 to-transparent z-10" />

            <Header onSettingsClick={() => setShowSettings(true)} />

            {stories.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xl">
                    {error ?? "No stories"}
                </div>
            ) : (
                <Ticker stories={stories} scrollSpeed={scrollSpeed} />
            )}

            {showSettings && (
                <SettingsPanel
                    onClose={() => setShowSettings(false)}
                    statusMsg={statusMsg}
                    onForceRefresh={() => {
                        setStatusMsg("Refreshing stories…");
                        DeskThing.send({ type: "force_refresh" });
                    }}
                />
            )}
        </div>
    );
};

const Header: React.FC<{ onSettingsClick: () => void }> = ({ onSettingsClick }) => (
    <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-5 py-2 text-[11px] uppercase tracking-widest text-slate-500">
        <span>News</span>
        <div className="flex items-center gap-3">
            <span className="opacity-60">live</span>
            <button
                onClick={onSettingsClick}
                className="opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Settings"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            </button>
        </div>
    </div>
);

const SettingsPanel: React.FC<{
    onClose: () => void;
    statusMsg: string | null;
    onForceRefresh: () => void;
}> = ({ onClose, statusMsg, onForceRefresh }) => (
    <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-sm flex flex-col px-6 py-4">
        <div className="flex items-center justify-between mb-5">
            <span className="text-sm font-semibold uppercase tracking-widest text-slate-300">Settings</span>
            <button
                onClick={onClose}
                className="text-slate-500 hover:text-white transition-colors text-base leading-none"
                aria-label="Close settings"
            >
                ✕
            </button>
        </div>

        <div className="flex flex-col gap-3 flex-1">
            <button
                onClick={onForceRefresh}
                className="w-full text-left px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 transition-colors border border-slate-700/50"
            >
                <div className="text-sm font-medium text-white">Force Refresh Stories</div>
                <div className="text-xs text-slate-400 mt-0.5">Fetch the latest stories now</div>
            </button>
            <p className="text-xs text-slate-500 px-1">
                To add or remove RSS feeds, open the DeskThing app settings.
            </p>
        </div>

        {statusMsg && (
            <div className="mt-3 text-xs text-slate-400 text-center">{statusMsg}</div>
        )}
    </div>
);

// Setting is 1-10; each unit ≈ 10 px/s at 60fps. Default 3 ≈ 30 px/s (previous constant).
const SPEED_UNIT_PX_PER_FRAME = 10 / 60;
const IDLE_MS = 3000; // ms before auto-scroll resumes after user input
const TAP_SLOP_PX = 8; // movement allowed before a tap becomes a drag

const Ticker: React.FC<{ stories: Story[]; scrollSpeed: number }> = ({ stories, scrollSpeed }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const firstHalfRef = useRef<HTMLDivElement>(null);
    const isPausedRef = useRef(false);
    const draggedRef = useRef(false);
    const rafRef = useRef<number>(0);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // scrollTop only accepts integers — accumulate sub-pixel increments here
    const accumRef = useRef(0);
    const speedRef = useRef(scrollSpeed * SPEED_UNIT_PX_PER_FRAME);

    useEffect(() => {
        speedRef.current = scrollSpeed * SPEED_UNIT_PX_PER_FRAME;
    }, [scrollSpeed]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        accumRef.current = 0;

        const scheduleResume = () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(() => { isPausedRef.current = false; }, IDLE_MS);
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            isPausedRef.current = true;
            accumRef.current = Math.max(0, accumRef.current + e.deltaY);
            el.scrollTop = Math.floor(accumRef.current);
            scheduleResume();
        };

        let touchStartY = 0;
        let lastTouchY = 0;

        const onTouchStart = (e: TouchEvent) => {
            isPausedRef.current = true;
            draggedRef.current = false;
            touchStartY = e.touches[0].clientY;
            lastTouchY = touchStartY;
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };

        const onTouchMove = (e: TouchEvent) => {
            const y = e.touches[0].clientY;
            const delta = lastTouchY - y;
            if (Math.abs(y - touchStartY) > TAP_SLOP_PX) draggedRef.current = true;
            if (draggedRef.current) {
                e.preventDefault();
                accumRef.current = Math.max(0, accumRef.current + delta);
                el.scrollTop = Math.floor(accumRef.current);
            }
            lastTouchY = y;
        };

        const onTouchEnd = () => { scheduleResume(); };

        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("touchstart", onTouchStart, { passive: true });
        el.addEventListener("touchmove", onTouchMove, { passive: false });
        el.addEventListener("touchend", onTouchEnd, { passive: true });
        el.addEventListener("touchcancel", onTouchEnd, { passive: true });

        const tick = () => {
            if (!isPausedRef.current) {
                accumRef.current += speedRef.current;
            }
            el.scrollTop = Math.floor(accumRef.current);

            // Seamless loop: wrap by exactly one copy's height, taking the top-padding
            // offset into account so the visual position before/after wrap matches.
            const first = firstHalfRef.current;
            if (first) {
                const h = first.offsetHeight;
                const topOffset = first.offsetTop;
                while (h > 0 && accumRef.current >= topOffset + h) {
                    accumRef.current -= h;
                }
                el.scrollTop = Math.floor(accumRef.current);
            }

            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(rafRef.current);
            el.removeEventListener("wheel", onWheel);
            el.removeEventListener("touchstart", onTouchStart);
            el.removeEventListener("touchmove", onTouchMove);
            el.removeEventListener("touchend", onTouchEnd);
            el.removeEventListener("touchcancel", onTouchEnd);
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, []);

    const openStory = (story: Story) => {
        if (draggedRef.current) return; // swallow the click that follows a drag
        if (!story.url) return;
        DeskThing.send({ type: "open_url", payload: story.url });
    };

    return (
        <div
            ref={containerRef}
            className="h-full overflow-y-scroll no-scrollbar pt-20 touch-none overscroll-none"
        >
            <div ref={firstHalfRef}>
                {stories.map((s, i) => (
                    <StoryCard key={`a-${s.id}-${i}`} story={s} onOpen={() => openStory(s)} />
                ))}
            </div>
            <div aria-hidden="true">
                {stories.map((s, i) => (
                    <StoryCard key={`b-${s.id}-${i}`} story={s} onOpen={() => openStory(s)} />
                ))}
            </div>
        </div>
    );
};

const StoryCard: React.FC<{ story: Story; onOpen: () => void }> = ({ story, onOpen }) => (
    <div
        onClick={onOpen}
        className={`px-6 py-5 border-b border-slate-800/80 transition-colors ${story.url ? "cursor-pointer active:bg-slate-800/50" : ""}`}
    >
        <div className="text-2xl font-semibold leading-snug">{story.title}</div>
        {story.summary && (
            <div className="mt-2 text-base text-slate-400 line-clamp-3">
                {story.summary}
            </div>
        )}
        {story.source && (
            <div className="mt-2 text-xs text-slate-500">{story.source}</div>
        )}
    </div>
);

export default App;
