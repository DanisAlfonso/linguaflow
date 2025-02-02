-- Drop old columns and constraints
ALTER TABLE cards
DROP COLUMN IF EXISTS ease_factor,
DROP COLUMN IF EXISTS interval;

-- Make FSRS columns NOT NULL and add constraints
ALTER TABLE cards
ALTER COLUMN state SET NOT NULL,
ALTER COLUMN difficulty SET NOT NULL,
ALTER COLUMN stability SET NOT NULL,
ALTER COLUMN retrievability SET NOT NULL,
ALTER COLUMN elapsed_days SET NOT NULL,
ALTER COLUMN scheduled_days SET NOT NULL,
ALTER COLUMN reps SET NOT NULL,
ALTER COLUMN lapses SET NOT NULL;

-- Add FSRS constraints
ALTER TABLE cards
ADD CONSTRAINT cards_difficulty_range CHECK (difficulty >= 0 AND difficulty <= 1),
ADD CONSTRAINT cards_stability_positive CHECK (stability >= 0),
ADD CONSTRAINT cards_retrievability_range CHECK (retrievability >= 0 AND retrievability <= 1);

-- Create the deck review stats function
CREATE OR REPLACE FUNCTION public.update_deck_review_stats(p_deck_id uuid)
RETURNS void AS $$
DECLARE
  v_now timestamp with time zone;
  v_new_count integer;
  v_review_count integer;
BEGIN
  v_now := timezone('utc'::text, now());
  
  -- Count new cards
  SELECT count(*)
  INTO v_new_count
  FROM public.cards
  WHERE deck_id = p_deck_id
    AND state = 0;
    
  -- Count cards due for review
  SELECT count(*)
  INTO v_review_count
  FROM public.cards
  WHERE deck_id = p_deck_id
    AND (
      -- Include cards that are:
      -- 1. In learning/relearning state
      state in (1, 3)
      -- 2. In review state and due
      OR (state = 2 AND next_review_at <= v_now)
    );
  
  -- Update deck statistics
  UPDATE public.decks
  SET new_cards = v_new_count,
      cards_to_review = v_review_count,
      last_studied_at = v_now
  WHERE id = p_deck_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 