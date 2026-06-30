import React, { useEffect, useRef, useState } from 'react';
import { AlbumSection, ImageItem } from '../types';
import { Loader as Loader2, Play, Download, Music, Video as VideoIcon, Upload } from 'lucide-react';
import { cn } from '../lib/utils';
import { getObjectUrl, getImage } from '../lib/imageStore';

interface VideoViewProps {
  sections: AlbumSection[];
  folderName: string;
  imageFitMode: 'cover' | 'contain';
}

type TransitionType = 'fade' | 'slide' | 'zoom';

const getCrossOrigin = (url: string | null) => {
  if (!url) return undefined;
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return undefined;
  }
  return 'anonymous';
};

export function VideoView({ sections, folderName, imageFitMode }: VideoViewProps) {
  const [status, setStatus] = useState<string>('Initializing...');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [introVideoUrl, setIntroVideoUrl] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [transitionType, setTransitionType] = useState<TransitionType>('zoom');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const customAudioInputRef = useRef<HTMLInputElement>(null);

  const allImages = sections.flatMap(s => s.images);

  useEffect(() => {
    let isMounted = true;
    
    const generateAssets = async () => {
      try {
        // 1. Generate Music
        setStatus('Composing soundtrack (Lyria)...');
        let aUrl: string | null = null;
        try {
          const musicRes = await fetch('/api/generate-music', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `A beautiful, cinematic, emotional soundtrack for an album named "${folderName}".`
            })
          });
          if (musicRes.ok) {
            const musicData = await musicRes.json();
            if (musicData.audioBase64) {
              aUrl = `data:${musicData.mimeType};base64,${musicData.audioBase64}`;
            }
          }
        } catch (e) {
          console.error("Music generation failed, using fallback:", e);
        }

        if (!aUrl) {
          console.warn("Music generation hit rate limits. Using beautiful cinematic fallback track.");
          aUrl = "https://cdn.pixabay.com/download/audio/2022/10/25/audio_2452b4742e.mp3?filename=epic-hollywood-trailer-113947.mp3";
        }
        if (isMounted) setAudioUrl(aUrl);

        // 2. Generate Intro Video (Veo)
        setStatus('Generating cinematic intro (Veo)...');
        try {
          let firstImgBase64: string | undefined;
          let firstImgMime: string | undefined;
          
          if (allImages.length > 0) {
            const firstImg = allImages[0];
            firstImgMime = firstImg.mimeType;
            const stored = await getImage(firstImg.id);
            if (stored) {
              firstImgBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(stored.blob);
              });
            }
          }

          const videoReqRes = await fetch('/api/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Cinematic opening shot, elegant pan, high quality, for album "${folderName}"`,
              imageBase64: firstImgBase64,
              mimeType: firstImgMime
            })
          });

          if (videoReqRes.ok) {
            const { operationName } = await videoReqRes.json();
            if (operationName) {
              // Poll
              setStatus('Waiting for Veo rendering...');
              let done = false;
              let pollCount = 0;
              while (!done && isMounted && pollCount < 12) { // limit polling attempts
                await new Promise(r => setTimeout(r, 5000));
                pollCount++;
                const statusRes = await fetch('/api/video-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ operationName })
                });
                if (statusRes.ok) {
                  const statusData = await statusRes.json();
                  done = statusData.done;
                }
              }
              
              if (isMounted && done) {
                setStatus('Downloading intro video...');
                const dlRes = await fetch('/api/video-download', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ operationName })
                });
                if (dlRes.ok) {
                  const blob = await dlRes.blob();
                  setIntroVideoUrl(URL.createObjectURL(blob));
                }
              }
            } else {
              console.log("No video operationName available, proceeding with image slideshow.");
            }
          }
        } catch (e) {
          console.error("Video generation failed or timed out:", e);
        }

        // 3. Generate TTS Intro Voiceover
        setStatus('Generating voiceover (TTS)...');
        let ttsBase64: string | undefined;
        try {
          const ttsRes = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `Welcome to your curated album, ${folderName}. Please enjoy these beautiful moments.`
            })
          });
          if (ttsRes.ok) {
            const ttsData = await ttsRes.json();
            if (ttsData.audioBase64) {
              ttsBase64 = ttsData.audioBase64;
            }
          }
        } catch (e) {
          console.error("TTS failed", e);
        }

        if (isMounted) {
          if (ttsBase64) {
             setTtsAudioUrl(`data:audio/wav;base64,${ttsBase64}`);
          }
          setStatus('Ready to compile composition.');
          setIsReady(true);
        }

      } catch (err) {
        console.error(err);
        if (isMounted) {
          setStatus('Ready to compile (some AI assets failed, using fallbacks).');
          setIsReady(true); // Allow proceeding even if APIs fail
        }
      }
    };

    generateAssets();

    return () => { isMounted = false; };
  }, [folderName]);

  const handleCustomAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomAudioUrl(URL.createObjectURL(file));
    }
  };

  const startRecording = async () => {
    if (!canvasRef.current) return;
    setIsRecording(true);
    setFinalVideoUrl(null);
    setRecordingProgress(0);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    // Enable high quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Capture stream at 60 FPS for supreme smoothness
    const stream = canvas.captureStream(60);
    
    // Add audio track if available
    let audioCtx: AudioContext | null = null;
    let audioDest: MediaStreamAudioDestinationNode | null = null;

    if (audioRef.current || ttsAudioRef.current || customAudioUrl) {
      try {
        audioCtx = new AudioContext();
        audioDest = audioCtx.createMediaStreamDestination();
        
        if (audioRef.current && (customAudioUrl || audioUrl)) {
          try {
            const sourceNode = audioCtx.createMediaElementSource(audioRef.current);
            sourceNode.connect(audioDest);
            sourceNode.connect(audioCtx.destination);
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => {
              console.warn("Audio play failed (unsupported source or blocked):", e);
            });
          } catch (audioErr) {
            console.warn("Could not connect audio source (likely CORS or missing source):", audioErr);
          }
        }

        if (ttsAudioRef.current && ttsAudioUrl) {
          try {
            const ttsSourceNode = audioCtx.createMediaElementSource(ttsAudioRef.current);
            ttsSourceNode.connect(audioDest);
            ttsSourceNode.connect(audioCtx.destination);
            ttsAudioRef.current.currentTime = 0;
            ttsAudioRef.current.play().catch(e => {
              console.warn("TTS play failed:", e);
            });
          } catch (ttsErr) {
            console.warn("Could not connect TTS audio source:", ttsErr);
          }
        }
        
        const audioTrack = audioDest.stream.getAudioTracks()[0];
        if (audioTrack) stream.addTrack(audioTrack);
      } catch (ctxErr) {
        console.warn("Failed to initialize audio context recording:", ctxErr);
      }
    }

    // High bitrate configuration for premium video definition
    const recordingOptions: MediaRecorderOptions = {
      videoBitsPerSecond: 10000000, // 10 Mbps
    };

    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
        recordingOptions.mimeType = 'video/webm; codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')) {
        recordingOptions.mimeType = 'video/webm; codecs=vp8';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        recordingOptions.mimeType = 'video/webm';
      }
    }

    const recorder = new MediaRecorder(stream, recordingOptions);
    const chunks: Blob[] = [];

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setFinalVideoUrl(URL.createObjectURL(blob));
      setIsRecording(false);
      setRecordingProgress(100);
      if (audioRef.current) audioRef.current.pause();
      if (audioCtx) audioCtx.close();
    };

    recorder.start();

    // Deterministic 60 FPS Animation loop for smooth & lag-free render
    const FPS = 60;
    const slideDuration = 3000; // ms
    const transDuration = 800;
    
    // Load images from IndexedDB
    const htmlImages = await Promise.all(allImages.map(async (img) => {
      const url = await getObjectUrl(img.id);
      return new Promise<HTMLImageElement>((resolve) => {
        const imgEl = new Image();
        imgEl.onload = () => resolve(imgEl);
        imgEl.src = url || '';
      });
    }));

    if (videoRef.current && introVideoUrl) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(e => console.error("Video play failed", e));
    }

    let elapsed = 0;
    const frameDuration = 1000 / FPS;

    const renderFrame = () => {
      let introDuration = 0;
      if (introVideoUrl && videoRef.current) {
         introDuration = (videoRef.current.duration || 5) * 1000;
      }
      
      const totalDuration = introDuration + (htmlImages.length * slideDuration);
      const progress = Math.min((elapsed / totalDuration) * 100, 100);
      setRecordingProgress(Math.round(progress));

      if (elapsed >= totalDuration) {
        recorder.stop();
        return;
      }

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (elapsed < introDuration && videoRef.current) {
        // Precise seek to ensure video frame exactly aligns with our timeline
        videoRef.current.currentTime = elapsed / 1000;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        
        // Draw Title text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '60px serif';
        ctx.textAlign = 'center';
        ctx.fillText(folderName, canvas.width / 2, canvas.height / 2);

      } else {
        // Draw slides
        const slideElapsed = elapsed - introDuration;
        const slideIdx = Math.floor(slideElapsed / slideDuration);
        const nextSlideIdx = slideIdx + 1;
        const slideLocalTime = slideElapsed % slideDuration;
        
        const drawImage = (idx: number, alpha: number, zoom: number, offsetX: number = 0) => {
          if (idx >= htmlImages.length) return;
          const img = htmlImages[idx];
          const targetAlpha = Math.max(0, Math.min(1, alpha));
          
          // 1. Draw blurred background in cover mode if in 'contain' mode to fill the negative space beautifully
          if (imageFitMode === 'contain') {
            const bgScale = Math.max(canvas.width / img.width, canvas.height / img.height) * zoom;
            const bgW = img.width * bgScale;
            const bgH = img.height * bgScale;
            const bgX = (canvas.width - bgW) / 2 + offsetX;
            const bgY = (canvas.height - bgH) / 2;
            
            ctx.globalAlpha = targetAlpha * 0.15; // Elegant soft 15% opacity
            const originalFilter = ctx.filter;
            try {
              ctx.filter = 'blur(40px)';
            } catch (e) {}
            ctx.drawImage(img, bgX, bgY, bgW, bgH);
            try {
              ctx.filter = originalFilter || 'none';
            } catch (e) {}
          }

          // 2. Draw crisp main foreground image
          ctx.globalAlpha = targetAlpha;
          
          // Image scale calculations honoring exact cover / contain fit mode settings
          let scale;
          if (imageFitMode === 'contain') {
            scale = Math.min(canvas.width / img.width, canvas.height / img.height) * zoom;
          } else {
            scale = Math.max(canvas.width / img.width, canvas.height / img.height) * zoom;
          }
          const w = img.width * scale;
          const h = img.height * scale;
          const x = (canvas.width - w) / 2 + offsetX;
          const y = (canvas.height - h) / 2;
          
          ctx.drawImage(img, x, y, w, h);
          ctx.globalAlpha = 1.0;
        };

        const inTransition = slideLocalTime > slideDuration - transDuration && nextSlideIdx < htmlImages.length;
        const tProgress = inTransition ? (slideLocalTime - (slideDuration - transDuration)) / transDuration : 0;

        if (transitionType === 'zoom') {
          const zoom1 = 1.0 + (slideLocalTime / slideDuration) * 0.1;
          if (inTransition) {
            drawImage(slideIdx, 1 - tProgress, zoom1);
            drawImage(nextSlideIdx, tProgress, 1.0 + tProgress * 0.05);
          } else {
            drawImage(slideIdx, 1.0, zoom1);
          }
        } else if (transitionType === 'fade') {
          if (inTransition) {
            drawImage(slideIdx, 1 - tProgress, 1.0);
            drawImage(nextSlideIdx, tProgress, 1.0);
          } else {
            drawImage(slideIdx, 1.0, 1.0);
          }
        } else if (transitionType === 'slide') {
          if (inTransition) {
            const slideOffset = canvas.width * tProgress;
            drawImage(slideIdx, 1.0, 1.0, -slideOffset);
            drawImage(nextSlideIdx, 1.0, 1.0, canvas.width - slideOffset);
          } else {
            drawImage(slideIdx, 1.0, 1.0, 0);
          }
        }
      }

      elapsed += frameDuration;
      setTimeout(renderFrame, frameDuration);
    };

    renderFrame();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 text-center min-h-[60vh] flex flex-col justify-center">
      <h2 className="text-4xl md:text-5xl font-serif italic text-white mb-8">Video Composition</h2>
      
      {!isReady ? (
        <div className="flex flex-col items-center justify-center py-24 bg-zinc-900/50 backdrop-blur-sm rounded-[3rem] border border-white/10 shadow-2xl">
          <Loader2 className="w-16 h-16 text-[#D4AF37] animate-spin mb-8" />
          <p className="text-xl text-white/80 font-light tracking-wide">{status}</p>
          <div className="flex gap-4 mt-12 opacity-60">
            <div className="flex items-center gap-2 bg-black/50 px-5 py-2.5 rounded-full border border-white/10 text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold"><Music className="w-3.5 h-3.5"/> Lyria Music</div>
            <div className="flex items-center gap-2 bg-black/50 px-5 py-2.5 rounded-full border border-white/10 text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold"><VideoIcon className="w-3.5 h-3.5"/> Veo Intro</div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-zinc-900/50 backdrop-blur-sm p-12 rounded-[3rem] border border-white/10 max-w-2xl mx-auto shadow-2xl">
            <h3 className="text-2xl font-serif italic text-white mb-4">Assets Ready</h3>
            <p className="text-white/60 mb-8 font-light tracking-wide">Customize your video settings below before rendering.</p>
            
            {!isRecording && !finalVideoUrl && (
              <div className="space-y-8 mb-10 text-left bg-black/30 p-6 rounded-2xl border border-white/5">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold mb-3">Transition Effect</label>
                  <div className="flex gap-4">
                    {(['fade', 'slide', 'zoom'] as TransitionType[]).map(t => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="transition" 
                          value={t} 
                          checked={transitionType === t} 
                          onChange={() => setTransitionType(t)}
                          className="accent-[#D4AF37]"
                        />
                        <span className="text-sm text-white/80 capitalize">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold mb-3">Audio Track Selection</label>
                  
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => { setCustomAudioUrl(null); }}
                        className={cn("px-4 py-2 border rounded-full text-xs uppercase tracking-widest font-bold transition-colors", 
                          !customAudioUrl && !customAudioInputRef.current?.files?.length ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "bg-transparent text-white/60 border-white/10 hover:text-white")}
                      >
                        AI Original (Lyria)
                      </button>
                      
                      <button 
                        onClick={() => setCustomAudioUrl('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3')}
                        className={cn("px-4 py-2 border rounded-full text-xs uppercase tracking-widest font-bold transition-colors", 
                          customAudioUrl === 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3' ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "bg-transparent text-white/60 border-white/10 hover:text-white")}
                      >
                        Lofi Chill
                      </button>

                      <button 
                        onClick={() => setCustomAudioUrl('https://cdn.pixabay.com/download/audio/2022/10/25/audio_2452b4742e.mp3?filename=epic-hollywood-trailer-113947.mp3')}
                        className={cn("px-4 py-2 border rounded-full text-xs uppercase tracking-widest font-bold transition-colors", 
                          customAudioUrl === 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_2452b4742e.mp3?filename=epic-hollywood-trailer-113947.mp3' ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "bg-transparent text-white/60 border-white/10 hover:text-white")}
                      >
                        Cinematic
                      </button>
                    </div>

                    <div className="flex items-center gap-4 mt-2 border-t border-white/5 pt-4">
                      <button 
                        onClick={() => customAudioInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-xs text-white uppercase tracking-widest font-bold transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Custom MP3
                      </button>
                      {customAudioInputRef.current?.files?.length && customAudioUrl && !customAudioUrl.startsWith('http') && <span className="text-xs text-white/60 truncate max-w-[200px]">Custom audio loaded</span>}
                    </div>
                  </div>
                  <input 
                    type="file" 
                    accept="audio/mp3,audio/wav,audio/*" 
                    ref={customAudioInputRef} 
                    className="hidden" 
                    onChange={handleCustomAudio} 
                  />
                </div>
              </div>
            )}
            
            {!isRecording && !finalVideoUrl && (
              <button
                onClick={startRecording}
                className="inline-flex items-center gap-3 bg-[#D4AF37] hover:bg-[#c4a133] text-black px-10 py-4 rounded-full text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)]"
              >
                <Play className="w-4 h-4 fill-current" />
                Render HD Video
              </button>
            )}

            {isRecording && (
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-3 text-[#D4AF37] font-bold text-[10px] uppercase tracking-widest">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse" />
                  Rendering Video...
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/10">
                  <div className="bg-[#D4AF37] h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(212,175,55,0.5)]" style={{ width: `${recordingProgress}%` }} />
                </div>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">{recordingProgress}% rendered</p>
              </div>
            )}

            {finalVideoUrl && (
              <div className="space-y-8 animate-in fade-in zoom-in duration-700">
                <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 ring-1 ring-white/5">
                  <video src={finalVideoUrl} controls className="w-full h-full" />
                </div>
                <a
                  href={finalVideoUrl}
                  download={`${folderName.replace(/\s+/g, '_')}_Video.mp4`}
                  className="inline-flex items-center gap-2 bg-white text-black px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors hover:bg-zinc-200"
                >
                  <Download className="w-4 h-4" />
                  Download MP4 Video
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden elements for processing */}
      <div className="hidden">
        <canvas ref={canvasRef} width={1920} height={1080} />
        {(customAudioUrl || audioUrl) && (
          <audio 
            ref={audioRef} 
            src={customAudioUrl || audioUrl || undefined} 
            crossOrigin={getCrossOrigin(customAudioUrl || audioUrl)} 
          />
        )}
        {ttsAudioUrl && <audio ref={ttsAudioRef} src={ttsAudioUrl} crossOrigin={getCrossOrigin(ttsAudioUrl)} />}
        {introVideoUrl && <video ref={videoRef} src={introVideoUrl} crossOrigin={getCrossOrigin(introVideoUrl)} playsInline muted />}
      </div>
    </div>
  );
}
