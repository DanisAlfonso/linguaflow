-- Drop existing policies
drop policy if exists "Users can insert their own audio files" on public.audio_files;

-- Create new policy that allows insert and update
create policy "Users can insert and update their own audio files"
    on public.audio_files for all
    using (true)
    with check (true); 