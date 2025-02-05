-- Drop existing policies
drop policy if exists "Users can delete their own audio files" on storage.objects;
drop policy if exists "Allow users to download their own audio files" on storage.objects;

-- Create policy for downloading audio files
create policy "Allow users to download their own audio files"
on storage.objects for select
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
    and exists (
        select 1
        from public.audio_files af
        join public.audio_tracks at on at.audio_file_id = af.id
        where af.file_path = name
        and at.user_id = auth.uid()
    )
);

-- Create policy for deleting audio files
create policy "Allow users to delete their own audio files"
on storage.objects for delete
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
    and exists (
        select 1
        from public.audio_files af
        join public.audio_tracks at on at.audio_file_id = af.id
        where af.file_path = name
        and at.user_id = auth.uid()
    )
);

-- Create policy for inserting audio files
create policy "Allow users to upload audio files"
on storage.objects for insert
with check (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
);

-- Create policy for updating audio files
create policy "Allow users to update their own audio files"
on storage.objects for update
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
    and exists (
        select 1
        from public.audio_files af
        join public.audio_tracks at on at.audio_file_id = af.id
        where af.file_path = name
        and at.user_id = auth.uid()
    )
); 