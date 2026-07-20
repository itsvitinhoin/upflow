-- Task covers are uploaded and read through authenticated server routes. Convert
-- existing generated public URLs before disabling public access to the bucket.
DO $$
DECLARE
  unsupported_legacy_reference_count INTEGER;
BEGIN
  SELECT count(*)
  INTO unsupported_legacy_reference_count
  FROM "Task"
  WHERE "cover_image_url" LIKE '%/storage/v1/object/public/task-assets/%'
    AND "cover_image_url" !~ '^https?://[^/]+/storage/v1/object/public/task-assets/[A-Za-z0-9][A-Za-z0-9._-]{0,180}/[A-Za-z0-9][A-Za-z0-9._-]{0,180}/[A-Za-z0-9][A-Za-z0-9._-]{0,180}([?][^#]*)?(#.*)?$';

  IF unsupported_legacy_reference_count > 0 THEN
    RAISE EXCEPTION
      'Cannot make task-assets private: found % legacy task cover URL(s) with an unsupported storage path.',
      unsupported_legacy_reference_count;
  END IF;
END $$;

UPDATE "Task"
SET "cover_image_url" = 'task-asset://' || substring(
  "cover_image_url"
  FROM '^https?://[^/]+/storage/v1/object/public/task-assets/([A-Za-z0-9][A-Za-z0-9._-]{0,180}/[A-Za-z0-9][A-Za-z0-9._-]{0,180}/[A-Za-z0-9][A-Za-z0-9._-]{0,180})([?][^#]*)?(#.*)?$'
)
WHERE "cover_image_url" ~ '^https?://[^/]+/storage/v1/object/public/task-assets/[A-Za-z0-9][A-Za-z0-9._-]{0,180}/[A-Za-z0-9][A-Za-z0-9._-]{0,180}/[A-Za-z0-9][A-Za-z0-9._-]{0,180}([?][^#]*)?(#.*)?$';

UPDATE storage.buckets
SET public = false
WHERE id = 'task-assets';
