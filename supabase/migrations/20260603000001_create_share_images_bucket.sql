-- Public bucket for puzzle-result share images.
--
-- The Share button generates the result PNG client-side (lib/share-image.ts)
-- and uploads it here so a per-result page (app/s/[...key]) can expose it as an
-- Open Graph image. Social platforms (Facebook, X, LinkedIn, Reddit) refuse
-- pre-attached images and only scrape og:image from the shared URL, so this is
-- the only way they can show the actual finished puzzle.
--
-- Mirrors the avatars bucket: public read, authenticated users write into their
-- own <uid>/ folder.

INSERT INTO storage.buckets (id, name, public)
VALUES ('share-images', 'share-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own share images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'share-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own share images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'share-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view share images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'share-images');
