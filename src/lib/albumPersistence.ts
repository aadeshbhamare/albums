import { supabase } from './supabase';

// Metadata-only image record stored in the album's sections JSON.
// The actual blob lives in IndexedDB (imageStore) keyed by `id`.
export interface PersistedImageMeta {
  id: string;
  filename: string;
  folderName: string;
  mimeType: string;
  size: number;
  section?: string;
  description?: string;
}

export interface PersistedSection {
  id: string;
  name: string;
  template?: 'grid' | 'featured' | 'masonry';
  images: PersistedImageMeta[];
}

export interface AlbumState {
  id: string;
  folder_name: string;
  grouping_mode: 'event' | 'shotType';
  step: 'upload' | 'analyzing' | 'review' | 'layout' | 'video';
  sections: PersistedSection[];
  image_fit_mode: 'cover' | 'contain';
  image_count: number;
  created_at?: string;
  updated_at?: string;
}

const CURRENT_ALBUM_KEY = 'lumina:currentAlbumId';

export function getCurrentAlbumId(): string | null {
  return localStorage.getItem(CURRENT_ALBUM_KEY);
}

export function setCurrentAlbumId(id: string | null): void {
  if (id) localStorage.setItem(CURRENT_ALBUM_KEY, id);
  else localStorage.removeItem(CURRENT_ALBUM_KEY);
}

// Debounced autosave so rapid edits don't hammer the DB.
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveAlbumDebounced(state: AlbumState, delay = 1200): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveAlbum(state).catch((err) => console.error('Autosave failed:', err));
  }, delay);
}

export async function saveAlbum(state: AlbumState): Promise<void> {
  const payload = {
    id: state.id,
    folder_name: state.folder_name,
    grouping_mode: state.grouping_mode,
    step: state.step,
    sections: state.sections,
    image_fit_mode: state.image_fit_mode,
    image_count: state.image_count,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('albums').upsert(payload);
  if (error) throw error;
}

export async function loadAlbum(id: string): Promise<AlbumState | null> {
  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as AlbumState;
}

export async function deleteAlbum(id: string): Promise<void> {
  const { error } = await supabase.from('albums').delete().eq('id', id);
  if (error) throw error;
}

export async function listAlbums(): Promise<AlbumState[]> {
  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []) as AlbumState[];
}
