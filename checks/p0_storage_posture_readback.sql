SELECT b.id,b.public,count(o.id) AS object_count
FROM storage.buckets b LEFT JOIN storage.objects o ON o.bucket_id=b.id
GROUP BY b.id,b.public ORDER BY b.id;
SELECT * FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
