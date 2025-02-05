-- Enable RLS
alter table storage.objects enable row level security;

-- Drop existing policies
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

-- Create basic policies for the audio bucket
create policy "audio_select"
on storage.objects for select
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
);

create policy "audio_insert"
on storage.objects for insert
with check (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
);

create policy "audio_delete"
on storage.objects for delete
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
    and (
        exists (
            select 1
            from public.audio_files af
            where af.file_path = name
        )
    )
); 