-- #178: separate protected Storage containment; objects and keys remain unchanged.
DO $storage$ BEGIN
  IF (SELECT count(*) FROM storage.buckets WHERE id IN ('tutor-documents','coo-brain-library')) <> 2 THEN
    RAISE EXCEPTION 'P0 Storage drift: expected confidential buckets missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='storage' AND c.relname='objects' AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'P0 Storage drift: storage.objects RLS missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects') THEN
    RAISE EXCEPTION 'P0 Storage drift: review object policies before promotion';
  END IF;
  UPDATE storage.buckets SET public=false
    WHERE id IN ('tutor-documents','coo-brain-library','executive-task-proofs');
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE
    id IN ('tutor-documents','coo-brain-library','executive-task-proofs') AND public) THEN
    RAISE EXCEPTION 'P0 Storage postcondition: confidential bucket remains public';
  END IF;
END
$storage$;
