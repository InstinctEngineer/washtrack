import { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ScrollWheelProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  itemHeight?: number;
  visibleCount?: number;
  className?: string;
}

/**
 * iOS-style vertical scroll wheel picker.
 * Pure CSS scroll-snap + scroll listener; no extra deps.
 */
export function ScrollWheel({
  value,
  onChange,
  min = 0,
  max = 999,
  itemHeight = 56,
  visibleCount = 5,
  className,
}: ScrollWheelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const scrollTimer = useRef<number | null>(null);
  const programmaticScroll = useRef(false);

  const values = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const padCount = Math.floor(visibleCount / 2);
  const containerHeight = itemHeight * visibleCount;

  // Scroll to value when value changes externally
  useEffect(() => {
    if (!scrollRef.current) return;
    const targetTop = (value - min) * itemHeight;
    if (Math.abs(scrollRef.current.scrollTop - targetTop) > 1) {
      programmaticScroll.current = true;
      scrollRef.current.scrollTop = targetTop;
      window.setTimeout(() => { programmaticScroll.current = false; }, 50);
    }
  }, [value, min, itemHeight]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || programmaticScroll.current) return;
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      if (!scrollRef.current) return;
      const idx = Math.round(scrollRef.current.scrollTop / itemHeight);
      const next = Math.max(min, Math.min(max, idx + min));
      if (next !== value) onChange(next);
      // Snap precisely
      const snapTop = (next - min) * itemHeight;
      if (Math.abs(scrollRef.current.scrollTop - snapTop) > 1) {
        programmaticScroll.current = true;
        scrollRef.current.scrollTo({ top: snapTop, behavior: 'smooth' });
        window.setTimeout(() => { programmaticScroll.current = false; }, 200);
      }
    }, 90);
  }, [itemHeight, min, max, value, onChange]);

  const adjust = (delta: number) => {
    const next = Math.max(min, Math.min(max, value + delta));
    onChange(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); adjust(-1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); adjust(1); }
    else if (e.key === 'PageUp') { e.preventDefault(); adjust(-10); }
    else if (e.key === 'PageDown') { e.preventDefault(); adjust(10); }
  };

  const commitEdit = () => {
    const n = parseInt(editVal, 10);
    if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
    setEditing(false);
  };

  return (
    <div className={cn('flex items-center justify-center select-none', className)}>
      <div
        className="relative w-full max-w-[260px]"
        style={{ height: containerHeight }}
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
      >
        {/* Gradient fade top/bottom */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-card via-card/80 to-transparent"
          style={{ height: itemHeight * 1.5 }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-card via-card/80 to-transparent"
          style={{ height: itemHeight * 1.5 }} />

        {/* Center highlight bars */}
        <div
          className="pointer-events-none absolute inset-x-0 z-20 border-y-2 border-primary/60"
          style={{ top: padCount * itemHeight, height: itemHeight }}
        />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-scroll scroll-snap-y snap-mandatory no-scrollbar"
          style={{
            scrollSnapType: 'y mandatory',
            scrollbarWidth: 'none',
          }}
        >
          <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
          <div style={{ paddingTop: padCount * itemHeight, paddingBottom: padCount * itemHeight }}>
            {values.map((n) => {
              const isCenter = n === value;
              const dist = Math.abs(n - value);
              const opacity = dist === 0 ? 1 : dist === 1 ? 0.55 : dist === 2 ? 0.25 : 0.12;
              return editing && isCenter ? (
                <div
                  key={n}
                  style={{ height: itemHeight, scrollSnapAlign: 'center' }}
                  className="flex items-center justify-center"
                >
                  <Input
                    autoFocus
                    type="number"
                    inputMode="numeric"
                    value={editVal}
                    min={min}
                    max={max}
                    onChange={(e) => setEditVal(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                      else if (e.key === 'Escape') { setEditing(false); }
                    }}
                    className="h-12 w-24 text-center text-3xl font-bold"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  key={n}
                  onClick={() => {
                    if (isCenter) {
                      setEditVal(String(value));
                      setEditing(true);
                    } else {
                      onChange(n);
                    }
                  }}
                  style={{ height: itemHeight, scrollSnapAlign: 'center', opacity }}
                  className={cn(
                    'w-full flex items-center justify-center font-mono tabular-nums transition-all',
                    isCenter
                      ? 'text-4xl font-bold text-primary'
                      : 'text-2xl font-semibold text-foreground'
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-12 w-12 rounded-full shrink-0"
        onClick={() => adjust(1)}
        aria-label="Increase"
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}