import React, { useRef, useState, useEffect } from 'react';
import { AlbumSection, ImageItem } from '../types';
import { FileDown, Video, Music, Loader as Loader2, Type, Palette, Share2, Check, Trash2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { getObjectUrl, deleteImage } from '../lib/imageStore';
import { supabase } from '../lib/supabase';

// Loads an object URL from IndexedDB for a given image id.
function LayoutThumb({ id, className, style }: { id: string; className?: string; style?: React.CSSProperties }) {
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
  if (!url) return <div className={cn('w-full h-full bg-zinc-800 animate-pulse', className)} style={style} />;
  return <img src={url} alt="" className={className} style={style} />;
}

// Blurred cover background.
function CoverBg({ imageId }: { imageId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getObjectUrl(imageId).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [imageId]);
  if (!url) return null;
  return (
    <div
      className="absolute inset-0 bg-cover bg-center blur-md scale-110 opacity-15 mix-blend-overlay"
      style={{ backgroundImage: `url(${url})` }}
    />
  );
}

// Blurred frame background.
function FrameBg({ imageId }: { imageId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getObjectUrl(imageId).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [imageId]);
  if (!url) return <div className="absolute inset-0 bg-zinc-800 animate-pulse" />;
  return (
    <div
      className="absolute inset-0 bg-cover bg-center blur-2xl opacity-10 transition-transform duration-700 group-hover:scale-110"
      style={{ backgroundImage: `url(${url})` }}
    />
  );
}

// For PDF export: renders the image as a background-image div (html2canvas friendly).
function ExportImage({ imageId, fitMode }: { imageId: string; fitMode: 'cover' | 'contain' }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getObjectUrl(imageId).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [imageId]);
  return (
    <div
      className="relative z-10 w-full h-full shadow-[0_4px_15px_rgba(0,0,0,0.15)] border border-black/5"
      style={{
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: fitMode === 'cover' ? 'cover' : 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        borderRadius: '6px',
        width: '100%',
        height: '100%',
      }}
    />
  );
}

interface LayoutViewProps {
  sections: AlbumSection[];
  folderName: string;
  onProceedToVideo: () => void;
  albumId?: string;
  onAlbumShared?: (id: string) => void;
  onSectionsChange?: (sections: AlbumSection[]) => void;
  imageFitMode: 'cover' | 'contain';
  setImageFitMode: (mode: 'cover' | 'contain') => void;
}

type SectionTemplate = 'grid' | 'featured' | 'masonry';
type AlbumTheme = 'royalGold' | 'emeraldGold' | 'blushRose' | 'vintageIndigo' | 'velvetMaroon';

interface LocalSection extends AlbumSection {
  template?: SectionTemplate;
}

const CornerSVG = ({ theme, position, aiOrnament }: { theme: AlbumTheme; position: 'tl' | 'tr' | 'bl' | 'br'; aiOrnament?: string }) => {
  const rotateClass = {
    tl: '',
    tr: 'rotate-90',
    bl: '-rotate-90',
    br: 'rotate-180',
  }[position];

  const posClass = {
    tl: 'top-4 left-4',
    tr: 'top-4 right-4',
    bl: 'bottom-4 left-4',
    br: 'bottom-4 right-4',
  }[position];

  const activeOrnament = aiOrnament || theme;

  if (activeOrnament === 'royalGold' || activeOrnament === 'gold_leaf') {
    return (
      <svg className={cn("absolute w-12 h-12 pointer-events-none text-[#D4AF37]/80 z-20 transition-opacity duration-300", posClass, rotateClass)} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M 10 10 L 90 10 M 10 10 L 10 90 M 15 15 L 60 15 M 15 15 L 15 60" />
        <path d="M 10 10 C 25 25, 25 35, 40 40 C 35 25, 25 25, 10 10 Z" fill="currentColor" fillOpacity="0.15" />
        <circle cx="10" cy="10" r="4" fill="currentColor" />
        <circle cx="90" cy="10" r="3" fill="currentColor" />
        <circle cx="10" cy="90" r="3" fill="currentColor" />
      </svg>
    );
  }
  if (activeOrnament === 'emeraldGold' || activeOrnament === 'vintage_scroll') {
    return (
      <svg className={cn("absolute w-16 h-16 pointer-events-none text-[#C5A059]/70 z-20 transition-opacity duration-300", posClass, rotateClass)} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M 10 10 Q 50 30 80 50" />
        <path d="M 30 20 Q 35 10 40 18" fill="currentColor" fillOpacity="0.2" />
        <path d="M 45 27 Q 55 18 52 30" fill="currentColor" fillOpacity="0.2" />
        <path d="M 60 35 Q 75 30 68 42" fill="currentColor" fillOpacity="0.2" />
        <path d="M 20 30 Q 10 45 18 42" fill="currentColor" fillOpacity="0.2" />
        <path d="M 10 10 Q 30 50 50 80" />
        <path d="M 20 30 Q 10 35 18 40" fill="currentColor" fillOpacity="0.2" />
        <path d="M 27 45 Q 18 55 30 52" fill="currentColor" fillOpacity="0.2" />
        <circle cx="10" cy="10" r="3" fill="currentColor" />
      </svg>
    );
  }
  if (activeOrnament === 'blushRose' || activeOrnament === 'floral_watercolor') {
    return (
      <svg className={cn("absolute w-20 h-20 pointer-events-none text-[#C58B95]/60 z-20 transition-opacity duration-300", posClass, rotateClass)} viewBox="0 0 120 120" fill="none">
        <path d="M 20 20 C 40 15, 50 30, 45 45 C 30 50, 15 40, 20 20 Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1" />
        <path d="M 32 32 C 45 25, 55 35, 50 48 C 35 55, 25 45, 32 32 Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1" />
        <path d="M 20 20 Q 80 40 100 20" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        <path d="M 20 20 Q 40 80 20 100" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        <path d="M 45 45 C 60 55, 70 50, 65 65 C 50 70, 55 60, 45 45 Z" fill="#A0B8A0" fillOpacity="0.3" stroke="#A0B8A0" strokeWidth="0.8" />
        <circle cx="20" cy="20" r="3" fill="currentColor" />
      </svg>
    );
  }
  if (activeOrnament === 'vintageIndigo' || activeOrnament === 'minimal_corner') {
    return (
      <svg className={cn("absolute w-12 h-12 pointer-events-none text-[#B87333]/80 z-20 transition-opacity duration-300", posClass, rotateClass)} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M 8 8 L 92 8 M 8 8 L 8 92" />
        <path d="M 14 14 L 86 14 M 14 14 L 14 86" strokeWidth="1" />
        <path d="M 20 20 L 40 20 M 20 20 L 20 40" strokeWidth="0.8" />
        <rect x="6" y="6" width="10" height="10" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1" />
      </svg>
    );
  }
  if (activeOrnament === 'velvetMaroon' || activeOrnament === 'geometric_deco') {
    return (
      <svg className={cn("absolute w-16 h-16 pointer-events-none text-[#E1C58F]/70 z-20 transition-opacity duration-300", posClass, rotateClass)} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M 12 12 Q 35 12 35 35 Q 35 55 12 55" />
        <path d="M 12 12 Q 12 35 35 35 Q 55 35 55 12" />
        <path d="M 12 12 C 12 30, 30 30, 30 45" strokeWidth="1" />
        <path d="M 12 12 C 30 12, 30 30, 45 30" strokeWidth="1" />
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <circle cx="35" cy="35" r="2.5" fill="currentColor" />
      </svg>
    );
  }
  return null;
};

const THEMES: Record<AlbumTheme, { name: string; className: string; titleClass: string; chapterClass: string; frameClass: string; pageBorder: string }> = {
  royalGold: {
    name: 'Royal Ivory',
    className: 'bg-[#FCFAF2] text-[#4A3B32] font-serif shadow-2xl relative border-x border-zinc-200',
    titleClass: 'text-[#8C7A53] font-serif tracking-wider font-semibold',
    chapterClass: 'text-[#D4AF37]',
    frameClass: 'bg-[#F9F6ED] border-[3px] border-double border-[#D4AF37] p-3 shadow-xl ring-1 ring-[#D4AF37]/30 rounded-[8px]',
    pageBorder: 'border-2 border-[#D4AF37]/30 m-8 p-8 md:m-12 md:p-12 relative'
  },
  emeraldGold: {
    name: 'Emerald Gold',
    className: 'bg-[#061D12] text-zinc-100 font-serif shadow-2xl relative',
    titleClass: 'text-[#C5A059] font-serif tracking-widest font-semibold',
    chapterClass: 'text-[#C5A059]',
    frameClass: 'bg-[#0B2E1D] border border-[#C5A059]/50 p-4 shadow-2xl ring-2 ring-[#C5A059]/20 rounded-[8px]',
    pageBorder: 'border border-[#C5A059]/20 m-8 p-8 md:m-12 md:p-12 relative'
  },
  blushRose: {
    name: 'Blush Rose',
    className: 'bg-[#FFF7F8] text-[#5A4549] font-sans shadow-2xl relative border-x border-pink-100',
    titleClass: 'text-[#C58B95] font-serif italic tracking-wide font-semibold',
    chapterClass: 'text-[#DDA0A8]',
    frameClass: 'bg-white border-2 border-[#F3D5D9] p-3 shadow-lg rounded-[8px]',
    pageBorder: 'border border-[#F3D5D9]/40 m-8 p-8 md:m-12 md:p-12 relative'
  },
  vintageIndigo: {
    name: 'Vintage Indigo',
    className: 'bg-[#07111E] text-zinc-200 font-serif shadow-2xl relative',
    titleClass: 'text-[#B87333] font-serif tracking-wider font-semibold',
    chapterClass: 'text-[#B87333]',
    frameClass: 'bg-[#0D1D30] border-2 border-[#B87333]/60 p-4 shadow-2xl rounded-[8px]',
    pageBorder: 'border-2 border-double border-[#B87333]/30 m-8 p-8 md:m-12 md:p-12 relative'
  },
  velvetMaroon: {
    name: 'Velvet Maroon',
    className: 'bg-[#2E0509] text-amber-50 font-serif shadow-2xl relative',
    titleClass: 'text-[#E1C58F] font-serif tracking-widest font-semibold',
    chapterClass: 'text-[#E1C58F]',
    frameClass: 'bg-[#400B11] border-4 border-[#D4AF37]/80 p-2 shadow-2xl ring-1 ring-amber-500/30 rounded-[8px]',
    pageBorder: 'border border-[#D4AF37]/35 m-8 p-8 md:m-12 md:p-12 relative'
  }
};

interface CustomAIThemeData {
  name: string;
  bgStyle: string;
  textColor: string;
  titleColor: string;
  chapterColor: string;
  frameBorder: string;
  frameBg: string;
  framePadding: string;
  frameShadow: string;
  frameRadius: string;
  pageBorderColor: string;
  svgOrnamentType: 'gold_leaf' | 'floral_watercolor' | 'geometric_deco' | 'vintage_scroll' | 'minimal_corner';
}

export function LayoutView({ 
  sections, 
  folderName, 
  onProceedToVideo, 
  albumId, 
  onAlbumShared,
  onSectionsChange,
  imageFitMode,
  setImageFitMode
}: LayoutViewProps) {
  const albumRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [localSections, setLocalSections] = useState<LocalSection[]>([]);
  const [draggedImg, setDraggedImg] = useState<{sectionId: string, imgId: string} | null>(null);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [theme, setTheme] = useState<AlbumTheme>('royalGold');
  const [copied, setCopied] = useState(false);

  // AI custom selected background states
  const [useAITheme, setUseAITheme] = useState(false);
  const [aiThemeData, setAIThemeData] = useState<CustomAIThemeData | null>(null);
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);

  const generateAITheme = async () => {
    setIsGeneratingTheme(true);
    try {
      const res = await fetch('/api/generate-ai-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName }),
      });
      if (res.ok) {
        const data = await res.json();
        setAIThemeData(data);
        setUseAITheme(true);
      } else {
        throw new Error("Theme request failed");
      }
    } catch (err) {
      console.error("AI theme generation failed, using beautiful client-side dynamic fallback:", err);
      // Client-side fallback to guarantee absolute stability
      let hash = 0;
      for (let i = 0; i < folderName.length; i++) {
        hash = folderName.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;
      const color1 = `hsl(${hue}, 45%, 98%)`;
      const color2 = `hsl(${(hue + 20) % 360}, 40%, 94%)`;
      const color3 = `hsl(${(hue + 40) % 360}, 25%, 89%)`;
      const textCol = `hsl(${hue}, 40%, 25%)`;
      const accentCol = `hsl(${(hue + 15) % 360}, 45%, 42%)`;
      
      setAIThemeData({
        name: `AI bespoke - ${folderName || "Dreamy Watercolor"}`,
        bgStyle: `linear-gradient(135deg, ${color1} 0%, ${color2} 50%, ${color3} 100%)`,
        textColor: textCol,
        titleColor: accentCol,
        chapterColor: accentCol,
        frameBorder: `2px solid ${accentCol}40`,
        frameBg: "#FFFFFF",
        framePadding: "p-2.5",
        frameShadow: "shadow-xl border border-black/5",
        frameRadius: "rounded-[8px]",
        pageBorderColor: `${accentCol}20`,
        svgOrnamentType: "minimal_corner"
      });
      setUseAITheme(true);
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  const selectStandardTheme = (t: AlbumTheme) => {
    setTheme(t);
    setUseAITheme(false);
  };

  useEffect(() => {
    setLocalSections(sections.map(s => ({ ...s, template: s.template || 'featured' })));
  }, [sections]);

  // Notify parent of section changes for autosave.
  useEffect(() => {
    onSectionsChange?.(localSections);
  }, [localSections, onSectionsChange]);

  const stripOklchAndOklab = (cssText: string): string => {
    if (!cssText) return "";
    let result = "";
    let i = 0;
    while (i < cssText.length) {
      let matchedLength = 0;
      if (cssText.toLowerCase().startsWith("oklch(", i)) {
        matchedLength = 6;
      } else if (cssText.toLowerCase().startsWith("oklab(", i)) {
        matchedLength = 6;
      } else if (cssText.toLowerCase().startsWith("color(oklch", i)) {
        matchedLength = 11;
      } else if (cssText.toLowerCase().startsWith("color(oklab", i)) {
        matchedLength = 11;
      }

      if (matchedLength > 0) {
        let parenCount = 1;
        i += matchedLength;
        while (i < cssText.length && parenCount > 0) {
          if (cssText[i] === '(') {
            parenCount++;
          } else if (cssText[i] === ')') {
            parenCount--;
          }
          i++;
        }
        result += "rgb(150, 150, 150)";
      } else {
        result += cssText[i];
        i++;
      }
    }
    return result;
  };

  const exportPDF = async () => {
    if (!albumRef.current) return;
    setIsExporting(true);
    setEditingCaptionId(null);

    // Backup and sanitize styles for html2canvas (to avoid oklch/oklab crashes)
    const styleBackups: { element: HTMLStyleElement; originalText: string }[] = [];
    const styles = Array.from(document.querySelectorAll('style'));
    for (const style of styles) {
      if (style.textContent && (style.textContent.includes('oklch') || style.textContent.includes('oklab'))) {
        styleBackups.push({ element: style, originalText: style.textContent });
        // Replace oklch(...) and oklab(...) color definitions with a safe rgb fallback using our bracket-balanced parser
        style.textContent = stripOklchAndOklab(style.textContent);
      }
    }

    // Handle link elements containing CSS
    const linkBackups: { element: HTMLLinkElement; originalDisabled: boolean }[] = [];
    const tempStyles: HTMLStyleElement[] = [];
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
    for (const link of links) {
      try {
        if (link.href && link.href.startsWith(window.location.origin)) {
          const response = await fetch(link.href);
          if (response.ok) {
            const cssText = await response.text();
            if (cssText.includes('oklch') || cssText.includes('oklab')) {
              linkBackups.push({ element: link, originalDisabled: link.disabled });
              link.disabled = true; // Disable the link temporarily
              
              const tempStyle = document.createElement('style');
              tempStyle.id = 'html2canvas-temp-style';
              tempStyle.textContent = stripOklchAndOklab(cssText);
              document.head.appendChild(tempStyle);
              tempStyles.push(tempStyle);
            }
          }
        }
      } catch (linkErr) {
        console.warn("Failed to process link stylesheet:", link.href, linkErr);
      }
    }

    try {
      const coverEl = albumRef.current.querySelector('.album-page-cover') as HTMLElement | null;
      const sectionEls = Array.from(albumRef.current.querySelectorAll('.album-page-section')) as HTMLElement[];

      if (!coverEl && sectionEls.length === 0) {
        alert("No layout pages found to export.");
        setIsExporting(false);
        return;
      }

      let pdf: jsPDF | null = null;

      // Helper to capture an individual page element beautifully with desktop scale and sizing
      const capturePage = async (el: HTMLElement) => {
        // Save original styles/classes
        const originalStyle = el.getAttribute('style') || '';
        const originalClassName = el.className;

        // Force desktop width layout so multi-column grids are used and spacing is perfect
        el.style.width = '1024px';
        el.style.maxWidth = '1024px';
        el.style.minWidth = '1024px';
        el.classList.add('pdf-rendering-active');

        const canvas = await html2canvas(el, {
          scale: 3, // High-resolution printing scale
          useCORS: true,
          logging: false,
          windowWidth: 1200, // Evaluates media queries in desktop mode
          windowHeight: 900,
          backgroundColor: null,
        });

        // Restore styles/classes immediately
        el.setAttribute('style', originalStyle);
        el.className = originalClassName;

        return canvas;
      };

      // 1. Process Cover Page
      if (coverEl) {
        const coverCanvas = await capturePage(coverEl);
        const imgData = coverCanvas.toDataURL('image/jpeg', 0.98);
        const w = coverCanvas.width;
        const h = coverCanvas.height;
        const orientation = w > h ? 'landscape' : 'portrait';

        pdf = new jsPDF({
          orientation: orientation,
          unit: 'px',
          format: [w, h]
        });

        pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
      }

      // 2. Process Section Pages
      for (const sectionEl of sectionEls) {
        const sectionCanvas = await capturePage(sectionEl);
        const imgData = sectionCanvas.toDataURL('image/jpeg', 0.98);
        const w = sectionCanvas.width;
        const h = sectionCanvas.height;
        const orientation = w > h ? 'landscape' : 'portrait';

        if (!pdf) {
          pdf = new jsPDF({
            orientation: orientation,
            unit: 'px',
            format: [w, h]
          });
          pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
        } else {
          pdf.addPage([w, h], orientation);
          pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
        }
      }

      if (pdf) {
        pdf.save(`${folderName.replace(/\s+/g, '_')}_HighRes_Printable.pdf`);
      }
    } catch (err) {
      console.error("PDF Export error:", err);
      alert("Failed to export PDF.");
    } finally {
      // Restore styles
      for (const backup of styleBackups) {
        backup.element.textContent = backup.originalText;
      }
      for (const backup of linkBackups) {
        backup.element.disabled = backup.originalDisabled;
      }
      for (const tempStyle of tempStyles) {
        tempStyle.remove();
      }
      setIsExporting(false);
    }
  };

  const shareAlbum = async () => {
    setIsSharing(true);
    try {
      const newId = albumId || uuidv4();
      const { error } = await supabase.from('albums').upsert({
        id: newId,
        folder_name: folderName,
        sections: localSections,
        step: 'layout',
        image_fit_mode: imageFitMode,
        image_count: localSections.reduce((n, s) => n + s.images.length, 0),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      const link = `${window.location.origin}?albumId=${newId}`;
      setShareLink(link);
      if (onAlbumShared) onAlbumShared(newId);
    } catch (err) {
      console.error(err);
      alert("Failed to share album");
    } finally {
      setIsSharing(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, sectionId: string, imgId: string) => {
    setDraggedImg({ sectionId, imgId });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetSectionId: string, targetImgId: string) => {
    e.preventDefault();
    if (!draggedImg) return;
    
    setLocalSections(prev => {
      const newSections = JSON.parse(JSON.stringify(prev)) as LocalSection[];
      
      const sourceSection = newSections.find(s => s.id === draggedImg.sectionId);
      const targetSection = newSections.find(s => s.id === targetSectionId);
      
      if (!sourceSection || !targetSection) return prev;

      const sourceIdx = sourceSection.images.findIndex(img => img.id === draggedImg.imgId);
      const targetIdx = targetSection.images.findIndex(img => img.id === targetImgId);

      if (draggedImg.sectionId === targetSectionId) {
        // Reorder within same section
        const [movedImg] = sourceSection.images.splice(sourceIdx, 1);
        targetSection.images.splice(targetIdx, 0, movedImg);
      } else {
        // Move across sections
        const [movedImg] = sourceSection.images.splice(sourceIdx, 1);
        targetSection.images.splice(targetIdx, 0, movedImg);
      }
      return newSections;
    });
    setDraggedImg(null);
  };

  const updateCaption = (sectionId: string, imgId: string, newCaption: string) => {
    setLocalSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        images: s.images.map(img => img.id === imgId ? { ...img, description: newCaption } : img)
      };
    }));
  };

  const deleteImageFromSection = async (sectionId: string, imgId: string) => {
    await deleteImage(imgId);
    setLocalSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, images: s.images.filter(img => img.id !== imgId) };
    }));
  };

  const deleteSection = (sectionId: string) => {
    setLocalSections(prev => prev.filter(s => s.id !== sectionId));
  };

  const setTemplate = (sectionId: string, template: SectionTemplate) => {
    setLocalSections(prev => prev.map(s => s.id === sectionId ? { ...s, template } : s));
  };

  const getTemplateClass = (template: SectionTemplate | undefined, imgCount: number, i: number, sIdx: number) => {
    if (template === 'grid') return 'col-span-1 aspect-square';
    if (template === 'masonry') return i % 3 === 0 ? 'col-span-1 row-span-2 aspect-[1/2]' : 'col-span-1 aspect-square';
    // featured
    if (imgCount > 3 && i === 0) return 'sm:col-span-2 sm:row-span-2 aspect-square';
    return 'col-span-1 aspect-square';
  };

  const normalizedTheme: AlbumTheme = THEMES[theme] ? theme : 'royalGold';
  const activeTheme = THEMES[normalizedTheme];

  const currentThemeStyles = {
    className: useAITheme && aiThemeData ? "" : activeTheme.className,
    titleClass: useAITheme && aiThemeData ? "" : activeTheme.titleClass,
    chapterClass: useAITheme && aiThemeData ? "" : activeTheme.chapterClass,
    frameClass: useAITheme && aiThemeData ? "" : activeTheme.frameClass,
    pageBorder: useAITheme && aiThemeData ? "border m-8 p-8 md:m-12 md:p-12 relative" : activeTheme.pageBorder,
  };

  const dynamicBgStyle = useAITheme && aiThemeData ? {
    background: aiThemeData.bgStyle,
    color: aiThemeData.textColor,
  } : {};

  const dynamicTitleStyle = useAITheme && aiThemeData ? {
    color: aiThemeData.titleColor,
  } : {};

  const dynamicChapterStyle = useAITheme && aiThemeData ? {
    color: aiThemeData.chapterColor,
  } : {};

  const dynamicPageBorderStyle = useAITheme && aiThemeData ? {
    borderColor: aiThemeData.pageBorderColor,
  } : {};

  const dynamicFrameStyle = useAITheme && aiThemeData ? {
    border: aiThemeData.frameBorder,
    backgroundColor: aiThemeData.frameBg,
    borderRadius: '8px',
  } : {
    borderRadius: '8px',
  };

  return (
    <div className="py-12 bg-[#0F0F0F] bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-800/20 via-transparent to-transparent min-h-screen">
      <div className="max-w-5xl mx-auto px-4 flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-6">
        <div>
          <h2 className="text-3xl font-serif italic text-white mb-2">Format Preview</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-white/60 font-light tracking-wide text-xs">Adjust layout, choose premium wedding backgrounds, and share.</p>
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-0.5 rounded-lg self-start sm:self-auto">
              <button 
                onClick={() => setImageFitMode('cover')}
                className={cn("px-2.5 py-1 text-[9px] uppercase tracking-wider font-bold rounded transition-colors", 
                  imageFitMode === 'cover' ? "bg-white/15 text-white" : "text-white/40 hover:text-white"
                )}
                title="Crop image to completely fill container for matching alignment"
              >
                Cover (Align)
              </button>
              <button 
                onClick={() => setImageFitMode('contain')}
                className={cn("px-2.5 py-1 text-[9px] uppercase tracking-wider font-bold rounded transition-colors", 
                  imageFitMode === 'contain' ? "bg-white/15 text-white" : "text-white/40 hover:text-white"
                )}
                title="Fit full image without any crop"
              >
                Contain
              </button>
            </div>
          </div>
        </div>
        
        {/* Global Controls */}
        <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex flex-wrap justify-center items-center bg-white/5 border border-white/10 rounded-full p-1 w-full md:w-auto">
            <Palette className="w-4 h-4 text-[#D4AF37] ml-3 mr-2 hidden sm:block" />
            {(Object.keys(THEMES) as AlbumTheme[]).map(t => (
              <button
                key={t}
                onClick={() => selectStandardTheme(t)}
                className={cn("px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all", 
                  (!useAITheme && normalizedTheme === t) ? "bg-[#D4AF37] text-black shadow-md scale-105" : "text-white/40 hover:text-white"
                )}
              >
                {THEMES[t].name}
              </button>
            ))}
            <div className="h-4 w-px bg-white/10 mx-2 hidden sm:block" />
            <button
              onClick={generateAITheme}
              disabled={isGeneratingTheme}
              className={cn("px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all flex items-center gap-1.5", 
                useAITheme ? "bg-gradient-to-r from-amber-400 to-amber-600 text-black shadow-md scale-105" : "text-white/40 hover:text-white"
              )}
            >
              {isGeneratingTheme ? <Loader2 className="w-3 h-3 animate-spin" /> : "✨ AI Selected"}
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-4 w-full md:w-auto">
            <button
              onClick={shareAlbum}
              disabled={isSharing}
              className="flex items-center justify-center gap-2 px-6 py-2 border border-[#D4AF37] text-[#D4AF37] rounded-full text-[10px] uppercase tracking-widest hover:bg-[#D4AF37]/10 transition-colors disabled:opacity-50"
            >
              {isSharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
              {isSharing ? "Sharing..." : "Share Album"}
            </button>
            <button
              onClick={exportPDF}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 px-6 py-2 border border-white/20 rounded-full text-[10px] uppercase tracking-widest text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              {isExporting ? "Exporting..." : "Download PDF"}
            </button>
            <button
              onClick={onProceedToVideo}
              className="flex items-center justify-center gap-2 bg-white text-black px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
            >
              <Video className="w-4 h-4" />
              Create Video
            </button>
          </div>
        </div>
      </div>
      
      {shareLink && (
        <div className="max-w-5xl mx-auto px-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-4 rounded-xl gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold mb-1">Shareable Link Ready</p>
              <p className="text-white text-sm font-medium break-all">{shareLink}</p>
            </div>
            <button 
              onClick={() => { navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="flex items-center justify-center gap-2 bg-[#D4AF37] text-black px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#c4a133] transition-colors whitespace-nowrap"
            >
              {copied ? <Check className="w-4 h-4" /> : 'Copy'}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Album Preview Container */}
      <div 
        className={cn("max-w-5xl mx-auto rounded-[3rem] overflow-hidden transition-all duration-700 ease-in-out pb-16", currentThemeStyles.className)} 
        style={dynamicBgStyle}
        ref={albumRef}
      >
        
        {/* Cover Page */}
        <div className="album-page-cover relative aspect-[3/4] sm:aspect-video w-full flex items-center justify-center p-12 overflow-hidden border-b border-black/10">
          {localSections[0]?.images[0] && (
            <>
              <CoverBg imageId={localSections[0].images[0].id} />
              <div className="absolute inset-0 bg-gradient-to-t via-transparent to-transparent from-black/5" />
            </>
          )}

          {/* Elegant Cover Corner Decorators */}
          <CornerSVG theme={normalizedTheme} position="tl" aiOrnament={useAITheme && aiThemeData ? aiThemeData.svgOrnamentType : undefined} />
          <CornerSVG theme={normalizedTheme} position="tr" aiOrnament={useAITheme && aiThemeData ? aiThemeData.svgOrnamentType : undefined} />
          <CornerSVG theme={normalizedTheme} position="bl" aiOrnament={useAITheme && aiThemeData ? aiThemeData.svgOrnamentType : undefined} />
          <CornerSVG theme={normalizedTheme} position="br" aiOrnament={useAITheme && aiThemeData ? aiThemeData.svgOrnamentType : undefined} />

          <div className="relative z-10 text-center px-8 py-16 border border-current/15 max-w-lg mx-auto bg-white/5 backdrop-blur-sm rounded-lg shadow-sm">
            <p 
              className={cn("uppercase tracking-[0.5em] text-[11px] font-bold mb-6", currentThemeStyles.titleClass)}
              style={dynamicTitleStyle}
            >
              A Premium Curated Collection
            </p>
            <h1 
              className={cn("text-5xl sm:text-7xl font-serif italic mb-8 drop-shadow-sm", currentThemeStyles.titleClass)}
              style={dynamicTitleStyle}
            >
              {folderName}
            </h1>
            <div className="h-px w-32 mx-auto bg-current/20" />
            <p className="text-[10px] uppercase tracking-widest mt-6 opacity-60 font-medium">Wedding Memories Album</p>
          </div>
        </div>

        {/* Sections / Pages */}
        <div className="space-y-16 mt-8">
          {localSections.map((section, sIdx) => (
            <div 
              key={section.id} 
              className={cn("album-page-section", currentThemeStyles.pageBorder, "shadow-sm rounded-lg bg-white/[0.02]")}
              style={dynamicPageBorderStyle}
            >
              {/* Corner Decorators inside each page/chapter border */}
              <CornerSVG theme={normalizedTheme} position="tl" aiOrnament={useAITheme && aiThemeData ? aiThemeData.svgOrnamentType : undefined} />
              <CornerSVG theme={normalizedTheme} position="tr" aiOrnament={useAITheme && aiThemeData ? aiThemeData.svgOrnamentType : undefined} />
              <CornerSVG theme={normalizedTheme} position="bl" aiOrnament={useAITheme && aiThemeData ? aiThemeData.svgOrnamentType : undefined} />
              <CornerSVG theme={normalizedTheme} position="br" aiOrnament={useAITheme && aiThemeData ? aiThemeData.svgOrnamentType : undefined} />

              <div className="flex flex-col items-center justify-center gap-4 text-center mb-12">
                <div className="flex items-center justify-center gap-4 mb-2">
                  <div className="h-px w-12 bg-current/20" />
                  <span 
                    className={cn("text-[11px] font-bold uppercase tracking-[0.4em] font-serif", currentThemeStyles.chapterClass)}
                    style={dynamicChapterStyle}
                  >
                    Chapter {String(sIdx + 1).padStart(2, '0')}
                  </span>
                  <div className="h-px w-12 bg-current/20" />
                </div>
                <h3 
                  className={cn("text-4xl font-serif italic mb-4", currentThemeStyles.titleClass)}
                  style={dynamicTitleStyle}
                >
                  {section.name}
                </h3>
                
                {/* Template Selector + Delete Section */}
                <div className="flex gap-2 p-1 rounded-full border border-current/10 bg-current/[0.03] backdrop-blur-sm" data-html2canvas-ignore>
                  {(['featured', 'grid', 'masonry'] as SectionTemplate[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setTemplate(section.id, t)}
                      className={cn("px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-colors", 
                        section.template === t 
                        ? "bg-[#D4AF37] text-black shadow-sm" 
                        : "opacity-50 hover:opacity-100"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      if (confirm(`Delete the "${section.name}" section and its ${section.images.length} photos?`)) {
                        deleteSection(section.id);
                      }
                    }}
                    className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1"
                    title="Delete this section"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              {/* Dynamic Grid Layout */}
              <div className={`grid gap-6 sm:gap-8 relative z-10 ${
                section.images.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : 
                section.images.length === 2 ? 'grid-cols-2' : 
                section.images.length === 3 ? 'grid-cols-3' : 
                'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
              }`}>
                {section.images.map((img, i) => (
                  <div 
                    key={img.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, section.id, img.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, section.id, img.id)}
                    className={cn(
                      "relative overflow-hidden group cursor-move flex items-center justify-center transition-all duration-500 hover:scale-[1.01]",
                      currentThemeStyles.frameClass,
                      getTemplateClass(section.template, section.images.length, i, sIdx),
                      draggedImg?.imgId === img.id && "opacity-50 scale-95"
                    )}
                    style={{
                      ...dynamicFrameStyle,
                    }}
                  >
                    {/* Blurred Background to fill empty space elegantly */}
                    <FrameBg imageId={img.id} />
                    
                    {isExporting ? (
                      <ExportImage imageId={img.id} fitMode={imageFitMode} />
                    ) : (
                      <LayoutThumb 
                        id={img.id} 
                        className={cn(
                          "relative z-10 w-full h-full hover:scale-[1.02] transition-transform duration-700 ease-out opacity-95 group-hover:opacity-100 shadow-[0_4px_15px_rgba(0,0,0,0.15)] border border-black/5",
                          imageFitMode === 'cover' ? "object-cover" : "object-contain"
                        )}
                        style={{ borderRadius: '6px' }}
                      />
                    )
                    
                    /* Delete button for individual image */
                    }
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this photo?')) deleteImageFromSection(section.id, img.id);
                      }}
                      className="absolute z-30 top-2 right-2 w-7 h-7 bg-black/70 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                      data-html2canvas-ignore
                      title="Delete this photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    
                    {/* Caption Edit Overlay */}
                    <div className="absolute z-20 bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" data-html2canvas-ignore>
                      {editingCaptionId === img.id ? (
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="w-full bg-white/20 text-white text-xs px-3 py-1.5 rounded outline-none border border-white/30 focus:border-[#D4AF37]"
                            defaultValue={img.description || ''}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateCaption(section.id, img.id, e.currentTarget.value);
                              }
                            }}
                            onBlur={(e) => updateCaption(section.id, img.id, e.target.value)}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <p 
                          onClick={() => setEditingCaptionId(img.id)}
                          className="text-xs text-white font-medium tracking-wide cursor-text flex items-center gap-2 drop-shadow-md"
                        >
                          <Type className="w-3.5 h-3.5 text-[#D4AF37]" />
                          {img.description || 'Add a caption...'}
                        </p>
                      )}
                    </div>

                    {/* Print-only caption (for PDF) */}
                    {img.description && (
                      <div className="absolute z-10 bottom-2 left-2 right-2 bg-[#FCFAF2]/90 border border-[#D4AF37]/30 p-2 text-center rounded hidden group-hover:block transition-all duration-300">
                        <p className="text-[10px] text-[#4A3B32] font-serif italic tracking-wide">{img.description}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
