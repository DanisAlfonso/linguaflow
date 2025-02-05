-- Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Drop all existing policies to start fresh
drop policy if exists "Users can delete their own audio files" on storage.objects;
drop policy if exists "Allow users to delete their own audio files" on storage.objects;
drop policy if exists "Allow users to download their own audio files" on storage.objects;
drop policy if exists "Allow users to upload audio files" on storage.objects;
drop policy if exists "Allow users to update their own audio files" on storage.objects;
drop policy if exists "authenticated_select" on storage.objects;
drop policy if exists "authenticated_insert" on storage.objects;
drop policy if exists "authenticated_update" on storage.objects;
drop policy if exists "authenticated_delete" on storage.objects;
drop policy if exists "Allow users to delete their own audio files 1jgvrq_0" on storage.objects;

-- Create simple policies for authenticated users
create policy "storage_objects_select"
on storage.objects for select
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
);

create policy "storage_objects_insert"
on storage.objects for insert
with check (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
);

create policy "storage_objects_update"
on storage.objects for update
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
);

create policy "storage_objects_delete"
on storage.objects for delete
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
); 