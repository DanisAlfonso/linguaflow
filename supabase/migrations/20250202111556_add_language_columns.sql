-- Add new columns to decks table if they don't exist
do $$ 
begin
    if not exists (select 1 from information_schema.columns where table_name = 'decks' and column_name = 'language') then
        alter table public.decks add column language text not null default 'General';
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'decks' and column_name = 'settings') then
        alter table public.decks add column settings jsonb not null default '{}'::jsonb;
    end if;
end $$;

-- Add language constraint if it doesn't exist
do $$
begin
    if not exists (select 1 from information_schema.constraint_column_usage where table_name = 'decks' and constraint_name = 'decks_language_check') then
        alter table public.decks
        add constraint decks_language_check check (
            language in ('General', 'Mandarin', 'Spanish', 'French', 'German', 'Japanese', 'Korean', 'Italian', 'Portuguese', 'Russian')
        );
    end if;
end $$;

-- Add language_specific_data to cards table if it doesn't exist
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'cards' and column_name = 'language_specific_data') then
        alter table public.cards add column language_specific_data jsonb not null default '{}'::jsonb;
    end if;
end $$; 