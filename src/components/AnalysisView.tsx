import React, { useEffect, useState } from 'react';
import { ImageItem } from '../types';
import { Loader2 } from 'lucide-react';

interface AnalysisViewProps {
  images: ImageItem[];
  folderName: string;
  groupingMode: 'event' | 'shotType';
  onAnalysisComplete: (analyzedImages: ImageItem[]) => void;
}

const resizeImage = (file: File, maxDim = 800): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          resolve(e.target?.result as string || "");
        }
      };
      img.onerror = () => {
        resolve(e.target?.result as string || "");
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve("");
    };
    reader.readAsDataURL(file);
  });
};

export function AnalysisView({ images, folderName, groupingMode, onAnalysisComplete }: AnalysisViewProps) {
  const [progress, setProgress] = useState(0);
  const [analyzedImages, setAnalyzedImages] = useState<ImageItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    const analyzeImages = async () => {
      const results: ImageItem[] = [];
      let completed = 0;

      // Process in small batches or sequentially to avoid rate limits
      for (const img of images) {
        if (!isMounted) break;
        
        try {
          // Convert File to a resized Base64 representation to prevent payload size errors ("Failed to fetch")
          const base64 = await resizeImage(img.file);

          let response = await fetch('/api/analyze-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType: 'image/jpeg',
              filename: img.filename,
              folderName,
              groupingMode,
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            if (response.status === 429 || (errData.error && errData.error.includes('429'))) {
              console.log("Rate limited. Waiting 10 seconds before retrying...");
              await new Promise(r => setTimeout(r, 10000));
              response = await fetch('/api/analyze-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageBase64: base64,
                  mimeType: img.file.type,
                  filename: img.filename,
                  folderName,
                  groupingMode,
                })
              });
            }
          }

          if (response.ok) {
            const data = await response.json();
            results.push({
              ...img,
              section: data.section || 'Uncategorized',
              description: data.description || '',
            });
          } else {
            results.push({ ...img, section: 'Uncategorized', description: 'Failed to analyze' });
          }
        } catch (err) {
          console.error("Failed to analyze image", err);
          results.push({ ...img, section: 'Uncategorized', description: 'Error analyzing' });
        }

        completed++;
        setProgress(Math.round((completed / images.length) * 100));
        setAnalyzedImages([...results]); // Update intermediate state
      }

      if (isMounted) {
        onAnalysisComplete(results);
      }
    };

    analyzeImages();

    return () => {
      isMounted = false;
    };
  }, [images, folderName, onAnalysisComplete]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="text-center mb-12 mt-12">
        <Loader2 className="w-16 h-16 text-[#D4AF37] animate-spin mx-auto mb-6" />
        <h2 className="text-3xl font-serif italic text-white mb-4">
          Analyzing Your Album
        </h2>
        <p className="text-lg text-white/60 max-w-md mx-auto font-light">
          Our AI is scanning your {images.length} photos to categorize them by event, people, and moments.
        </p>
      </div>

      <div className="w-full max-w-2xl bg-white/10 rounded-full h-4 mb-4 overflow-hidden">
        <div 
          className="bg-[#D4AF37] h-4 rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(212,175,55,0.5)]"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <p className="text-[11px] uppercase tracking-widest font-bold text-white/60 mb-12">{progress}% Complete</p>

      {/* Show a mini grid of currently analyzing images */}
      <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 w-full max-w-4xl opacity-50 pointer-events-none">
        {images.slice(0, 16).map((img, i) => {
          const isDone = i < analyzedImages.length;
          return (
            <div key={img.id} className={`aspect-square rounded-2xl overflow-hidden ${isDone ? 'ring-2 ring-[#D4AF37] scale-105 transition-transform' : 'opacity-30'}`}>
              <img src={img.previewUrl} alt="thumbnail" className="w-full h-full object-cover" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
