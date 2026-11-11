-- 2026-11-11 law-and-policy layer (additive only).
-- Plan: docs/planning/law-and-policy-layer-codexen-plan.md
-- 1. dso_policy_event: one dated public policy event (a law, rule, billing-code
--    or reporting change, or an enforcement act) with its source link, document
--    date and quote. standing is 'suggested' until a person confirms the event;
--    only confirmed events may change a rating (Director decision 2026-11-11).
--    A temporary event carries an end date, stated by its own document or taken
--    from the event that ends it (ended_by_event_id); a permanent one has none.
--    scope_basis says whether the document names the codes or the codes stand in
--    for a service family it names; a stand-in carries a note.
--    state_code is a state or 'US' for a national event.
-- 2. dso_policy_search: for each state, which source was searched for which
--    topic and through what day, so "none found" is never said of a state
--    nobody searched.
-- Both are replaced whole per source (from_sys_id) under one load history.
-- The database performs no business writes: no triggers, no cascades. The
-- constraints below only refuse, and restate rules PolicyEventOwner keeps.

CREATE TABLE IF NOT EXISTS bw_dso.dso_policy_event (
  event_id TEXT NOT NULL CHECK (event_id ~ '^[a-z0-9][a-z0-9-]*$'),
  state_code TEXT NOT NULL CHECK (state_code ~ '^[A-Z]{2}$'),
  kind TEXT NOT NULL CHECK (kind IN ('coverage','rate','authorization-or-limit','eligibility','code-change','reporting-change','funding','enforcement','governance','external-flag')),
  direction TEXT NOT NULL CHECK (direction IN ('expands','restricts','unstated')),
  summary TEXT NOT NULL CHECK (summary <> ''),
  effective_date DATE NOT NULL,
  effective_precision TEXT NOT NULL CHECK (effective_precision IN ('day','month','year')),
  end_date DATE,
  end_precision TEXT NOT NULL CHECK (end_precision IN ('','day','month','year')),
  ended_by_event_id TEXT NOT NULL,
  scope_hcpcs TEXT[] NOT NULL,
  scope_hcpcs_prefixes TEXT[] NOT NULL,
  scope_all_services BOOLEAN NOT NULL,
  scope_basis TEXT NOT NULL CHECK (scope_basis IN ('named-in-document','stands-in-for-service-family')),
  scope_note TEXT NOT NULL,
  source_publisher TEXT NOT NULL CHECK (source_publisher <> ''),
  source_title TEXT NOT NULL CHECK (source_title <> ''),
  source_url TEXT NOT NULL CHECK (source_url ~ '^https?://'),
  source_document_date DATE NOT NULL,
  source_document_precision TEXT NOT NULL CHECK (source_document_precision IN ('day','month','year')),
  source_quote TEXT NOT NULL CHECK (source_quote <> ''),
  standing TEXT NOT NULL CHECK (standing IN ('suggested','confirmed')),
  confirmed_by TEXT NOT NULL,
  confirmed_on DATE,
  source_file TEXT NOT NULL,
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (event_id, load_class, load_history_id),
  CONSTRAINT dso_policy_event_end_after_start_ck CHECK (end_date IS NULL OR end_date >= effective_date),
  CONSTRAINT dso_policy_event_end_precision_ck CHECK ((end_date IS NULL) = (end_precision = '')),
  CONSTRAINT dso_policy_event_ended_by_ck CHECK (ended_by_event_id = '' OR (end_date IS NOT NULL AND ended_by_event_id <> event_id)),
  CONSTRAINT dso_policy_event_confirmation_ck CHECK (
    (standing = 'confirmed' AND confirmed_by <> '' AND confirmed_on IS NOT NULL)
    OR (standing = 'suggested' AND confirmed_by = '' AND confirmed_on IS NULL)),
  CONSTRAINT dso_policy_event_confirmed_after_document_ck CHECK (confirmed_on IS NULL OR confirmed_on >= source_document_date),
  CONSTRAINT dso_policy_event_scope_ck CHECK (
    (scope_all_services AND cardinality(scope_hcpcs) = 0 AND cardinality(scope_hcpcs_prefixes) = 0)
    OR (NOT scope_all_services AND cardinality(scope_hcpcs) + cardinality(scope_hcpcs_prefixes) > 0)),
  CONSTRAINT dso_policy_event_scope_note_ck CHECK (scope_basis <> 'stands-in-for-service-family' OR scope_note <> '')
);

CREATE INDEX IF NOT EXISTS dso_policy_event_state_idx
  ON bw_dso.dso_policy_event (state_code, effective_date, load_class);

CREATE TABLE IF NOT EXISTS bw_dso.dso_policy_search (
  state_code TEXT NOT NULL CHECK (state_code ~ '^[A-Z]{2}$'),
  source_name TEXT NOT NULL CHECK (source_name <> ''),
  source_url TEXT NOT NULL CHECK (source_url ~ '^https?://'),
  topic TEXT NOT NULL CHECK (topic <> ''),
  searched_through DATE NOT NULL,
  completeness TEXT NOT NULL CHECK (completeness IN ('partial','full')),
  source_file TEXT NOT NULL,
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (state_code, source_name, topic, load_class, load_history_id)
);
