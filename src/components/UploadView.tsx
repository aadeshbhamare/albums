import React, { useCallback, useRef, useState } from 'react';
import { UploadCloud, FolderUp, X, Image as ImageIcon, Clock, Users, Sparkles, ArrowLeft, Check } from 'lucide-react';
import { ImageItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface UploadViewProps {
  onUpload: (images: ImageItem[], folderName: string, groupingMode: 'event' | 'shotType') => void;
}

export function UploadView({ onUpload }: UploadViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [accumulatedImages, setAccumulatedImages] = useState<ImageItem[]>([]);
  const [albumName, setAlbumName] = useState("Untitled Album");
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'event' | 'shotType'>('event');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | File[]) => {
    const newImages: ImageItem[] = [];
    let mainFolderName = albumName === "Untitled Album" ? "" : albumName;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const path = (file as any).webkitRelativePath || file.name;
        const parts = path.split('/');
        const folderName = parts.length > 1 ? parts[0] : "Album";
        if (parts.length > 1 && !mainFolderName) {
          mainFolderName = folderName;
        }

        newImages.push({
          id: uuidv4(),
          file,
          previewUrl: URL.createObjectURL(file),
          filename: file.name,
          folderName,
        });
      }
    });

    if (newImages.length > 0) {
      setAccumulatedImages(prev => [...prev, ...newImages]);
      if (mainFolderName && albumName === "Untitled Album") {
        setAlbumName(mainFolderName);
      }
    } else {
      alert("No images found in the selected files.");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    // Attempt to read folder structure if dropped
    // Modern browsers support DataTransferItemList.webkitGetAsEntry
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const files: File[] = [];
      
      const processEntry = (entry: any) => {
        if (entry.isFile) {
          entry.file((file: File) => {
            files.push(file);
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
      
      // Fallback
      setTimeout(() => {
        if (files.length > 0) handleFiles(files);
        else handleFiles(e.dataTransfer.files);
      }, 500);

    } else {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (id: string) => {
    setAccumulatedImages(prev => prev.filter(img => img.id !== id));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12">
      <div className="text-center mb-12 max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-serif italic text-white mb-4">
          Create Your Intelligent Album
        </h1>
        <p className="text-lg text-white/60 mb-6 font-light">
          Upload images or folders to begin. Our AI will automatically categorize your photos based on the event.
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
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "w-full max-w-3xl border-2 border-dashed rounded-[3rem] p-16 text-center transition-colors duration-200 ease-in-out bg-white/5 backdrop-blur-sm",
          isDragging ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/20'
        )}
      >
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <FolderUp className="w-8 h-8 text-white/80" />
        </div>
        <h3 className="text-xl font-medium text-white mb-6">
          Drag and drop your photos here
        </h3>
        
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

        <p className="text-white/40 text-sm">
          Supports JPEG, PNG, WEBP images.
        </p>
        
        {/* Important: webkitdirectory enables folder selection */}
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
          }}
        />
      </div>

      {accumulatedImages.length > 0 && (
        <div className="mt-12 w-full max-w-4xl bg-zinc-900/50 backdrop-blur-sm rounded-[2rem] border border-white/10 p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex items-center gap-3 text-white">
              <ImageIcon className="w-5 h-5 text-[#D4AF37]" />
              <span className="font-medium text-lg">{accumulatedImages.length} images added</span>
            </div>
            <button 
              onClick={() => setShowModeSelector(true)}
              className="px-8 py-3 bg-[#D4AF37] hover:bg-[#c4a133] text-black rounded-full text-xs uppercase tracking-widest font-bold transition-colors shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:shadow-[0_0_25px_rgba(212,175,55,0.5)]"
            >
              Start Analysis
            </button>
          </div>
          
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 max-h-64 overflow-y-auto p-4 bg-black/50 rounded-2xl border border-white/5 custom-scrollbar">
            {accumulatedImages.map((img) => (
              <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden group border border-white/10">
                <img src={img.previewUrl} alt={img.filename} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                <button 
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modern High-End Grouping Mode Selection Modal */}
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
              {/* Subtle background glow */}
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
                  Our Intelligent AI will organize your {accumulatedImages.length} photos into distinct layout sections based on your choice.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {/* Event-Wise (Timeline) Mode Card */}
                <div 
                  onClick={() => setSelectedMode('event')}
                  className={cn(
                    "relative p-6 rounded-3xl border text-left cursor-pointer transition-all duration-300 hover:bg-white/5",
                    selectedMode === 'event' 
                      ? "border-[#D4AF37] bg-[#D4AF37]/5 shadow-[0_0_20px_rgba(212,175,55,0.1)]" 
                      : "border-white/10 bg-zinc-900/30"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      selectedMode === 'event' ? "bg-[#D4AF37] text-black" : "bg-white/5 text-white/80"
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

                {/* Composition/Subject ShotType Mode Card */}
                <div 
                  onClick={() => setSelectedMode('shotType')}
                  className={cn(
                    "relative p-6 rounded-3xl border text-left cursor-pointer transition-all duration-300 hover:bg-white/5",
                    selectedMode === 'shotType' 
                      ? "border-[#D4AF37] bg-[#D4AF37]/5 shadow-[0_0_20px_rgba(212,175,55,0.1)]" 
                      : "border-white/10 bg-zinc-900/30"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      selectedMode === 'shotType' ? "bg-[#D4AF37] text-black" : "bg-white/5 text-white/80"
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
                    onUpload(accumulatedImages, albumName || "Untitled Album", selectedMode);
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
