-- Drop existing policies if they exist
drop policy if exists "Users can delete their own audio files" on storage.objects;

-- Create policy to allow users to delete their own audio files
create policy "Users can delete their own audio files"
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