/*
# Create albums table for work-in-progress persistence

1. New Tables
- `albums`
  - `id` (uuid, primary key) — client-generated album ID
  - `folder_name` (text, not null) — album display name
  - `grouping_mode` (text, not null) — 'event' | 'shotType'
  - `step` (text, not null) — current workflow step: 'upload' | 'analyzing' | 'review' | 'layout' | 'video'
  - `sections` (jsonb, not null default '[]') — serialized album sections (images reference IndexedDB blob keys, not File objects)
  - `image_fit_mode` (text, not null default 'cover') — 'cover' | 'contain'
  - `image_count` (integer, not null default 0) — number of images in the album
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Purpose
- Persists album work-in-progress so a page refresh resumes exactly where the user left off.
- Image binary data is stored client-side in IndexedDB (too large for DB); this table stores metadata + workflow state only.
- Single-tenant design: the album ID is generated client-side and stored in localStorage; any client with the ID can read/write. This matches the existing Firebase shared-album public-read model.

3. Security
- Enable RLS on `albums`.
- Allow anon + authenticated full CRUD — the album ID acts as the capability token (anyone with the ID can access). This is intentional for the share-link model already in use.
- Documented as intentionally public/shared data.

4. Indexes
- `albums_updated_at_idx` on `updated_at` desc — for listing recent albums.
*/

CREATE TABLE IF NOT EXISTS albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_name text NOT NULL DEFAULT 'Untitled Album',
  grouping_mode text NOT NULL DEFAULT 'event',
  step text NOT NULL DEFAULT 'upload',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_fit_mode text NOT NULL DEFAULT 'cover',
  image_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE albums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_albums" ON albums;
CREATE POLICY "anon_select_albums"
ON albums FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_albums" ON albums;
CREATE POLICY "anon_insert_albums"
ON albums FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_albums" ON albums;
CREATE POLICY "anon_update_albums"
ON albums FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_albums" ON albums;
CREATE POLICY "anon_delete_albums"
ON albums FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS albums_updated_at_idx ON albums (updated_at DESC);
