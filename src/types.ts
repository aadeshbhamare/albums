// Image metadata only. The actual binary blob lives in IndexedDB (imageStore)
// keyed by `id`. This keeps thousands of images out of memory.
export type ImageItem = {
  id: string;
  filename: string;
  folderName: string;
  mimeType: string;
  size: number;
  section?: string;
  description?: string;
};

export type AlbumSection = {
  id: string;
  name: string;
  images: ImageItem[];
  template?: 'grid' | 'featured' | 'masonry';
};
