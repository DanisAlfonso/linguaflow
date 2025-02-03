-- Create a table to store audio files
create table if not exists public.audio_files (
    id uuid default gen_random_uuid() primary key,
    file_path text not null,
    original_filename text not null,
    mime_type text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a table to store audio-text associations
create table if not exists public.card_audio_segments (
    id uuid default gen_random_uuid() primary key,
    card_id uuid references public.cards(id) on delete cascade not null,
    audio_file_id uuid references public.audio_files(id) on delete cascade not null,
    text_start integer not null, -- Start position in the text
    text_end integer not null, -- End position in the text
    side text not null check (side in ('front', 'back')), -- Which side of the card the audio is for
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint valid_text_range check (text_end > text_start)
);

-- Add indexes for better query performance
create index card_audio_segments_card_id_idx on public.card_audio_segments(card_id);
create index card_audio_segments_audio_file_id_idx on public.card_audio_segments(audio_file_id);

-- Enable RLS
alter table public.audio_files enable row level security;
alter table public.card_audio_segments enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can insert their own audio files" on public.audio_files;

-- Create updated policies
create policy "Users can insert and update their own audio files"
    on public.audio_files for all
    using (true)
    with check (true);

create policy "Users can view their own audio files"
    on public.audio_files for select
    using (
        exists (
            select 1 from public.card_audio_segments cas
            join public.cards c on c.id = cas.card_id
            join public.decks d on d.id = c.deck_id
            where cas.audio_file_id = audio_files.id
            and d.user_id = auth.uid()
        )
    );

create policy "Users can delete their own audio files"
    on public.audio_files for delete
    using (
        exists (
            select 1 from public.card_audio_segments cas
            join public.cards c on c.id = cas.card_id
            join public.decks d on d.id = c.deck_id
            where cas.audio_file_id = audio_files.id
            and d.user_id = auth.uid()
        )
    );

create policy "Users can view their own audio segments"
    on public.card_audio_segments for select
    using (
        exists (
            select 1 from public.cards c
            join public.decks d on d.id = c.deck_id
            where c.id = card_audio_segments.card_id
            and d.user_id = auth.uid()
        )
    );

create policy "Users can insert their own audio segments"
    on public.card_audio_segments for insert
    with check (
        exists (
            select 1 from public.cards c
            join public.decks d on d.id = c.deck_id
            where c.id = card_audio_segments.card_id
            and d.user_id = auth.uid()
        )
    );

create policy "Users can delete their own audio segments"
    on public.card_audio_segments for delete
    using (
        exists (
            select 1 from public.cards c
            join public.decks d on d.id = c.deck_id
            where c.id = card_audio_segments.card_id
            and d.user_id = auth.uid()
        )
    );

-- Create a function to get audio segments for a card
create or replace function public.get_card_audio_segments(p_card_id uuid)
returns table (
    id uuid,
    audio_file_path text,
    text_start integer,
    text_end integer,
    side text
) security definer
set search_path = public
language plpgsql
as $$
begin
    return query
    select 
        cas.id,
        af.file_path as audio_file_path,
        cas.text_start,
        cas.text_end,
        cas.side
    from card_audio_segments cas
    join audio_files af on af.id = cas.audio_file_id
    where cas.card_id = p_card_id
    order by cas.side, cas.text_start;
end;
$$; 