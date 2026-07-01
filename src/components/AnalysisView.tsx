import React, { useEffect, useState, useRef } from 'react';
import { ImageItem } from '../types';
import { Loader as Loader2, Pause, Play } from 'lucide-react';
import { getImageAsDataURL, getObjectUrl } from '../lib/imageStore';

interface AnalysisViewProps {
  images: ImageItem[];
  folderName: string;
  groupingMode: 'event' | 'shotType';
  onAnalysisComplete: (analyzedImages: ImageItem[]) => void;
  // Images already analyzed (resuming): map of id -> {section, description}
  alreadyAnalyzed?: Map<string, { section?: string; description?: string }>;
}

const CONCURRENCY = 5;

export function AnalysisView({ images, folderName, groupingMode, onAnalysisComplete, alreadyAnalyzed }: AnalysisViewProps) {
  const [progress, setProgress] = useState(0);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const pausedRef = useRef(false);
  const completedRef = useRef<ImageItem[]>([]);
  const countRef = useRef(0);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    let cancelled = false;

    const analyzeImages = async () => {
      const results: ImageItem[] = [];
      completedRef.current = results;

      // Start from already-analyzed images if resuming.
      const queue: ImageItem[] = [];
      for (const img of images) {
        const existing = alreadyAnalyzed?.get(img.id);
        if (existing && existing.section) {
          results.push({ ...img, section: existing.section, description: existing.description });
          countRef.current++;
          setAnalyzedCount(countRef.current);
          setProgress(Math.round((countRef.current / images.length) * 100));
        } else {
          queue.push(img);
        }
      }

      // Process the queue in concurrent batches.
      let index = 0;

      const processOne = async (img: ImageItem): Promise<void> => {
        if (cancelled) return;
        // Wait while paused.
        while (pausedRef.current && !cancelled) {
          await new Promise((r) => setTimeout(r, 200));
        }
        if (cancelled) return;

        try {
          const imgData = await getImageAsDataURL(img.id);
          if (!imgData) {
            results.push({ ...img, section: 'Uncategorized', description: 'Could not load image' });
            return;
          }

          let response = await fetch('/api/analyze-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: imgData.dataUrl.split(',')[1] || imgData.dataUrl,
              mimeType: imgData.mimeType,
              filename: img.filename,
              folderName,
              groupingMode,
            }),
          });

          if (response.status === 429) {
            // Rate limited — wait and retry once.
            await new Promise((r) => setTimeout(r, 5000));
            response = await fetch('/api/analyze-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageBase64: imgData.dataUrl.split(',')[1] || imgData.dataUrl,
                mimeType: imgData.mimeType,
                filename: img.filename,
                folderName,
                groupingMode,
              }),
            });
          }

          if (response.ok) {
            const data = await response.json();
            results.push({
              ...img,
              section: data.section || 'Uncategorized',
              description: data.description || '',
            });
          } else {
            results.push({ ...img, section: 'Uncategorized', description: 'Analysis failed' });
          }
        } catch (err) {
          console.error('Failed to analyze image', img.id, err);
          results.push({ ...img, section: 'Uncategorized', description: 'Error analyzing' });
        }
      };

      // Concurrent batch runner.
      const runBatch = async () => {
        while (index < queue.length && !cancelled) {
          while (pausedRef.current && !cancelled) {
            await new Promise((r) => setTimeout(r, 200));
          }
          if (cancelled) break;

          const batch: Promise<void>[] = [];
          for (let c = 0; c < CONCURRENCY && index < queue.length; c++) {
            batch.push(
              processOne(queue[index]).then(() => {
                countRef.current++;
                setAnalyzedCount(countRef.current);
                setProgress(Math.round((countRef.current / images.length) * 100));
              })
            );
            index++;
          }
          await Promise.all(batch);
        }
      };

      await runBatch();

      if (!cancelled) {
        onAnalysisComplete(results);
      }
    };

    analyzeImages();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="text-center mb-12 mt-12">
        <Loader2 className="w-16 h-16 text-[#D4AF37] animate-spin mx-auto mb-6" />
        <h2 className="text-3xl font-serif italic text-white mb-4">Analyzing Your Album</h2>
        <p className="text-lg text-white/60 max-w-md mx-auto font-light">
          Our AI is scanning your {images.length.toLocaleString()} photos in parallel batches of {CONCURRENCY}.
        </p>
      </div>

      <div className="w-full max-w-2xl bg-white/10 rounded-full h-4 mb-4 overflow-hidden">
        <div
          className="bg-[#D4AF37] h-4 rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(212,175,55,0.5)]"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="flex items-center gap-4 mb-12">
        <p className="text-[11px] uppercase tracking-widest font-bold text-white/60">
          {analyzedCount.toLocaleString()} / {images.length.toLocaleString()} ({progress}%)
        </p>
        <button
          onClick={() => setIsPaused((p) => !p)}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/50 hover:text-white border border-white/10 rounded-full px-3 py-1 transition-colors"
        >
          {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 w-full max-w-4xl opacity-50 pointer-events-none">
        {images.slice(0, 16).map((img, i) => {
          const isDone = i < analyzedCount;
          return (
            <div
              key={img.id}
              className={`aspect-square rounded-2xl overflow-hidden ${isDone ? 'ring-2 ring-[#D4AF37] scale-105 transition-transform' : 'opacity-30'}`}
            >
              <ThumbFromStore id={img.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThumbFromStore({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getObjectUrl(id).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [id]);
  if (!url) return <div className="w-full h-full bg-zinc-800 animate-pulse" />;
  return <img src={url} alt="thumbnail" className="w-full h-full object-cover" />;
}
