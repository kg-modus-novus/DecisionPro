-- Room cube rows + gap registry for public-REAL hydration cutover

CREATE TABLE IF NOT EXISTS bw_cube.cube_room_row (
  row_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  title TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC,
  display_value TEXT NOT NULL DEFAULT '',
  row_kind TEXT NOT NULL CHECK (row_kind IN ('REAL','GAP')),
  dimensions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  from_sys_id TEXT NOT NULL DEFAULT '',
  as_of_date DATE,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (row_id, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS cube_room_row_room_idx
  ON bw_cube.cube_room_row (room_id, load_class);

CREATE TABLE IF NOT EXISTS bw_ctl.gap_object (
  gap_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  need TEXT NOT NULL,
  rooms TEXT[] NOT NULL DEFAULT '{}',
  finding_ids TEXT[] NOT NULL DEFAULT '{}',
  paid_follow_on TEXT NOT NULL DEFAULT '',
  load_history_id TEXT REFERENCES bw_ctl.load_history(load_history_id)
);
