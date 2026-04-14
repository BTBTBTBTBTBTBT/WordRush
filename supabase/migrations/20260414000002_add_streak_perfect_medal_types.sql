-- Add streak and perfect medal types to the medals table

-- Drop and recreate the medal_type CHECK constraint
ALTER TABLE medals DROP CONSTRAINT IF EXISTS m_valid_medal;
ALTER TABLE medals ADD CONSTRAINT m_valid_medal
  CHECK (medal_type IN ('gold', 'silver', 'bronze', 'streak_7', 'streak_30', 'streak_100', 'perfect'));
