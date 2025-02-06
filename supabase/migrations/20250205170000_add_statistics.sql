-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_user_statistics(uuid);
DROP FUNCTION IF EXISTS get_user_daily_activity(uuid, integer);
DROP FUNCTION IF EXISTS get_user_hourly_activity(uuid, integer);
DROP FUNCTION IF EXISTS get_user_response_distribution(uuid, integer);

-- Function to calculate user statistics
CREATE OR REPLACE FUNCTION get_user_statistics(p_user_id uuid DEFAULT auth.uid())
RETURNS json AS $$
DECLARE
  v_now timestamp with time zone;
  v_stats json;
  v_total_cards_learned integer;
  v_study_time_minutes integer;
  v_day_streak integer;
  v_accuracy numeric;
  v_avg_response_time numeric;
  v_review_rate numeric;
  v_last_studied_date date;
  v_current_date date;
  v_consecutive_days integer := 0;
BEGIN
  v_now := timezone('utc'::text, now());
  v_current_date := date(v_now);

  -- Calculate total cards (including unreviewed ones)
  SELECT COALESCE(count(DISTINCT c.id)::integer, 0)
  INTO v_total_cards_learned
  FROM cards c
  JOIN decks d ON c.deck_id = d.id
  WHERE d.user_id = p_user_id;

  -- Calculate total study time (sum of all review durations)
  SELECT COALESCE(sum(EXTRACT(EPOCH FROM duration) / 60)::integer, 0)
  INTO v_study_time_minutes
  FROM study_sessions
  WHERE user_id = p_user_id;

  -- Calculate accuracy (percentage of "Good" or "Easy" responses)
  WITH review_stats AS (
    SELECT 
      COUNT(*)::integer as total_reviews,
      SUM(CASE WHEN rating IN (3, 4) THEN 1 ELSE 0 END)::integer as good_reviews
    FROM card_reviews
    WHERE user_id = p_user_id
  )
  SELECT 
    CASE 
      WHEN total_reviews > 0 THEN 
        ROUND((good_reviews::numeric / total_reviews::numeric) * 100, 1)
      ELSE 0 
    END
  INTO v_accuracy
  FROM review_stats;

  -- Calculate average response time (in seconds)
  SELECT COALESCE(ROUND(avg(response_time_ms)::numeric / 1000, 1), 0)
  INTO v_avg_response_time
  FROM card_reviews
  WHERE user_id = p_user_id;

  -- Calculate review rate (percentage of cards that needed review)
  WITH review_stats AS (
    SELECT 
      COUNT(*)::integer as total_reviews,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)::integer as again_reviews
    FROM card_reviews
    WHERE user_id = p_user_id
  )
  SELECT 
    CASE 
      WHEN total_reviews > 0 THEN 
        ROUND((again_reviews::numeric / total_reviews::numeric) * 100, 1)
      ELSE 0 
    END
  INTO v_review_rate
  FROM review_stats;

  -- Calculate streak
  WITH RECURSIVE dates AS (
    SELECT DISTINCT date(created_at) as study_date
    FROM card_reviews
    WHERE user_id = p_user_id
    ORDER BY date(created_at) DESC
  ),
  streak_calc AS (
    SELECT 
      study_date,
      1 as streak,
      study_date as prev_date
    FROM dates
    WHERE study_date = (SELECT MAX(study_date) FROM dates)
    
    UNION ALL
    
    SELECT 
      d.study_date,
      s.streak + 1,
      d.study_date
    FROM dates d
    JOIN streak_calc s ON d.study_date = s.prev_date - 1
  )
  SELECT COALESCE(MAX(streak)::integer, 0)
  INTO v_day_streak
  FROM streak_calc;

  -- Build the final statistics JSON
  v_stats := json_build_object(
    'total_cards_learned', v_total_cards_learned,
    'study_time_minutes', v_study_time_minutes,
    'day_streak', v_day_streak,
    'accuracy', v_accuracy,
    'avg_response_time', v_avg_response_time,
    'review_rate', v_review_rate
  );

  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create tables for tracking statistics if they don't exist
CREATE TABLE IF NOT EXISTS study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id uuid REFERENCES decks(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration interval,
  cards_reviewed integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS card_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  deck_id uuid REFERENCES decks(id) ON DELETE CASCADE,
  rating smallint NOT NULL,
  response_time_ms integer,
  created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_card_reviews_user_id ON card_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_card_reviews_created_at ON card_reviews(created_at);

-- Enable RLS
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own study sessions" ON study_sessions;
    DROP POLICY IF EXISTS "Users can insert their own study sessions" ON study_sessions;
    DROP POLICY IF EXISTS "Users can update their own study sessions" ON study_sessions;
    DROP POLICY IF EXISTS "Users can view their own card reviews" ON card_reviews;
    DROP POLICY IF EXISTS "Users can insert their own card reviews" ON card_reviews;
EXCEPTION 
    WHEN undefined_object THEN 
        NULL;
END $$;

-- Create policies
CREATE POLICY "Users can view their own study sessions"
  ON study_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own study sessions"
  ON study_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own study sessions"
  ON study_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own card reviews"
  ON card_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own card reviews"
  ON card_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to get daily activity data for the heatmap
CREATE OR REPLACE FUNCTION get_user_daily_activity(
  p_user_id uuid DEFAULT auth.uid(),
  p_days_back integer DEFAULT 30
)
RETURNS TABLE (
  study_date date,
  cards_reviewed integer,
  study_minutes integer,
  accuracy numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_reviews AS (
    SELECT
      date(created_at) as review_date,
      COUNT(DISTINCT card_id)::integer as cards_reviewed,
      ROUND(
        (SUM(CASE WHEN rating IN (3, 4) THEN 1 ELSE 0 END)::numeric / 
         COUNT(*)::numeric * 100
        ), 1
      ) as accuracy
    FROM card_reviews cr
    WHERE user_id = p_user_id
    AND created_at >= now() - (p_days_back || ' days')::interval
    GROUP BY date(created_at)
  ),
  daily_study_time AS (
    SELECT
      date(created_at) as study_date,
      (EXTRACT(EPOCH FROM SUM(duration)) / 60)::integer as study_minutes
    FROM study_sessions
    WHERE user_id = p_user_id
    AND created_at >= now() - (p_days_back || ' days')::interval
    GROUP BY date(created_at)
  )
  SELECT
    dr.review_date as study_date,
    dr.cards_reviewed,
    COALESCE(dst.study_minutes, 0) as study_minutes,
    dr.accuracy
  FROM daily_reviews dr
  LEFT JOIN daily_study_time dst ON dst.study_date = dr.review_date
  ORDER BY dr.review_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get hourly activity distribution
CREATE OR REPLACE FUNCTION get_user_hourly_activity(
  p_user_id uuid DEFAULT auth.uid(),
  p_days_back integer DEFAULT 30
)
RETURNS TABLE (
  hour_of_day integer,
  cards_reviewed integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(HOUR FROM cr.created_at)::integer as hour_of_day,
    COUNT(*)::integer as cards_reviewed
  FROM card_reviews cr
  WHERE cr.user_id = p_user_id
  AND cr.created_at >= now() - (p_days_back || ' days')::interval
  GROUP BY hour_of_day
  ORDER BY hour_of_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get response time distribution
CREATE OR REPLACE FUNCTION get_user_response_distribution(
  p_user_id uuid DEFAULT auth.uid(),
  p_days_back integer DEFAULT 30
)
RETURNS TABLE (
  response_bucket text,
  count integer
) AS $$
BEGIN
  RETURN QUERY
  WITH buckets AS (
    SELECT
      CASE
        WHEN response_time_ms < 1000 THEN '< 1s'
        WHEN response_time_ms < 2000 THEN '1-2s'
        WHEN response_time_ms < 3000 THEN '2-3s'
        WHEN response_time_ms < 5000 THEN '3-5s'
        ELSE '5s+'
      END as bucket_name,
      COUNT(*)::integer as review_count
    FROM card_reviews
    WHERE user_id = p_user_id
    AND created_at >= now() - (p_days_back || ' days')::interval
    GROUP BY 1
  )
  SELECT
    bucket_name as response_bucket,
    review_count as count
  FROM buckets
  ORDER BY
    CASE bucket_name
      WHEN '< 1s' THEN 1
      WHEN '1-2s' THEN 2
      WHEN '2-3s' THEN 3
      WHEN '3-5s' THEN 4
      ELSE 5
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 