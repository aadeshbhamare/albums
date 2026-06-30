import React, { useEffect, useState } from 'react';
import { listAlbums, deleteAlbum, AlbumState } from '../lib/albumPersistence';
import { deleteImages, clearAllImages } from '../lib/imageStore';
import { Loader as Loader2, Trash2, FolderOpen, Camera, ArrowLeft, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

interface DashboardViewProps {
  onOpenAlbum: (album: AlbumState) => void;
  onNewAlbum: () => void;
  onBack: () => void;
}

export function DashboardView({ onOpenAlbum, onNewAlbum, onBack }: DashboardViewProps) {
  const [albums, setAlbums] = useState<AlbumState[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await listAlbums();
      setAlbums(list);
    } catch (err) {
      console.error('Failed to load albums', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (album: AlbumState) => {
    if (!confirm(`Delete "${album.folder_name}"? This removes the album and all its photos permanently.`)) return;
    setDeletingId(album.id);
    try {
      // Collect all image ids across sections.
      const imageIds: string[] = [];
      for (const section of album.sections) {
        for (const img of section.images) {
          imageIds.push(img.id);
        }
      }
      await deleteImages(imageIds);
      await deleteAlbum(album.id);
      setAlbums((prev) => prev.filter((a) => a.id !== album.id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete album');
    } finally {
      setDeletingId(null);
    }
  };

  const stepLabel: Record<string, string> = {
    upload: 'Upload',
    analyzing: 'Analyzing',
    review: 'Review',
    layout: 'Layout',
    video: 'Video',
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-serif italic text-white">My Albums</h1>
        </div>
        <button
          onClick={onNewAlbum}
          className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#c4a133] text-black px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Album
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
        </div>
      ) : albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Camera className="w-16 h-16 text-white/20 mb-6" />
          <h2 className="text-2xl font-serif italic text-white/60 mb-3">No albums yet</h2>
          <p className="text-white/40 mb-8 font-light">Create your first intelligent photo album.</p>
          <button
            onClick={onNewAlbum}
            className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#c4a133] text-black px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Album
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {albums.map((album) => (
            <div
              key={album.id}
              className="group relative bg-zinc-900/50 backdrop-blur-sm rounded-3xl border border-white/10 p-6 hover:border-[#D4AF37]/40 transition-all cursor-pointer overflow-hidden"
              onClick={() => onOpenAlbum(album)}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-[60px] pointer-events-none" />
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                  <FolderOpen className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(album);
                  }}
                  disabled={deletingId === album.id}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                >
                  {deletingId === album.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
              <h3 className="text-lg font-serif italic text-white mb-1 truncate">{album.folder_name}</h3>
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/40">
                <span>{album.image_count.toLocaleString()} photos</span>
                <span className="text-[#D4AF37]">{stepLabel[album.step] || album.step}</span>
              </div>
              {album.updated_at && (
                <p className="text-[10px] text-white/30 mt-2">
                  Updated {new Date(album.updated_at).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
