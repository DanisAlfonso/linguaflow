-- Drop the existing function if it exists
drop function if exists public.validate_track_file(uuid);

-- Recreate the function with the correct parameter name
create or replace function public.validate_track_file(p_track_id uuid)
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
    where at.id = p_track_id;

    if v_file_path is null then
        return false;
    end if;

    return storage.file_exists('audio', v_file_path);
end;
$$; 