do $$
begin
    -- Only drop and recreate if the policy exists and we haven't fixed it yet
    if exists (
        select 1 from pg_policies 
        where schemaname = 'public' 
        and tablename = 'audio_playlists' 
        and policyname = 'Users can view their own playlists'
    ) then
        drop policy if exists "Users can view their own playlists" on public.audio_playlists;

        -- Create a simplified policy that doesn't cause recursion
        create policy "Users can view their own playlists"
            on public.audio_playlists for select
            using (
                user_id = auth.uid() 
                or visibility = 'public'
                or visibility = 'unlisted'
            );
    end if;
end $$; 