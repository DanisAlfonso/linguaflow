-- Enable RLS on audio_tracks table
alter table audio_tracks enable row level security;

-- Policy to allow users to insert their own tracks
create policy "Users can insert their own tracks"
on audio_tracks for insert
with check (
    auth.uid() = user_id
);

-- Policy to allow users to view their own tracks
create policy "Users can view their own tracks"
on audio_tracks for select
using (
    auth.uid() = user_id
);

-- Policy to allow users to update their own tracks
create policy "Users can update their own tracks"
on audio_tracks for update
using (
    auth.uid() = user_id
)
with check (
    auth.uid() = user_id
);

-- Policy to allow users to delete their own tracks
create policy "Users can delete their own tracks"
on audio_tracks for delete
using (
    auth.uid() = user_id
); 