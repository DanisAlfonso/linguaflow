-- Drop the existing delete policy
drop policy if exists "Allow users to delete their own audio files 1jgvrq_0" on storage.objects;

-- Create an updated delete policy that handles both cases
create policy "Allow users to delete their own audio files"
on storage.objects for delete
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
    and (
        -- Allow deletion of files linked to cards
        exists (
            select 1
            from card_audio_segments cas
            join cards c on c.id = cas.card_id
            join decks d on d.id = c.deck_id
            join audio_files af on af.id = cas.audio_file_id
            where af.file_path = objects.name
            and d.user_id = auth.uid()
        )
        -- Allow deletion of files linked to tracks
        or exists (
            select 1
            from audio_tracks at
            join audio_files af on af.id = at.audio_file_id
            where af.file_path = objects.name
            and at.user_id = auth.uid()
        )
    )
); 