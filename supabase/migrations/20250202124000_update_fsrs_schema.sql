-- Add new columns for FSRS
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS scheduled_in_minutes integer,
  ADD COLUMN IF NOT EXISTS step_index integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS queue text CHECK (queue IN ('new', 'learn', 'review')) DEFAULT 'new' NOT NULL;

-- Add deck settings for FSRS
ALTER TABLE public.decks
  ADD COLUMN IF NOT EXISTS learning_steps integer[] DEFAULT ARRAY[1, 10] NOT NULL,
  ADD COLUMN IF NOT EXISTS relearning_steps integer[] DEFAULT ARRAY[10] NOT NULL,
  ADD COLUMN IF NOT EXISTS graduating_interval integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS easy_interval integer DEFAULT 4 NOT NULL,
  ADD COLUMN IF NOT EXISTS lapsed_cards_settings jsonb DEFAULT '{
    "new_interval": 0.7,
    "minimum_interval": 1,
    "leech_threshold": 8
  }'::jsonb NOT NULL;

-- Create function to get due cards in proper order
CREATE OR REPLACE FUNCTION get_due_cards(p_deck_id uuid, p_limit integer)
RETURNS SETOF cards AS $$
DECLARE
  v_now timestamp with time zone := now();
BEGIN
  -- First return learning/relearning cards that are due
  RETURN QUERY
  SELECT *
  FROM cards
  WHERE deck_id = p_deck_id
    AND queue = 'learn'
    AND (
      (scheduled_in_minutes IS NOT NULL AND last_reviewed_at + (scheduled_in_minutes || ' minutes')::interval <= v_now)
      OR last_reviewed_at IS NULL
    )
  ORDER BY last_reviewed_at NULLS FIRST, scheduled_in_minutes
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