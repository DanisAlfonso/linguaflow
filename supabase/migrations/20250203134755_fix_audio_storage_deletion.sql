-- Drop the existing trigger and function
drop trigger if exists trigger_delete_audio_file_from_storage on public.audio_files;
drop function if exists delete_audio_file_from_storage;
drop function if exists storage.delete_audio_file;
drop trigger if exists trigger_delete_orphaned_audio_files on public.card_audio_segments;
drop function if exists delete_orphaned_audio_files;

-- Create a function to delete from storage with proper permissions
create or replace function storage.delete_audio_file(file_path text)
returns void
security definer
set search_path = public
language plpgsql
as $$
declare
    object_exists boolean;
begin
    -- Log the attempt to delete
    raise notice 'Attempting to delete file from storage: %', file_path;
    
    -- Check if the object exists
    select exists(
        select 1 from storage.objects
        where bucket_id = 'audio'
        and name = file_path
    ) into object_exists;
    
    raise notice 'File exists in storage: %', object_exists;
    
    -- Delete the file
    delete from storage.objects
    where bucket_id = 'audio'
    and name = file_path;
    
    -- Log the result
    if found then
        raise notice 'Successfully deleted file from storage: %', file_path;
    else
        raise notice 'No file was deleted from storage. File may not exist: %', file_path;
    end if;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function storage.delete_audio_file(text) to authenticated;

-- Create a function to delete orphaned audio files
create or replace function delete_orphaned_audio_files()
returns trigger as $$
declare
    is_orphaned boolean;
    audio_file record;
begin
    -- Check if this audio file is now orphaned
    select not exists (
        select 1 
        from public.card_audio_segments cas
        where cas.audio_file_id = old.audio_file_id
        and cas.id != old.id
    ) into is_orphaned;
    
    raise notice 'Checking if audio file % is orphaned: %', old.audio_file_id, is_orphaned;
    
    if is_orphaned then
        -- Get the audio file details
        select * from public.audio_files
        where id = old.audio_file_id
        into audio_file;
        
        if audio_file.id is not null then
            raise notice 'Deleting orphaned audio file: id=%, file_path=%', audio_file.id, audio_file.file_path;
            
            -- Delete the audio file record (this will trigger storage deletion)
            delete from public.audio_files
            where id = audio_file.id;
        end if;
    end if;
    
    return old;
end;
$$ language plpgsql security definer;

-- Create a trigger to run after delete on card_audio_segments
create trigger trigger_delete_orphaned_audio_files
    after delete on public.card_audio_segments
    for each row
    execute function delete_orphaned_audio_files();

-- Create the improved function to delete audio files from storage
create or replace function delete_audio_file_from_storage()
returns trigger as $$
begin
    -- Log the trigger execution
    raise notice 'Trigger executing for audio_file deletion: id=%, file_path=%', old.id, old.file_path;
    
    -- Use the storage function to delete the file with proper permissions
    perform storage.delete_audio_file(old.file_path);
    
    -- Log successful execution
    raise notice 'Trigger completed for audio_file: %', old.file_path;
    return old;
exception when others then
    -- Log any errors but don't prevent the database deletion
    raise warning 'Error in delete_audio_file_from_storage trigger: %', SQLERRM;
    raise notice 'Full error context: %', SQLSTATE;
    return old;
end;
$$ language plpgsql security definer;

-- Create a trigger to run before delete on audio_files
create trigger trigger_delete_audio_file_from_storage
    before delete on public.audio_files
    for each row
    execute function delete_audio_file_from_storage();
