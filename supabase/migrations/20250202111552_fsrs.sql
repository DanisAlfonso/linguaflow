-- Drop existing spaced repetition columns
alter table public.cards
  drop column ease_factor,
  drop column interval;

-- Add FSRS columns
alter table public.cards
  add column state integer default 0 not null, -- New(0), Learning(1), Review(2), Relearning(3)
  add column difficulty real default 0 not null,
  add column stability real default 0 not null,
  add column retrievability real default 1 not null,
  add column elapsed_days integer default 0 not null,
  add column scheduled_days integer default 0 not null,
  add column reps integer default 0 not null,
  add column lapses integer default 0 not null;

-- Add constraints
alter table public.cards
  add constraint cards_difficulty_range check (difficulty >= 0 and difficulty <= 1),
  add constraint cards_stability_positive check (stability >= 0),
  add constraint cards_retrievability_range check (retrievability >= 0 and retrievability <= 1);

-- Update the update_deck_stats function to handle cards_to_review based on retrievability
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
          when old.state = 0 then new_cards - 1 
          else new_cards 
        end,
        cards_to_review = case 
          when old.retrievability < 0.9 then cards_to_review - 1 
          else cards_to_review 
        end
    where id = old.deck_id;
  end if;
  return null;
end;
$$ language plpgsql security definer; 