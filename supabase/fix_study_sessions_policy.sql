-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own study sessions" ON study_sessions;
DROP POLICY IF EXISTS "Users can insert their own card reviews" ON card_reviews;

-- Drop existing triggers
DROP TRIGGER IF EXISTS set_study_session_user_id ON study_sessions;
DROP TRIGGER IF EXISTS set_card_review_user_id ON card_reviews;

-- Create function to set user_id if it doesn't exist
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically set user_id on study sessions
CREATE TRIGGER set_study_session_user_id
  BEFORE INSERT ON study_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

-- Create trigger to automatically set user_id on card reviews
CREATE TRIGGER set_card_review_user_id
  BEFORE INSERT ON card_reviews
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

-- Create updated policies
CREATE POLICY "Users can insert their own study sessions"
  ON study_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM decks d
      WHERE d.id = deck_id
      AND d.user_id = auth.uid()
    )
  );

-- Create policy for card reviews
CREATE POLICY "Users can insert their own card reviews"
  ON card_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM decks d
      WHERE d.id = deck_id
      AND d.user_id = auth.uid()
    )
  ); 