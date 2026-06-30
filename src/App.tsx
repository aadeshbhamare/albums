import React, { useState, useEffect } from 'react';
import { ImageItem, AlbumSection } from './types';
import { UploadView } from './components/UploadView';
import { AnalysisView } from './components/AnalysisView';
import { ReviewView } from './components/ReviewView';
import { LayoutView } from './components/LayoutView';
import { VideoView } from './components/VideoView';
import { AuthView } from './components/AuthView';
import { ProfileView } from './components/ProfileView';
import { Camera, User, Loader2 } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

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
  const [albumId, setAlbumId] = useState<string | undefined>(undefined);
  const [imageFitMode, setImageFitMode] = useState<'cover' | 'contain'>('cover');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('albumId');

    if (sharedId) {
      getDoc(doc(db, 'shared_albums', sharedId)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFolderName(data.folderName);
          setSections(data.sections);
          setAlbumId(sharedId);
          setStep('layout');
        }
      }).catch(err => console.error("Error loading shared album", err));
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) setShowProfile(false);
    });
    return () => unsubscribe();
  }, []);

  const handleUpload = (uploadedImages: ImageItem[], uploadedFolder: string, mode: 'event' | 'shotType') => {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F]">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (!user) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ duration: 0.4 }}
        className="w-full"
      >
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
              <span className={(step === 'analyzing' || step === 'review') ? 'text-white border-b border-[#D4AF37] pb-1' : 'opacity-50'}>2. Review</span>
              <span className={step === 'layout' ? 'text-white border-b border-[#D4AF37] pb-1' : 'opacity-50'}>3. Layout</span>
              <span className={step === 'video' ? 'text-white border-b border-[#D4AF37] pb-1' : 'opacity-50'}>4. Video</span>
            </div>
            
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
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-800/20 via-transparent to-transparent relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="w-full min-h-full"
          >
            {step === 'upload' && <UploadView onUpload={handleUpload} />}
            {step === 'analyzing' && <AnalysisView images={images} folderName={folderName} groupingMode={groupingMode} onAnalysisComplete={handleAnalysisComplete} />}
            {step === 'review' && <ReviewView images={images} folderName={folderName} onProceed={handleProceedToLayout} />}
            {step === 'layout' && (
              <LayoutView 
                sections={sections} 
                folderName={folderName} 
                onProceedToVideo={() => setStep('video')} 
                albumId={albumId} 
                onAlbumShared={(id) => setAlbumId(id)} 
                imageFitMode={imageFitMode}
                setImageFitMode={setImageFitMode}
              />
            )}
            {step === 'video' && (
              <VideoView 
                sections={sections} 
                folderName={folderName} 
                imageFitMode={imageFitMode}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
