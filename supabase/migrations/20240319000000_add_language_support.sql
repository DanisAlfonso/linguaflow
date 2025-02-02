-- Add language support to decks
alter table public.decks
add column language text not null default 'General',
add column settings jsonb not null default '{}';

-- Add language-specific content to cards
alter table public.cards
add column language_specific_data jsonb not null default '{}';

-- Add check constraint to validate language field
alter table public.decks
add constraint decks_language_check check (
  language in ('General', 'Mandarin', 'Spanish', 'French', 'German', 'Japanese', 'Korean', 'Italian', 'Portuguese', 'Russian')
);

-- Create an index on the language field for better query performance
create index decks_language_idx on public.decks (language);

-- Add comment to explain the settings field
comment on column public.decks.settings is 'Language-specific settings (e.g., showPinyin for Mandarin)';

-- Add comment to explain the language_specific_data field
comment on column public.cards.language_specific_data is 'Language-specific content (e.g., pinyin for Mandarin characters)'; 