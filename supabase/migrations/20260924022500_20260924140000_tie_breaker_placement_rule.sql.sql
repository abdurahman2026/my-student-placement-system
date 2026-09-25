/*
# Tie-breaker rule for placement

## Problem
When two or more students have the exact same Total Composite Score,
ties were resolved by GPA only. If GPA was also identical, the order was
undefined (Postgres returns rows in arbitrary order for equal sort keys).

## Fix
Add entrance_result as the third tie-breaker in both:
1. run_placement() — the automated placement algorithm
2. get_all_students_with_preferences() — the admin view query

Tie-breaker order (all DESC):
  1. composite_score  (Total Composite Score — higher gets priority)
  2. gpa              (University GPA — higher gets priority)
  3. entrance_result  (Entrance Exam score — higher gets priority)

## Security
Both functions are SECURITY DEFINER and EXECUTE granted to authenticated.
No changes to grants or security model.
*/

-- 1. run_placement() — add entrance_result as third tie-breaker
CREATE OR REPLACE FUNCTION run_placement()
RETURNS TABLE(department_name text, assigned_count bigint, capacity integer)
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
  -- Reset all previous placements
  UPDATE student_preferences
  SET status = 'pending',
      placed_department = NULL,
      is_published = false,
      updated_at = now();

  -- Process students in ranked order with full tie-breaking:
  --   1. composite_score DESC  (Total Composite Score)
  --   2. gpa DESC              (University GPA)
  --   3. entrance_result DESC   (Entrance Exam score)
  FOR student_record IN
    SELECT sp.user_id, sp.ranked_departments
    FROM student_preferences sp
    JOIN student_profiles sprof ON sprof.user_id = sp.user_id
    ORDER BY
      sprof.composite_score DESC,
      sprof.gpa DESC,
      sprof.entrance_result DESC
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

-- 2. get_all_students_with_preferences() — add entrance_result as third tie-breaker
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
STABLE
SECURITY DEFINER
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
  ORDER BY
    sprof.composite_score DESC,
    sprof.gpa DESC,
    sprof.entrance_result DESC
$$;

-- Preserve grants
GRANT EXECUTE ON FUNCTION run_placement() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_students_with_preferences() TO authenticated;