-- Allow multiple as_of_date rows per measure within one load history (PI periods / Scorecard vintages).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cube_exec_landing_pkey'
      AND conrelid = 'bw_cube.cube_exec_landing'::regclass
  ) THEN
    ALTER TABLE bw_cube.cube_exec_landing DROP CONSTRAINT cube_exec_landing_pkey;
  END IF;
END $$;

ALTER TABLE bw_cube.cube_exec_landing
  ADD CONSTRAINT cube_exec_landing_pkey
  PRIMARY KEY (measure_id, as_of_date, load_class, load_history_id);
