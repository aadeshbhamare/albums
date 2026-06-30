import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ImageItem, AlbumSection } from './types';
import { UploadView } from './components/UploadView';
import { AnalysisView } from './components/AnalysisView';
import { ReviewView } from './components/ReviewView';
import { LayoutView } from './components/LayoutView';
import { VideoView } from './components/VideoView';
import { AuthView } from './components/AuthView';
import { ProfileView } from './components/ProfileView';
import { DashboardView } from './components/DashboardView';
import { Camera, User, Loader as Loader2, Trash2, LayoutGrid } from 'lucide-react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import {
  getCurrentAlbumId,
  setCurrentAlbumId,
  loadAlbum,
  saveAlbumDebounced,
  saveAlbum,
  deleteAlbum,
  AlbumState,
  PersistedSection,
} from './lib/albumPersistence';
import { deleteImages } from './lib/imageStore';
import { v4 as uuidv4 } from 'uuid';

type Step = 'upload' | 'analyzing' | 'review' | 'layout' | 'video';

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [folderName, setFolderName] = useState<string>('Untitled Album');
  const [sections, setSections] = useState<AlbumSection[]>([]);
  const [groupingMode, setGroupingMode] = useState<'event' | 'shotType'>('event');

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [albumId, setAlbumId] = useState<string | undefined>(undefined);
  const [imageFitMode, setImageFitMode] = useState<'cover' | 'contain'>('cover');
  const [restoring, setRestoring] = useState(false);

  const albumIdRef = useRef<string | undefined>(undefined);
  const stepRef = useRef<Step>('upload');

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // Restore album on load (from URL param or localStorage current album id).
  useEffect(() => {
    const restore = async () => {
      const params = new URLSearchParams(window.location.search);
      const sharedId = params.get('albumId') || getCurrentAlbumId();

      if (sharedId) {
        setRestoring(true);
        try {
          const album = await loadAlbum(sharedId);
          if (album) {
            setAlbumId(album.id);
            albumIdRef.current = album.id;
            setCurrentAlbumId(album.id);
            setFolderName(album.folder_name);
            setGroupingMode(album.grouping_mode as 'event' | 'shotType');
            setImageFitMode(album.image_fit_mode as 'cover' | 'contain');
            const restoredSections = (album.sections || []) as PersistedSection[];
            setSections(restoredSections);
            // Flatten sections to get all images for review step.
            const allImages: ImageItem[] = restoredSections.flatMap((s) => s.images);
            setImages(allImages);
            setStep(album.step as Step);
          }
        } catch (err) {
          console.error('Error restoring album', err);
        } finally {
          setRestoring(false);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        setShowProfile(false);
        setShowDashboard(false);
      }
    });

    restore();
    return () => unsubscribe();
  }, []);

  // Autosave: whenever key state changes, persist to Supabase (debounced).
  const persistState = useCallback(
    (currentStep: Step, currentImages: ImageItem[], currentSections: AlbumSection[]) => {
      const id = albumIdRef.current;
      if (!id) return;

      // Build persisted sections: if we have sections use them, else wrap images.
      let persistedSections: PersistedSection[];
      if (currentSections.length > 0) {
        persistedSections = currentSections.map((s) => ({
          id: s.id,
          name: s.name,
          template: s.template,
          images: s.images.map((img) => ({
            id: img.id,
            filename: img.filename,
            folderName: img.folderName,
            mimeType: img.mimeType,
            size: img.size,
            section: img.section,
            description: img.description,
          })),
        }));
      } else {
        persistedSections = [
          {
            id: 'all',
            name: 'All Photos',
            images: currentImages.map((img) => ({
              id: img.id,
              filename: img.filename,
              folderName: img.folderName,
              mimeType: img.mimeType,
              size: img.size,
              section: img.section,
              description: img.description,
            })),
          },
        ];
      }

      const state: AlbumState = {
        id,
        folder_name: folderName,
        grouping_mode: groupingMode,
        step: currentStep,
        sections: persistedSections,
        image_fit_mode: imageFitMode,
        image_count: currentImages.length || currentSections.reduce((n, s) => n + s.images.length, 0),
      };
      saveAlbumDebounced(state);
    },
    [folderName, groupingMode, imageFitMode]
  );

  useEffect(() => {
    if (albumIdRef.current && !restoring) {
      persistState(step, images, sections);
    }
  }, [step, images, sections, persistState, restoring]);

  const handleUpload = (uploadedImages: ImageItem[], uploadedFolder: string, mode: 'event' | 'shotType') => {
    // Create a new album id if none exists.
    if (!albumIdRef.current) {
      const newId = uuidv4();
      albumIdRef.current = newId;
      setAlbumId(newId);
      setCurrentAlbumId(newId);
    }
    setImages(uploadedImages);
    setFolderName(uploadedFolder);
    setGroupingMode(mode);
    setStep('analyzing');
  };

  const handleAnalysisComplete = (analyzedImages: ImageItem[]) => {
    setImages(analyzedImages);
    setStep('review');
  };

  const handleProceedToLayout = (finalSections: AlbumSection[]) => {
    setSections(finalSections);
    setStep('layout');
  };

  const handleImagesChange = (updated: ImageItem[]) => {
    setImages(updated);
  };

  const handleSectionsChange = (updated: AlbumSection[]) => {
    setSections(updated);
  };

  // Delete the entire album and start fresh.
  const handleDeleteAlbum = async () => {
    if (!confirm('Delete this album and all its photos? This cannot be undone.')) return;
    const id = albumIdRef.current;
    if (id) {
      try {
        // Delete image blobs from IndexedDB.
        const allIds = sections.length > 0
          ? sections.flatMap((s) => s.images.map((img) => img.id))
          : images.map((img) => img.id);
        if (allIds.length > 0) await deleteImages(allIds);
        await deleteAlbum(id);
      } catch (err) {
        console.error('Failed to delete album', err);
      }
    }
    // Reset all state.
    setCurrentAlbumId(null);
    albumIdRef.current = undefined;
    setAlbumId(undefined);
    setImages([]);
    setSections([]);
    setFolderName('Untitled Album');
    setStep('upload');
    // Clear URL param.
    const url = new URL(window.location.href);
    url.searchParams.delete('albumId');
    window.history.replaceState({}, '', url.toString());
  };

  const handleNewAlbum = () => {
    setShowDashboard(false);
    setCurrentAlbumId(null);
    albumIdRef.current = undefined;
    setAlbumId(undefined);
    setImages([]);
    setSections([]);
    setFolderName('Untitled Album');
    setStep('upload');
    const url = new URL(window.location.href);
    url.searchParams.delete('albumId');
    window.history.replaceState({}, '', url.toString());
  };

  const handleOpenAlbum = (album: AlbumState) => {
    setShowDashboard(false);
    setAlbumId(album.id);
    albumIdRef.current = album.id;
    setCurrentAlbumId(album.id);
    setFolderName(album.folder_name);
    setGroupingMode(album.grouping_mode as 'event' | 'shotType');
    setImageFitMode(album.image_fit_mode as 'cover' | 'contain');
    const restoredSections = (album.sections || []) as PersistedSection[];
    setSections(restoredSections);
    const allImages: ImageItem[] = restoredSections.flatMap((s) => s.images);
    setImages(allImages);
    setStep(album.step as Step);
  };

  if (loading || restoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F]">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (!user) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="w-full">
        <AuthView onLogin={() => {}} />
      </motion.div>
    );
  }

  if (showProfile) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen bg-[#0F0F0F] text-[#E0D7D0] font-sans overflow-y-auto"
      >
        <ProfileView onBack={() => setShowProfile(false)} />
      </motion.div>
    );
  }

  if (showDashboard) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen bg-[#0F0F0F] text-[#E0D7D0] font-sans overflow-y-auto"
      >
        <DashboardView onOpenAlbum={handleOpenAlbum} onNewAlbum={handleNewAlbum} onBack={() => setShowDashboard(false)} />
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0F0F0F] text-[#E0D7D0] font-sans selection:bg-[#D4AF37]/30 overflow-hidden">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 bg-[#0F0F0F]/80 backdrop-blur-md z-50">
        <div className="px-10 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4 text-white">
            <Camera className="w-6 h-6 text-[#D4AF37]" />
            <span className="text-3xl font-serif italic tracking-tight">Lumina Albums</span>
          </div>
          <div className="flex items-center gap-12">
            <div className="flex gap-8 text-[10px] uppercase tracking-[0.2em] font-medium hidden md:flex">
              <span className={step === 'upload' ? 'text-white border-b border-[#D4AF37] pb-1' : 'opacity-50'}>1. Upload</span>
              <span className={step === 'analyzing' || step === 'review' ? 'text-white border-b border-[#D4AF37] pb-1' : 'opacity-50'}>
                2. Review
              </span>
              <span className={step === 'layout' ? 'text-white border-b border-[#D4AF37] pb-1' : 'opacity-50'}>3. Layout</span>
              <span className={step === 'video' ? 'text-white border-b border-[#D4AF37] pb-1' : 'opacity-50'}>4. Video</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Delete album button — visible once an album is in progress */}
              {albumId && (
                <button
                  onClick={handleDeleteAlbum}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 transition-colors text-white/60"
                  title="Delete this album and start over"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* My Albums dashboard */}
              <button
                onClick={() => setShowDashboard(true)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/60"
                title="My Albums"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-[#D4AF37]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-800/20 via-transparent to-transparent relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full min-h-full"
          >
            {step === 'upload' && (
              <UploadView
                onUpload={handleUpload}
                initialImages={images}
                initialFolderName={folderName}
              />
            )}
            {step === 'analyzing' && (
              <AnalysisView
                images={images}
                folderName={folderName}
                groupingMode={groupingMode}
                onAnalysisComplete={handleAnalysisComplete}
              />
            )}
            {step === 'review' && (
              <ReviewView
                images={images}
                folderName={folderName}
                onProceed={handleProceedToLayout}
                onImagesChange={handleImagesChange}
              />
            )}
            {step === 'layout' && (
              <LayoutView
                sections={sections}
                folderName={folderName}
                onProceedToVideo={() => setStep('video')}
                albumId={albumId}
                onAlbumShared={(id) => setAlbumId(id)}
                onSectionsChange={handleSectionsChange}
                imageFitMode={imageFitMode}
                setImageFitMode={setImageFitMode}
              />
            )}
            {step === 'video' && <VideoView sections={sections} folderName={folderName} imageFitMode={imageFitMode} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
