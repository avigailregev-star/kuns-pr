-- Preserve the previous version of every registration before an assignment
-- changes or the row is deleted. This runs in the same transaction as the
-- original write, so a failure to archive prevents the write.
CREATE TABLE IF NOT EXISTS registration_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  registration_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('UPDATE', 'DELETE')),
  previous_data jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registration_history_registration_id_idx
  ON registration_history (registration_id, changed_at DESC);

ALTER TABLE registration_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON registration_history FROM anon, authenticated;
GRANT SELECT, INSERT ON registration_history TO service_role;

CREATE OR REPLACE FUNCTION archive_registration_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO registration_history (registration_id, operation, previous_data)
    VALUES (OLD.id, TG_OP, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  IF (
    OLD.selected_course IS DISTINCT FROM NEW.selected_course OR
    OLD.group_id IS DISTINCT FROM NEW.group_id OR
    OLD.teacher IS DISTINCT FROM NEW.teacher OR
    OLD.assigned_day IS DISTINCT FROM NEW.assigned_day OR
    OLD.assigned_time IS DISTINCT FROM NEW.assigned_time OR
    OLD.assigned_end_time IS DISTINCT FROM NEW.assigned_end_time OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.registration_status IS DISTINCT FROM NEW.registration_status
  ) THEN
    INSERT INTO registration_history (registration_id, operation, previous_data)
    VALUES (OLD.id, TG_OP, to_jsonb(OLD));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registration_history_trigger ON registrations;
CREATE TRIGGER registration_history_trigger
BEFORE UPDATE OR DELETE ON registrations
FOR EACH ROW EXECUTE FUNCTION archive_registration_change();
