-- Create decks table
create table public.decks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  total_cards integer default 0 not null,
  new_cards integer default 0 not null,
  cards_to_review integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_studied_at timestamp with time zone,
  tags text[] default '{}'::text[] not null,
  
  constraint decks_name_length check (char_length(name) >= 1 and char_length(name) <= 100)
);

-- Create cards table
create table public.cards (
  id uuid default gen_random_uuid() primary key,
  deck_id uuid references public.decks(id) on delete cascade not null,
  front text not null,
  back text not null,
  notes text,
  tags text[] default '{}'::text[] not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_reviewed_at timestamp with time zone,
  next_review_at timestamp with time zone,
  review_count integer default 0 not null,
  consecutive_correct integer default 0 not null,
  ease_factor numeric(4,3) default 2.5 not null,
  interval integer default 0 not null,
  
  constraint cards_front_length check (char_length(front) >= 1),
  constraint cards_back_length check (char_length(back) >= 1),
  constraint cards_ease_factor_range check (ease_factor >= 1.3)
);

-- Create RLS policies
alter table public.decks enable row level security;
alter table public.cards enable row level security;

create policy "Users can view their own decks"
  on public.decks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own decks"
  on public.decks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own decks"
  on public.decks for update
  using (auth.uid() = user_id);

create policy "Users can delete their own decks"
  on public.decks for delete
  using (auth.uid() = user_id);

create policy "Users can view cards in their decks"
  on public.cards for select
  using (
    exists (
      select 1 from public.decks
      where id = cards.deck_id
      and user_id = auth.uid()
    )
  );

create policy "Users can insert cards in their decks"
  on public.cards for insert
  with check (
    exists (
      select 1 from public.decks
      where id = cards.deck_id
      and user_id = auth.uid()
    )
  );

create policy "Users can update cards in their decks"
  on public.cards for update
  using (
    exists (
      select 1 from public.decks
      where id = cards.deck_id
      and user_id = auth.uid()
    )
  );

create policy "Users can delete cards in their decks"
  on public.cards for delete
  using (
    exists (
      select 1 from public.decks
      where id = cards.deck_id
      and user_id = auth.uid()
    )
  );

-- Create functions to update deck statistics
create or replace function public.update_deck_stats()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    update public.decks
    set total_cards = total_cards + 1,
        new_cards = new_cards + 1
    where id = new.deck_id;
  elsif (tg_op = 'DELETE') then
    update public.decks
    set total_cards = total_cards - 1,
        new_cards = case 
          when old.review_count = 0 then new_cards - 1 
          else new_cards 
        end,
        cards_to_review = case 
          when old.next_review_at <= now() then cards_to_review - 1 
          else cards_to_review 
        end
    where id = old.deck_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger cards_after_insert_delete
  after insert or delete on public.cards
  for each row execute function public.update_deck_stats(); 