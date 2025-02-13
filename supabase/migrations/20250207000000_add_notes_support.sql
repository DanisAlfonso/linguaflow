-- Drop existing indexes if they exist
DROP INDEX IF EXISTS notes_user_id_idx;
DROP INDEX IF EXISTS notes_created_at_idx;
DROP INDEX IF EXISTS notes_folder_path_idx;
DROP INDEX IF EXISTS note_attachments_note_id_idx;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can view their own note attachments" ON public.note_attachments;
DROP POLICY IF EXISTS "Users can create their own note attachments" ON public.note_attachments;
DROP POLICY IF EXISTS "Users can delete their own note attachments" ON public.note_attachments;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_note_last_accessed_trigger ON public.notes;
DROP TRIGGER IF EXISTS update_note_timestamp_trigger ON public.notes;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS update_note_last_accessed();
DROP FUNCTION IF EXISTS update_note_timestamp();

-- Create notes table
create table if not exists public.notes (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    content text,
    rich_content jsonb,
    content_format text default 'plain' check (content_format in ('plain', 'rich')),
    language text,
    tags text[] default array[]::text[],
    is_pinned boolean default false,
    folder_path text default '/',
    color_preset text check (color_preset in ('blue', 'purple', 'green', 'orange', 'pink')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_accessed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create note_attachments table for files and recordings
create table if not exists public.note_attachments (
    id uuid default gen_random_uuid() primary key,
    note_id uuid references public.notes(id) on delete cascade not null,
    file_path text not null,
    file_type text not null,
    original_filename text not null,
    mime_type text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.notes enable row level security;
alter table public.note_attachments enable row level security;

-- Create RLS policies for notes
create policy "Users can view their own notes"
    on public.notes for select
    using (user_id = auth.uid());

create policy "Users can create their own notes"
    on public.notes for insert
    with check (user_id = auth.uid());

create policy "Users can update their own notes"
    on public.notes for update
    using (user_id = auth.uid());

create policy "Users can delete their own notes"
    on public.notes for delete
    using (user_id = auth.uid());

-- Create RLS policies for note attachments
create policy "Users can view their own note attachments"
    on public.note_attachments for select
    using (
        exists (
            select 1 from public.notes
            where id = note_id
            and user_id = auth.uid()
        )
    );

create policy "Users can create their own note attachments"
    on public.note_attachments for insert
    with check (
        exists (
            select 1 from public.notes
            where id = note_id
            and user_id = auth.uid()
        )
    );

create policy "Users can delete their own note attachments"
    on public.note_attachments for delete
    using (
        exists (
            select 1 from public.notes
            where id = note_id
            and user_id = auth.uid()
        )
    );

-- Create indexes for better performance
create index notes_user_id_idx on public.notes(user_id);
create index notes_created_at_idx on public.notes(created_at);
create index notes_folder_path_idx on public.notes(folder_path);
create index note_attachments_note_id_idx on public.note_attachments(note_id);

-- Create function to update last_accessed_at
create or replace function update_note_last_accessed()
returns trigger as $$
begin
    new.last_accessed_at = now();
    return new;
end;
$$ language plpgsql security definer;

-- Create trigger for last_accessed_at
create trigger update_note_last_accessed_trigger
    before update on public.notes
    for each row
    execute function update_note_last_accessed();

-- Create function to automatically update updated_at
create or replace function update_note_timestamp()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql security definer;

-- Create trigger for updated_at
create trigger update_note_timestamp_trigger
    before update on public.notes
    for each row
    execute function update_note_timestamp(); 