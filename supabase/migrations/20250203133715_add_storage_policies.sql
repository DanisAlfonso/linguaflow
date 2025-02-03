-- Create storage bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;

-- Remove any existing policies
drop policy if exists "Allow authenticated users to upload audio files" on storage.objects;
drop policy if exists "Allow users to delete their own audio files" on storage.objects;
drop policy if exists "Allow users to download their own audio files" on storage.objects;

-- Create policies for the audio bucket
create policy "Allow authenticated users to upload audio files"
on storage.objects for insert
with check (
    bucket_id = 'audio' 
    and auth.role() = 'authenticated'
);

create policy "Allow users to delete their own audio files"
on storage.objects for delete
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
    and exists (
        select 1
        from card_audio_segments cas
        join cards c on c.id = cas.card_id
        join decks d on d.id = c.deck_id
        join audio_files af on af.id = cas.audio_file_id
        where af.file_path = name
        and d.user_id = auth.uid()
    )
);

create policy "Allow users to download their own audio files"
on storage.objects for select
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
    and exists (
        select 1
        from card_audio_segments cas
        join cards c on c.id = cas.card_id
        join decks d on d.id = c.deck_id
        join audio_files af on af.id = cas.audio_file_id
        where af.file_path = name
        and d.user_id = auth.uid()
    )
);
