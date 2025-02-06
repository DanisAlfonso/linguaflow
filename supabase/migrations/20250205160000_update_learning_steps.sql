-- Update the get_due_cards function to handle learning steps better
CREATE OR REPLACE FUNCTION get_due_cards(p_deck_id uuid, p_limit integer)
RETURNS SETOF cards AS $$
DECLARE
  v_now timestamp with time zone := now();
  v_buffer_interval interval := '30 seconds'::interval; -- Buffer time for learning cards
BEGIN
  -- First return learning/relearning cards that are due (including buffer time)
  RETURN QUERY
  SELECT *
  FROM cards
  WHERE deck_id = p_deck_id
    AND queue = 'learn'
    AND (
      -- Card is due within buffer time or overdue
      (scheduled_in_minutes IS NOT NULL AND 
       last_reviewed_at + (scheduled_in_minutes || ' minutes')::interval - v_buffer_interval <= v_now)
      OR last_reviewed_at IS NULL
    )
  ORDER BY 
    -- Overdue cards first
    CASE WHEN last_reviewed_at + (scheduled_in_minutes || ' minutes')::interval <= v_now THEN 0 ELSE 1 END,
    -- Then by scheduled time
    last_reviewed_at + (scheduled_in_minutes || ' minutes')::interval NULLS FIRST
  LIMIT p_limit;

  -- If no learning cards are due, return review cards
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT *
    FROM cards
    WHERE deck_id = p_deck_id
      AND queue = 'review'
      AND next_review_at <= v_now
    ORDER BY next_review_at
    LIMIT p_limit;
  END IF;

  -- If no review cards are due, return new cards
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT *
    FROM cards
    WHERE deck_id = p_deck_id
      AND queue = 'new'
    ORDER BY created_at
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update the deck settings to include default learning steps
ALTER TABLE public.decks
DROP COLUMN IF EXISTS learning_steps,
DROP COLUMN IF EXISTS relearning_steps,
ADD COLUMN learning_steps integer[] DEFAULT ARRAY[1, 5, 10] NOT NULL,
ADD COLUMN relearning_steps integer[] DEFAULT ARRAY[10] NOT NULL;

-- Add a constraint to ensure learning steps are valid
ALTER TABLE public.decks
ADD CONSTRAINT valid_learning_steps 
CHECK (
  array_length(learning_steps, 1) > 0 
  AND array_length(relearning_steps, 1) > 0
);

-- Update the update_deck_review_stats function to handle learning cards better
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
    AND queue = 'new';
    
  -- Count cards due for review
  SELECT count(*)
  INTO v_review_count
  FROM public.cards
  WHERE deck_id = p_deck_id
    AND (
      -- Include cards that are:
      -- 1. In learning/relearning queue and due (with 30s buffer)
      (queue = 'learn' AND 
       last_reviewed_at + (scheduled_in_minutes || ' minutes')::interval - '30 seconds'::interval <= v_now)
      -- 2. In review queue and due
      OR (queue = 'review' AND next_review_at <= v_now)
    );
  
  -- Update deck statistics
  UPDATE public.decks
  SET new_cards = v_new_count,
      cards_to_review = v_review_count,
      last_studied_at = v_now
  WHERE id = p_deck_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 