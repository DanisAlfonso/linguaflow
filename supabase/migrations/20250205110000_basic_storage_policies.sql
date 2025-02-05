-- Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Drop existing policies if they exist
drop policy if exists "authenticated_select" on storage.objects;
drop policy if exists "authenticated_insert" on storage.objects;
drop policy if exists "authenticated_update" on storage.objects;
drop policy if exists "authenticated_delete" on storage.objects;

-- Create basic policies for all authenticated users
create policy "authenticated_select"
on storage.objects for select
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
);

create policy "authenticated_insert"
on storage.objects for insert
with check (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
);

create policy "authenticated_update"
on storage.objects for update
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
);

create policy "authenticated_delete"
on storage.objects for delete
using (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
); 