-- Create a function to update deck review statistics
create or replace function public.update_deck_review_stats(p_deck_id uuid)
returns void as $$
declare
  v_now timestamp with time zone;
  v_new_count integer;
  v_review_count integer;
begin
  v_now := timezone('utc'::text, now());
  
  -- Count new cards
  select count(*)
  into v_new_count
  from public.cards
  where deck_id = p_deck_id
    and state = 0;
    
  -- Count cards due for review
  select count(*)
  into v_review_count
  from public.cards
  where deck_id = p_deck_id
    and (
      -- Include cards that are:
      -- 1. In learning/relearning state
      state in (1, 3)
      -- 2. In review state and due (retrievability < 0.9)
      or (state = 2 and next_review_at <= v_now)
    );
  
  -- Update deck statistics
  update public.decks
  set new_cards = v_new_count,
      cards_to_review = v_review_count,
      last_studied_at = v_now
  where id = p_deck_id;
end;
$$ language plpgsql security definer; 