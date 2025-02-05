-- Drop existing policies
drop policy if exists "Allow users to download their own audio files" on storage.objects;

-- Create updated policy for downloading audio files
create policy "Allow users to download their own audio files"
on storage.objects for select
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
    and (
        -- Allow access to audio files linked to cards
        exists (
            select 1
            from card_audio_segments cas
            join cards c on c.id = cas.card_id
            join decks d on d.id = c.deck_id
            join audio_files af on af.id = cas.audio_file_id
            where af.file_path = name
            and d.user_id = auth.uid()
        )
        -- Allow access to audio files linked to tracks
        or exists (
            select 1
            from audio_tracks at
            join audio_files af on af.id = at.audio_file_id
            where af.file_path = name
            and at.user_id = auth.uid()
        )
    )
); 