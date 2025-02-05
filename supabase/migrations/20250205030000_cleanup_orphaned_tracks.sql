-- Function to check if a file exists in storage
create or replace function storage.file_exists(bucket text, path text)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1
    from storage.objects
    where bucket_id = file_exists.bucket
    and name = path
  );
end;
$$;

-- Clean up orphaned audio tracks where the file doesn't exist in storage
delete from public.audio_tracks at
where not exists (
    select 1 
    from storage.objects o
    join public.audio_files af on o.name = af.file_path
    where o.bucket_id = 'audio'
    and af.id = at.audio_file_id
);

-- Clean up orphaned audio files
delete from public.audio_files af
where not exists (
    select 1 
    from storage.objects o
    where o.bucket_id = 'audio'
    and o.name = af.file_path
);

-- Add a function to validate track before playing
create or replace function public.validate_track_file(track_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
    v_file_path text;
begin
    select af.file_path into v_file_path
    from public.audio_tracks at
    join public.audio_files af on af.id = at.audio_file_id
    where at.id = track_id;

    if v_file_path is null then
        return false;
    end if;

    return storage.file_exists('audio', v_file_path);
end;
$$; 