-- Drop existing foreign key constraints
alter table if exists public.card_audio_segments
  drop constraint if exists card_audio_segments_audio_file_id_fkey;

-- Recreate the foreign key constraint with cascade delete
alter table public.card_audio_segments
  add constraint card_audio_segments_audio_file_id_fkey
  foreign key (audio_file_id)
  references public.audio_files(id)
  on delete cascade;

-- Create a trigger function to delete orphaned audio files
create or replace function delete_orphaned_audio_files()
returns trigger as $$
begin
  -- Delete audio files that are no longer referenced by any audio segments
  delete from public.audio_files af
  where not exists (
    select 1
    from public.card_audio_segments cas
    where cas.audio_file_id = af.id
  );
  return null;
end;
$$ language plpgsql security definer;

-- Create a trigger to run after delete on card_audio_segments
drop trigger if exists trigger_delete_orphaned_audio_files on public.card_audio_segments;
create trigger trigger_delete_orphaned_audio_files
  after delete on public.card_audio_segments
  for each statement
  execute function delete_orphaned_audio_files();

-- Create a function to delete audio files from storage
create or replace function delete_audio_file_from_storage()
returns trigger as $$
declare
  storage_object record;
begin
  -- Delete the file from storage
  select * from storage.objects
  where bucket_id = 'audio'
  and name = old.file_path
  into storage_object;

  if storage_object.id is not null then
    delete from storage.objects
    where id = storage_object.id;
  end if;

  return old;
end;
$$ language plpgsql security definer;

-- Create a trigger to run before delete on audio_files
drop trigger if exists trigger_delete_audio_file_from_storage on public.audio_files;
create trigger trigger_delete_audio_file_from_storage
  before delete on public.audio_files
  for each row
  execute function delete_audio_file_from_storage();
