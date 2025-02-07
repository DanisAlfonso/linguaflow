-- Add name column to recordings table
alter table recordings
add column name text;

-- Drop the existing function first
drop function if exists get_card_recordings(uuid);

-- Create the updated function with the name field
create or replace function get_card_recordings(p_card_id uuid)
returns table (
  id uuid,
  audio_url text,
  duration integer,
  created_at timestamp with time zone,
  name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select r.id, r.audio_url, r.duration, r.created_at, r.name
  from recordings r
  where r.card_id = p_card_id
    and r.user_id = auth.uid()
  order by r.created_at desc;
end;
$$; 