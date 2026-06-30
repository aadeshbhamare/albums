export type ImageItem = {
  id: string;
  file: File;
  previewUrl: string;
  filename: string;
  folderName: string;
  section?: string;
  description?: string;
};

export type AlbumSection = {
  id: string;
  name: string;
  images: ImageItem[];
  template?: 'grid' | 'featured' | 'masonry';
};
