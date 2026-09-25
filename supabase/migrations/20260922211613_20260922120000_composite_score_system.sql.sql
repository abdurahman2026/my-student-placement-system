/*
# Phase 3: Composite Score System (retry)

Same as previous attempt but drops get_all_students_with_preferences()
before recreating it with the expanded return type.
*/

-- Drop the function first so we can recreate with different return columns
DROP FUNCTION IF EXISTS get_all_students_with_preferences();

-- ============================================================
-- Add scoring columns to student_profiles
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_profiles' AND column_name = 'grade_12_score'
  ) THEN
    ALTER TABLE student_profiles ADD COLUMN grade_12_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (grade_12_score >= 0 AND grade_12_score <= 100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_profiles' AND column_name = 'first_year_gpa'
  ) THEN
    ALTER TABLE student_profiles ADD COLUMN first_year_gpa numeric(3,2) NOT NULL DEFAULT 0 CHECK (first_year_gpa >= 0 AND first_year_gpa <= 4);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_profiles' AND column_name = 'is_female'
  ) THEN
    ALTER TABLE student_profiles ADD COLUMN is_female boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_profiles' AND column_name = 'has_disability'
  ) THEN
    ALTER TABLE student_profiles ADD COLUMN has_disability boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_profiles' AND column_name = 'is_developing_region'
  ) THEN
    ALTER TABLE student_profiles ADD COLUMN is_developing_region boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_profiles' AND column_name = 'bonus_points'
  ) THEN
    ALTER TABLE student_profiles ADD COLUMN bonus_points numeric(5,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_profiles' AND column_name = 'composite_score'
  ) THEN
    ALTER TABLE student_profiles ADD COLUMN composite_score numeric(6,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- calculate_composite_scores()
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_composite_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE student_profiles
  SET
    bonus_points = (
      CASE WHEN is_female THEN 2 ELSE 0 END +
      CASE WHEN has_disability THEN 5 ELSE 0 END +
      CASE WHEN is_developing_region THEN 3 ELSE 0 END
    ),
    composite_score = (
      (grade_12_score * 0.20) +
      ((first_year_gpa / 4.0) * 50) +
      (entrance_result * 0.30) +
      (
        CASE WHEN is_female THEN 2 ELSE 0 END +
        CASE WHEN has_disability THEN 5 ELSE 0 END +
        CASE WHEN is_developing_region THEN 3 ELSE 0 END
      )
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_composite_scores() TO authenticated;

-- ============================================================
-- run_placement() — use composite_score for ranking
-- ============================================================

CREATE OR REPLACE FUNCTION run_placement()
RETURNS TABLE(
  department_name text,
  assigned_count bigint,
  capacity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  student_record RECORD;
  dept_name text;
  dept_capacity integer;
  dept_filled integer;
  assigned boolean;
BEGIN
  UPDATE student_preferences
  SET status = 'pending',
      placed_department = NULL,
      is_published = false,
      updated_at = now();

  FOR student_record IN
    SELECT sp.user_id, sp.ranked_departments
    FROM student_preferences sp
    JOIN student_profiles sprof ON sprof.user_id = sp.user_id
    ORDER BY sprof.composite_score DESC, sprof.gpa DESC
  LOOP
    assigned := false;

    FOR dept_name IN SELECT jsonb_array_elements_text(student_record.ranked_departments)
    LOOP
      SELECT capacity INTO dept_capacity
      FROM department_capacities
      WHERE department_name = dept_name;

      SELECT count(*) INTO dept_filled
      FROM student_preferences
      WHERE placed_department = dept_name AND status = 'placed';

      IF dept_filled < dept_capacity THEN
        UPDATE student_preferences
        SET status = 'placed',
            placed_department = dept_name,
            updated_at = now()
        WHERE user_id = student_record.user_id;

        assigned := true;
        EXIT;
      END IF;
    END LOOP;

    IF NOT assigned THEN
      UPDATE student_preferences
      SET status = 'rejected',
          placed_department = NULL,
          updated_at = now()
      WHERE user_id = student_record.user_id;
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT dc.department_name,
         COUNT(sp.user_id)::bigint AS assigned_count,
         dc.capacity
  FROM department_capacities dc
  LEFT JOIN student_preferences sp ON sp.placed_department = dc.department_name AND sp.status = 'placed'
  GROUP BY dc.department_name, dc.capacity
  ORDER BY dc.department_name;
END;
$$;

GRANT EXECUTE ON FUNCTION run_placement() TO authenticated;

-- ============================================================
-- get_all_students_with_preferences() — expanded return type
-- ============================================================

CREATE OR REPLACE FUNCTION get_all_students_with_preferences()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  student_id text,
  gpa numeric,
  stream text,
  entrance_result numeric,
  grade_12_score numeric,
  first_year_gpa numeric,
  is_female boolean,
  has_disability boolean,
  is_developing_region boolean,
  bonus_points numeric,
  composite_score numeric,
  ranked_departments jsonb,
  status text,
  placed_department text,
  is_published boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    sp.user_id,
    sprof.full_name,
    sprof.student_id,
    sprof.gpa,
    sprof.stream,
    sprof.entrance_result,
    sprof.grade_12_score,
    sprof.first_year_gpa,
    sprof.is_female,
    sprof.has_disability,
    sprof.is_developing_region,
    sprof.bonus_points,
    sprof.composite_score,
    sp.ranked_departments,
    sp.status,
    sp.placed_department,
    sp.is_published
  FROM student_profiles sprof
  LEFT JOIN student_preferences sp ON sp.user_id = sprof.user_id
  ORDER BY sprof.composite_score DESC, sprof.gpa DESC;
$$;

GRANT EXECUTE ON FUNCTION get_all_students_with_preferences() TO authenticated;