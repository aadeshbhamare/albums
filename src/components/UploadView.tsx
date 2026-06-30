import React, { useCallback, useRef, useState } from 'react';
import { FolderUp, X, Image as ImageIcon, Clock, Users, Sparkles, ArrowLeft, Check, Loader as Loader2 } from 'lucide-react';
import { ImageItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { putImages, StoredImage, deleteImage } from '../lib/imageStore';
import { VirtualizedThumbGrid } from './VirtualizedThumbGrid';

interface UploadViewProps {
  onUpload: (images: ImageItem[], folderName: string, groupingMode: 'event' | 'shotType') => void;
  initialImages?: ImageItem[];
  initialFolderName?: string;
}

const MAX_IMAGES = 7000;

export function UploadView({ onUpload, initialImages = [], initialFolderName = 'Untitled Album' }: UploadViewProps) {
  const [accumulatedImages, setAccumulatedImages] = useState<ImageItem[]>(initialImages);
  const [albumName, setAlbumName] = useState(initialFolderName);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'event' | 'shotType'>('event');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestProgress, setIngestProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArr.length === 0) {
      alert('No images found in the selected files.');
      return;
    }

    setIsIngesting(true);
    setIngestProgress(0);

    let mainFolderName = albumName === 'Untitled Album' ? '' : albumName;

    // Determine folder name from the first file with a relative path.
    for (const file of fileArr) {
      const path = (file as any).webkitRelativePath || file.name;
      const parts = path.split('/');
      if (parts.length > 1 && !mainFolderName) {
        mainFolderName = parts[0];
        break;
      }
    }

    const newMetas: ImageItem[] = [];
    const stored: StoredImage[] = [];

    // Ingest in chunks to keep the UI responsive for thousands of files.
    const CHUNK = 200;
    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];
      const id = uuidv4();
      const path = (file as any).webkitRelativePath || file.name;
      const parts = path.split('/');
      const folderName = parts.length > 1 ? parts[0] : 'Album';

      newMetas.push({
        id,
        filename: file.name,
        folderName,
        mimeType: file.type || 'image/jpeg',
        size: file.size,
      });
      stored.push({
        id,
        blob: file,
        filename: file.name,
        folderName,
        mimeType: file.type || 'image/jpeg',
        size: file.size,
      });

      if (stored.length >= CHUNK || i === fileArr.length - 1) {
        await putImages(stored.splice(0));
        setIngestProgress(Math.round(((i + 1) / fileArr.length) * 100));
        // Yield to the event loop so the progress bar can paint.
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    setAccumulatedImages((prev) => {
      const combined = [...prev, ...newMetas];
      if (combined.length > MAX_IMAGES) {
        alert(`Maximum ${MAX_IMAGES} images allowed. Only the first ${MAX_IMAGES} will be kept.`);
        return combined.slice(0, MAX_IMAGES);
      }
      return combined;
    });

    if (mainFolderName && albumName === 'Untitled Album') {
      setAlbumName(mainFolderName);
    }

    setIsIngesting(false);
    setIngestProgress(0);
  }, [albumName]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const files: File[] = [];
      let pending = 0;

      const processEntry = (entry: any) => {
        if (entry.isFile) {
          pending++;
          entry.file((file: File) => {
            files.push(file);
            pending--;
            if (pending === 0) handleFiles(files);
          });
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          reader.readEntries((entries: any[]) => {
            entries.forEach(processEntry);
          });
        }
      };

      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        if (item) processEntry(item);
      }

      // Fallback after a short delay if entries didn't yield files.
      setTimeout(() => {
        if (files.length === 0 && pending === 0) {
          handleFiles(e.dataTransfer.files);
        }
      }, 500);
    } else {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeImage = async (id: string) => {
    await deleteImage(id);
    setAccumulatedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const totalSizeMB = (accumulatedImages.reduce((s, i) => s + i.size, 0) / (1024 * 1024)).toFixed(0);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12">
      <div className="text-center mb-12 max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-serif italic text-white mb-4">
          Create Your Intelligent Album
        </h1>
        <p className="text-lg text-white/60 mb-6 font-light">
          Upload up to {MAX_IMAGES.toLocaleString()} photos. Our AI will automatically categorize them based on the event.
        </p>
        <div className="flex justify-center mb-6">
          <input
            type="text"
            value={albumName}
            onChange={(e) => setAlbumName(e.target.value)}
            className="bg-white/5 border border-white/20 text-white text-center rounded-xl px-4 py-2 focus:outline-none focus:border-[#D4AF37] transition-colors"
            placeholder="Name your album..."
          />
        </div>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className={cn(
          'w-full max-w-3xl border-2 border-dashed rounded-[3rem] p-16 text-center transition-colors duration-200 ease-in-out bg-white/5 backdrop-blur-sm',
          isIngesting ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/20'
        )}
      >
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          {isIngesting ? <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" /> : <FolderUp className="w-8 h-8 text-white/80" />}
        </div>
        {isIngesting ? (
          <>
            <h3 className="text-xl font-medium text-white mb-4">Ingesting images...</h3>
            <div className="w-full max-w-sm mx-auto bg-white/10 rounded-full h-2 overflow-hidden">
              <div className="bg-[#D4AF37] h-2 rounded-full transition-all duration-150" style={{ width: `${ingestProgress}%` }} />
            </div>
            <p className="text-white/40 text-sm mt-3">{ingestProgress}%</p>
          </>
        ) : (
          <>
            <h3 className="text-xl font-medium text-white mb-6">Drag and drop your photos here</h3>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-[#D4AF37] hover:bg-[#c4a133] text-black rounded-full text-[10px] uppercase tracking-widest font-bold transition-colors"
              >
                Add Folder
              </button>
              <button
                onClick={() => imagesInputRef.current?.click()}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full text-[10px] uppercase tracking-widest font-bold border border-white/20 transition-colors"
              >
                Add Images
              </button>
            </div>
            <p className="text-white/40 text-sm">Supports JPEG, PNG, WEBP images.</p>
          </>
        )}

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          //@ts-ignore
          webkitdirectory="true"
          directory="true"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          type="file"
          ref={imagesInputRef}
          className="hidden"
          multiple
          accept="image/*"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {accumulatedImages.length > 0 && (
        <div className="mt-12 w-full max-w-4xl bg-zinc-900/50 backdrop-blur-sm rounded-[2rem] border border-white/10 p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex items-center gap-3 text-white">
              <ImageIcon className="w-5 h-5 text-[#D4AF37]" />
              <span className="font-medium text-lg">
                {accumulatedImages.length.toLocaleString()} images
                <span className="text-white/40 text-sm font-normal ml-2">({totalSizeMB} MB)</span>
              </span>
            </div>
            <button
              onClick={() => setShowModeSelector(true)}
              disabled={isIngesting}
              className="px-8 py-3 bg-[#D4AF37] hover:bg-[#c4a133] text-black rounded-full text-xs uppercase tracking-widest font-bold transition-colors shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:shadow-[0_0_25px_rgba(212,175,55,0.5)] disabled:opacity-50"
            >
              Start Analysis
            </button>
          </div>

          <VirtualizedThumbGrid images={accumulatedImages} onRemove={removeImage} maxHeight={320} />
        </div>
      )}

      <AnimatePresence>
        {showModeSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-950 border border-white/10 rounded-[2.5rem] max-w-2xl w-full p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-[100px] pointer-events-none" />

              <div className="flex justify-between items-center mb-8">
                <button
                  onClick={() => setShowModeSelector(false)}
                  className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-xs uppercase tracking-wider font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to List
                </button>
                <button
                  onClick={() => setShowModeSelector(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/80 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center mb-8">
                <h3 className="text-2xl md:text-3xl font-serif italic text-white mb-3">
                  How would you like to aggregate your photos?
                </h3>
                <p className="text-sm text-white/60 font-light max-w-md mx-auto">
                  Our Intelligent AI will organize your {accumulatedImages.length.toLocaleString()} photos into distinct layout sections based on your choice.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div
                  onClick={() => setSelectedMode('event')}
                  className={cn(
                    'relative p-6 rounded-3xl border text-left cursor-pointer transition-all duration-300 hover:bg-white/5',
                    selectedMode === 'event'
                      ? 'border-[#D4AF37] bg-[#D4AF37]/5 shadow-[0_0_20px_rgba(212,175,55,0.1)]'
                      : 'border-white/10 bg-zinc-900/30'
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center',
                      selectedMode === 'event' ? 'bg-[#D4AF37] text-black' : 'bg-white/5 text-white/80'
                    )}>
                      <Clock className="w-5 h-5" />
                    </div>
                    {selectedMode === 'event' && (
                      <span className="w-6 h-6 bg-[#D4AF37] text-black rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-medium text-white mb-2">Event-Wise Timeline</h4>
                  <p className="text-xs text-white/50 leading-relaxed font-light">
                    Groups photos chronologically by wedding event phases:
                    <span className="block mt-1 text-[#D4AF37]/80 font-medium">Preparation, Ceremony, Reception, Decor Details.</span>
                  </p>
                </div>

                <div
                  onClick={() => setSelectedMode('shotType')}
                  className={cn(
                    'relative p-6 rounded-3xl border text-left cursor-pointer transition-all duration-300 hover:bg-white/5',
                    selectedMode === 'shotType'
                      ? 'border-[#D4AF37] bg-[#D4AF37]/5 shadow-[0_0_20px_rgba(212,175,55,0.1)]'
                      : 'border-white/10 bg-zinc-900/30'
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center',
                      selectedMode === 'shotType' ? 'bg-[#D4AF37] text-black' : 'bg-white/5 text-white/80'
                    )}>
                      <Users className="w-5 h-5" />
                    </div>
                    {selectedMode === 'shotType' && (
                      <span className="w-6 h-6 bg-[#D4AF37] text-black rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-medium text-white mb-2">Shot Type & Subjects</h4>
                  <p className="text-xs text-white/50 leading-relaxed font-light">
                    Groups photos by characters and compositions:
                    <span className="block mt-1 text-[#D4AF37]/80 font-medium">Couples portraits, Groups & Family, Singles, Candid shots.</span>
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
                <button
                  onClick={() => setShowModeSelector(false)}
                  className="px-6 py-3 border border-white/20 text-white/80 hover:bg-white/5 rounded-full text-xs uppercase tracking-widest font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowModeSelector(false);
                    onUpload(accumulatedImages, albumName || 'Untitled Album', selectedMode);
                  }}
                  className="px-8 py-3 bg-[#D4AF37] hover:bg-[#c4a133] text-black rounded-full text-xs uppercase tracking-widest font-bold transition-colors shadow-[0_0_15px_rgba(212,175,55,0.3)] flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-current" /> Confirm & Analyze
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
