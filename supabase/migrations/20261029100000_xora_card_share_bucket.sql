-- XORA: public storage for shared card previews (xora.roviaqr.com/k/<id>). Only the share-card
-- edge function writes here (service role); anyone can read, so X can fetch the preview image.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cards', 'cards', true, 700000, array['image/jpeg', 'application/json'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
