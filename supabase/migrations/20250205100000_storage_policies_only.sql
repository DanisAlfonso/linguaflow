-- Enable RLS on storage.objects if not already enabled
alter table storage.objects enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can delete their own audio files" on storage.objects;
drop policy if exists "Allow users to download their own audio files" on storage.objects;
drop policy if exists "Allow users to upload audio files" on storage.objects;
drop policy if exists "Allow users to update their own audio files" on storage.objects;

-- Create basic policies for authenticated users
create policy "Allow users to download their own audio files"
on storage.objects for select
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
);

create policy "Allow users to delete their own audio files"
on storage.objects for delete
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
);

create policy "Allow users to upload audio files"
on storage.objects for insert
with check (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
);

create policy "Allow users to update their own audio files"
on storage.objects for update
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
); 