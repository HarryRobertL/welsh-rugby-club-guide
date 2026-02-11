-- Add 'women' to competition_type so women's competitions can be stored and displayed correctly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'competition_type' AND e.enumlabel = 'women'
  ) THEN
    ALTER TYPE competition_type ADD VALUE 'women';
  END IF;
END
$$;
