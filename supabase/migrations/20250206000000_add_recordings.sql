-- Enable the moddatetime extension
create extension if not exists moddatetime schema extensions;

-- Create recordings table
create table recordings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id uuid references cards(id) on delete cascade not null,
  audio_url text not null,
  duration integer not null, -- Duration in milliseconds
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table recordings enable row level security;

create policy "Users can view their own recordings"
  on recordings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own recordings"
  on recordings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own recordings"
  on recordings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own recordings"
  on recordings for delete
  using (auth.uid() = user_id);

-- Add updated_at trigger
create trigger handle_updated_at before update on recordings
  for each row execute procedure moddatetime (updated_at);

-- Create index for faster queries
create index recordings_user_id_idx on recordings(user_id);
create index recordings_card_id_idx on recordings(card_id);

-- Create function to get recordings for a card
create or replace function get_card_recordings(p_card_id uuid)
returns table (
  id uuid,
  audio_url text,
  duration integer,
  created_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select r.id, r.audio_url, r.duration, r.created_at
  from recordings r
  where r.card_id = p_card_id
    and r.user_id = auth.uid()
  order by r.created_at desc;
end;
$$; 