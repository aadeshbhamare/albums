import React, { useMemo, useState, useEffect } from 'react';
import { AlbumSection, ImageItem } from '../types';
import { Check, CreditCard as Edit2, ArrowRight, Wand as Wand2, Loader as Loader2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { getObjectUrl, getImage, putImage, deleteImage } from '../lib/imageStore';

interface ReviewViewProps {
  images: ImageItem[];
  folderName: string;
  onProceed: (sections: AlbumSection[]) => void;
  onImagesChange?: (images: ImageItem[]) => void;
}

function ReviewThumb({ id, className }: { id: string; className?: string }) {
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
  if (!url) return <div className={cn('w-full h-full bg-zinc-800 animate-pulse', className)} />;
  return <img src={url} alt="" className={className} />;
}

export function ReviewView({ images, folderName, onProceed, onImagesChange }: ReviewViewProps) {
  const [localImages, setLocalImages] = useState<ImageItem[]>(images);
  const [editingSectionFor, setEditingSectionFor] = useState<string | null>(null);
  const [aiEditingFor, setAiEditingFor] = useState<string | null>(null);
  const [aiEditPrompt, setAiEditPrompt] = useState('');
  const [isAiEditing, setIsAiEditing] = useState(false);

  const sections = useMemo(() => {
    const grouped: Record<string, ImageItem[]> = {};
    localImages.forEach((img) => {
      const sec = img.section || 'Uncategorized';
      if (!grouped[sec]) grouped[sec] = [];
      grouped[sec].push(img);
    });
    return Object.entries(grouped).map(([name, imgs]) => ({
      id: name,
      name,
      images: imgs,
    }));
  }, [localImages]);

  const allSectionNames = Array.from(new Set(localImages.map((img) => img.section || 'Uncategorized'))) as string[];

  const handleSectionChange = (imageId: string, newSection: string) => {
    const updated = localImages.map((img) => (img.id === imageId ? { ...img, section: newSection } : img));
    setLocalImages(updated);
    onImagesChange?.(updated);
    setEditingSectionFor(null);
  };

  const handleDeleteImage = async (imageId: string) => {
    await deleteImage(imageId);
    const updated = localImages.filter((img) => img.id !== imageId);
    setLocalImages(updated);
    onImagesChange?.(updated);
  };

  const handleAiEdit = async (img: ImageItem) => {
    if (!aiEditPrompt.trim()) return;
    setIsAiEditing(true);
    try {
      const stored = await getImage(img.id);
      if (!stored) {
        alert('Could not load image for editing.');
        return;
      }
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(stored.blob);
      });

      const res = await fetch('/api/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiEditPrompt,
          imageBase64: base64,
          mimeType: img.mimeType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.imageBase64) {
          // Replace the blob in IndexedDB with the edited version.
          const editedBlob = await (await fetch(`data:${data.mimeType};base64,${data.imageBase64}`)).blob();
          await putImage(img.id, {
            id: img.id,
            blob: editedBlob,
            filename: img.filename,
            folderName: img.folderName,
            mimeType: data.mimeType,
            size: editedBlob.size,
          });
          // Force a refresh of the thumbnail by toggling state.
          setLocalImages((prev) => [...prev]);
        }
      } else {
        alert('Failed to edit image');
      }
    } catch (e) {
      console.error(e);
      alert('Error editing image');
    } finally {
      setIsAiEditing(false);
      setAiEditingFor(null);
      setAiEditPrompt('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 border-b border-white/10 pb-8">
        <div>
          <h1 className="text-3xl font-serif italic text-white mb-2">Review Categories</h1>
          <p className="text-white/60 font-light">
            Album: <span className="font-medium text-[#D4AF37]">{folderName}</span>. AI has sorted your photos. Move, edit, or delete them.
          </p>
        </div>
        <button
          onClick={() => onProceed(sections)}
          className="mt-6 md:mt-0 flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
        >
          Generate Album Layout
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-16">
        {sections.map((section) => (
          <div key={section.id} className="border-b border-white/10 pb-12 last:border-0">
            <h2 className="text-2xl font-serif italic text-white mb-6 flex items-center gap-3">
              {section.name}
              <span className="bg-white/10 text-white/60 text-[10px] uppercase tracking-widest py-1 px-3 rounded-full font-medium">
                {section.images.length} photos
              </span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {section.images.map((img) => (
                <div key={img.id} className="group relative aspect-square rounded-3xl overflow-hidden bg-zinc-800 border border-white/5">
                  <ReviewThumb id={img.id} className="w-full h-full object-cover" />

                  <div
                    className={cn(
                      'absolute inset-0 bg-black/60 opacity-0 transition-opacity duration-200 p-2 flex flex-col justify-end',
                      editingSectionFor === img.id || aiEditingFor === img.id ? 'opacity-100' : 'group-hover:opacity-100'
                    )}
                  >
                    {aiEditingFor === img.id ? (
                      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-white mb-2">AI Edit:</p>
                        <input
                          type="text"
                          value={aiEditPrompt}
                          onChange={(e) => setAiEditPrompt(e.target.value)}
                          placeholder="e.g. make it vintage..."
                          className="w-full text-sm bg-black/50 border border-white/20 text-white rounded px-2 py-1.5 mb-2 focus:outline-none focus:border-[#D4AF37]"
                          disabled={isAiEditing}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setAiEditingFor(null)}
                            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-1.5 rounded text-[10px] uppercase tracking-wider font-bold"
                            disabled={isAiEditing}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAiEdit(img)}
                            className="flex-1 bg-[#D4AF37] hover:bg-[#c4a133] text-black py-1.5 rounded text-[10px] uppercase tracking-wider font-bold flex items-center justify-center gap-1"
                            disabled={isAiEditing || !aiEditPrompt.trim()}
                          >
                            {isAiEditing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                          </button>
                        </div>
                      </div>
                    ) : editingSectionFor === img.id ? (
                      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-white mb-2 p-1">Move to:</p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {allSectionNames
                            .filter((n) => n !== section.name)
                            .map((n) => (
                              <button
                                key={n}
                                onClick={() => handleSectionChange(img.id, n)}
                                className="w-full text-left px-2 py-1.5 text-xs text-white/80 hover:bg-white/10 rounded"
                              >
                                {n}
                              </button>
                            ))}
                          <div className="h-px bg-white/10 my-1" />
                          <button
                            onClick={() => {
                              const newName = prompt('Enter new section name:');
                              if (newName && newName.trim()) {
                                handleSectionChange(img.id, newName.trim());
                              }
                            }}
                            className="w-full text-left px-2 py-1.5 text-xs text-[#D4AF37] hover:bg-white/5 rounded"
                          >
                            + New Section...
                          </button>
                          <button
                            onClick={() => setEditingSectionFor(null)}
                            className="w-full mt-1 text-center px-2 py-1.5 text-[10px] uppercase tracking-wider text-white/50 hover:bg-white/5 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAiEditingFor(img.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-white py-2 px-2 rounded-xl text-[10px] uppercase tracking-widest font-bold hover:bg-white/20 transition-colors"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => setEditingSectionFor(img.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-white py-2 px-2 rounded-xl text-[10px] uppercase tracking-widest font-bold hover:bg-white/20 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Move
                        </button>
                        <button
                          onClick={() => handleDeleteImage(img.id)}
                          className="flex items-center justify-center gap-1.5 bg-red-500/20 backdrop-blur-md border border-red-500/30 text-red-300 py-2 px-2 rounded-xl text-[10px] uppercase tracking-widest font-bold hover:bg-red-500/40 transition-colors"
                          title="Delete this photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
