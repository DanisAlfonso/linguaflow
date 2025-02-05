-- Create an enum for audio track types
create type public.audio_track_type as enum ('recording', 'upload');

-- Create an enum for playlist visibility
create type public.playlist_visibility as enum ('private', 'public', 'unlisted');

-- Create table for audio tracks (independent of flashcards)
create table if not exists public.audio_tracks (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    description text,
    audio_file_id uuid references public.audio_files(id) on delete cascade not null,
    duration integer, -- Duration in seconds
    track_type public.audio_track_type not null default 'upload',
    waveform_data jsonb, -- Store pre-computed waveform data for visualization
    language text, -- Language of the audio content
    tags text[], -- Array of tags for categorization
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create table for playlists
create table if not exists public.audio_playlists (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    description text,
    visibility public.playlist_visibility not null default 'private',
    cover_image text, -- URL or path to cover image
    total_duration integer default 0, -- Total duration in seconds
    track_count integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create table for playlist tracks (junction table with order)
create table if not exists public.audio_playlist_tracks (
    id uuid default gen_random_uuid() primary key,
    playlist_id uuid references public.audio_playlists(id) on delete cascade not null,
    track_id uuid references public.audio_tracks(id) on delete cascade not null,
    position integer not null, -- For track ordering within playlist
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(playlist_id, track_id), -- Prevent duplicate tracks in playlist
    unique(playlist_id, position) -- Ensure unique positions within a playlist
);

-- Create table for track metadata
create table if not exists public.audio_track_metadata (
    id uuid default gen_random_uuid() primary key,
    track_id uuid references public.audio_tracks(id) on delete cascade not null,
    play_count integer default 0,
    last_played_at timestamp with time zone,
    favorite boolean default false,
    custom_metadata jsonb, -- For flexible metadata storage
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add indexes for better query performance
create index audio_tracks_user_id_idx on public.audio_tracks(user_id);
create index audio_tracks_created_at_idx on public.audio_tracks(created_at);
create index audio_playlists_user_id_idx on public.audio_playlists(user_id);
create index audio_playlist_tracks_playlist_id_idx on public.audio_playlist_tracks(playlist_id);
create index audio_playlist_tracks_track_id_idx on public.audio_playlist_tracks(track_id);
create index audio_track_metadata_track_id_idx on public.audio_track_metadata(track_id);

-- Enable RLS
alter table public.audio_tracks enable row level security;
alter table public.audio_playlists enable row level security;
alter table public.audio_playlist_tracks enable row level security;
alter table public.audio_track_metadata enable row level security;

-- RLS Policies for audio_tracks
create policy "Users can view their own tracks"
    on public.audio_tracks for select
    using (user_id = auth.uid());

create policy "Users can insert their own tracks"
    on public.audio_tracks for insert
    with check (user_id = auth.uid());

create policy "Users can update their own tracks"
    on public.audio_tracks for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "Users can delete their own tracks"
    on public.audio_tracks for delete
    using (user_id = auth.uid());

-- RLS Policies for audio_playlists
create policy "Users can view their own playlists"
    on public.audio_playlists for select
    using (
        user_id = auth.uid() 
        or visibility = 'public'
        or (visibility = 'unlisted' and exists (
            select 1 from public.audio_playlist_tracks apt
            where apt.playlist_id = id
        ))
    );

create policy "Users can insert their own playlists"
    on public.audio_playlists for insert
    with check (user_id = auth.uid());

create policy "Users can update their own playlists"
    on public.audio_playlists for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "Users can delete their own playlists"
    on public.audio_playlists for delete
    using (user_id = auth.uid());

-- RLS Policies for audio_playlist_tracks
create policy "Users can view playlist tracks"
    on public.audio_playlist_tracks for select
    using (
        exists (
            select 1 from public.audio_playlists ap
            where ap.id = playlist_id
            and (
                ap.user_id = auth.uid()
                or ap.visibility = 'public'
                or ap.visibility = 'unlisted'
            )
        )
    );

create policy "Users can manage their playlist tracks"
    on public.audio_playlist_tracks for all
    using (
        exists (
            select 1 from public.audio_playlists ap
            where ap.id = playlist_id
            and ap.user_id = auth.uid()
        )
    );

-- RLS Policies for audio_track_metadata
create policy "Users can view track metadata"
    on public.audio_track_metadata for select
    using (
        exists (
            select 1 from public.audio_tracks at
            where at.id = track_id
            and at.user_id = auth.uid()
        )
    );

create policy "Users can manage their track metadata"
    on public.audio_track_metadata for all
    using (
        exists (
            select 1 from public.audio_tracks at
            where at.id = track_id
            and at.user_id = auth.uid()
        )
    );

-- Create function to update playlist statistics
create or replace function public.update_playlist_stats()
returns trigger as $$
declare
    v_total_duration integer;
    v_track_count integer;
begin
    -- Calculate new stats
    select 
        coalesce(sum(at.duration), 0),
        count(apt.id)
    into v_total_duration, v_track_count
    from public.audio_playlist_tracks apt
    join public.audio_tracks at on at.id = apt.track_id
    where apt.playlist_id = COALESCE(NEW.playlist_id, OLD.playlist_id);

    -- Update playlist
    update public.audio_playlists
    set 
        total_duration = v_total_duration,
        track_count = v_track_count,
        updated_at = now()
    where id = COALESCE(NEW.playlist_id, OLD.playlist_id);

    return NEW;
end;
$$ language plpgsql security definer;

-- Create triggers to maintain playlist statistics
create trigger update_playlist_stats_insert
    after insert on public.audio_playlist_tracks
    for each row
    execute function public.update_playlist_stats();

create trigger update_playlist_stats_delete
    after delete on public.audio_playlist_tracks
    for each row
    execute function public.update_playlist_stats();

-- Create function to increment play count
create or replace function public.increment_track_play_count(p_track_id uuid)
returns void as $$
begin
    insert into public.audio_track_metadata (
        track_id,
        play_count,
        last_played_at
    )
    values (
        p_track_id,
        1,
        now()
    )
    on conflict (track_id)
    do update set
        play_count = audio_track_metadata.play_count + 1,
        last_played_at = now(),
        updated_at = now();
end;
$$ language plpgsql security definer; 