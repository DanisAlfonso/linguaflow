-- Drop the trigger first
drop trigger if exists on_audio_file_deleted on public.audio_files;

-- Then drop the function
drop function if exists public.handle_deleted_audio_file();

-- Drop the cleanup function as well since it uses direct table access
drop function if exists storage.cleanup_orphaned_files(); 