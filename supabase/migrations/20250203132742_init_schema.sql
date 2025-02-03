-- Create decks table
create table if not exists public.decks (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    description text,
    language text not null default 'General',
    settings jsonb not null default '{}',
    total_cards integer default 0,
    new_cards integer default 0,
    cards_to_review integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_studied_at timestamp with time zone,
    tags text[] default array[]::text[]
);

-- Create cards table
create table if not exists public.cards (
    id uuid default gen_random_uuid() primary key,
    deck_id uuid references public.decks(id) on delete cascade not null,
    front text not null,
    back text not null,
    notes text,
    tags text[] default array[]::text[],
    language_specific_data jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_reviewed_at timestamp with time zone,
    next_review_at timestamp with time zone,
    review_count integer default 0,
    consecutive_correct integer default 0,
    state integer default 0,
    difficulty real default 0,
    stability real default 0,
    retrievability real default 1,
    elapsed_days real default 0,
    scheduled_days real default 0,
    reps integer default 0,
    lapses integer default 0,
    scheduled_in_minutes integer,
    step_index integer default 0,
    queue text default 'new'
);

-- Create audio files table
create table if not exists public.audio_files (
    id uuid default gen_random_uuid() primary key,
    file_path text not null,
    original_filename text not null,
    mime_type text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create audio segments table
create table if not exists public.card_audio_segments (
    id uuid default gen_random_uuid() primary key,
    card_id uuid references public.cards(id) on delete cascade not null,
    audio_file_id uuid references public.audio_files(id) on delete cascade not null,
    text_start integer not null,
    text_end integer not null,
    side text not null check (side in ('front', 'back')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint valid_text_range check (text_end > text_start)
);

-- Add indexes for better query performance
create index card_audio_segments_card_id_idx on public.card_audio_segments(card_id);
create index card_audio_segments_audio_file_id_idx on public.card_audio_segments(audio_file_id);

-- Enable RLS
alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.audio_files enable row level security;
alter table public.card_audio_segments enable row level security;

-- Create RLS policies
create policy "Users can view their own decks"
    on public.decks for select
    using (user_id = auth.uid());

create policy "Users can insert their own decks"
    on public.decks for insert
    with check (user_id = auth.uid());

create policy "Users can update their own decks"
    on public.decks for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "Users can delete their own decks"
    on public.decks for delete
    using (user_id = auth.uid());

create policy "Users can view cards in their decks"
    on public.cards for select
    using (
        exists (
            select 1 from public.decks d
            where d.id = deck_id
            and d.user_id = auth.uid()
        )
    );

create policy "Users can insert cards in their decks"
    on public.cards for insert
    with check (
        exists (
            select 1 from public.decks d
            where d.id = deck_id
            and d.user_id = auth.uid()
        )
    );

create policy "Users can update cards in their decks"
    on public.cards for update
    using (
        exists (
            select 1 from public.decks d
            where d.id = deck_id
            and d.user_id = auth.uid()
        )
    );

create policy "Users can delete cards in their decks"
    on public.cards for delete
    using (
        exists (
            select 1 from public.decks d
            where d.id = deck_id
            and d.user_id = auth.uid()
        )
    );

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

create policy "Users can insert their own audio files"
    on public.audio_files for insert
    with check (true);

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
