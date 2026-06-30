import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getObjectUrl, revokeObjectUrl } from '../lib/imageStore';
import { ImageItem } from '../types';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface VirtualizedThumbGridProps {
  images: ImageItem[];
  onRemove?: (id: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  className?: string;
  // height of the scroll container; defaults to 256px (max-h-64)
  maxHeight?: number;
}

// Renders only the thumbnails visible in the scroll viewport.
// For 3000-7000 images this avoids creating thousands of <img> + object URLs.
export function VirtualizedThumbGrid({
  images,
  onRemove,
  selectable = false,
  selectedIds,
  onToggleSelect,
  className,
  maxHeight = 256,
}: VirtualizedThumbGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 60 });
  const [thumbH, setThumbH] = useState(96); // approx thumbnail height incl gap
  const [cols, setCols] = useState(8);

  // Determine columns + thumbnail height from container width.
  const recomputeLayout = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const width = el.clientWidth;
    // Match the grid template: 4 cols mobile ... 10 cols xl
    let c = 4;
    if (width >= 640) c = 6;
    if (width >= 768) c = 8;
    if (width >= 1024) c = 10;
    setCols(c);
    // gap-3 = 12px; thumbnail is square, so height = (width - gaps) / cols
    const gap = 12;
    const thumb = Math.floor((width - gap * (c - 1)) / c);
    setThumbH(Math.max(48, thumb + gap));
  }, []);

  useEffect(() => {
    recomputeLayout();
    const onResize = () => recomputeLayout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [recomputeLayout]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const start = Math.max(0, Math.floor(scrollTop / thumbH) * cols);
    const viewportRows = Math.ceil(el.clientHeight / thumbH);
    const end = Math.min(images.length, start + (viewportRows + 2) * cols);
    setVisibleRange({ start, end });
  }, [thumbH, cols, images.length]);

  useEffect(() => {
    onScroll();
  }, [onScroll, images.length]);

  const totalRows = Math.ceil(images.length / cols);
  const totalHeight = totalRows * thumbH;

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className={cn('overflow-y-auto p-4 bg-black/50 rounded-2xl border border-white/5 custom-scrollbar', className)}
      style={{ maxHeight }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {images.slice(visibleRange.start, visibleRange.end).map((img, i) => {
          const realIdx = visibleRange.start + i;
          const row = Math.floor(realIdx / cols);
          const col = realIdx % cols;
          const top = row * thumbH;
          const left = `calc(${(col / cols) * 100}% + ${col * 12}px)`;
          const width = `calc((100% - ${(cols - 1) * 12}px) / ${cols})`;
          return (
            <ThumbCell
              key={img.id}
              img={img}
              style={{ position: 'absolute', top, left, width, height: thumbH - 12 }}
              onRemove={onRemove}
              selectable={selectable}
              selected={selectedIds?.has(img.id) ?? false}
              onToggleSelect={onToggleSelect}
            />
          );
        })}
      </div>
    </div>
  );
}

interface ThumbCellProps {
  key: string;
  img: ImageItem;
  style: React.CSSProperties;
  onRemove?: (id: string) => void;
  selectable?: boolean;
  selected: boolean;
  onToggleSelect?: (id: string) => void;
}

function ThumbCell({
  img,
  style,
  onRemove,
  selectable,
  selected,
  onToggleSelect,
}: ThumbCellProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getObjectUrl(img.id).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [img.id]);

  // Don't revoke on unmount — URLs are cached globally in imageStore and reused.
  // They get revoked only when the image is deleted or the album is cleared.

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden group border bg-zinc-800',
        selected ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]' : 'border-white/10'
      )}
      style={style}
      onClick={selectable ? () => onToggleSelect?.(img.id) : undefined}
    >
      {url && <img src={url} alt={img.filename} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />}
      {!url && <div className="w-full h-full animate-pulse bg-zinc-700" />}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(img.id);
          }}
          className="absolute top-1 right-1 w-6 h-6 bg-black/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      {selectable && selected && (
        <div className="absolute inset-0 bg-[#D4AF37]/20 pointer-events-none" />
      )}
    </div>
  );
}
