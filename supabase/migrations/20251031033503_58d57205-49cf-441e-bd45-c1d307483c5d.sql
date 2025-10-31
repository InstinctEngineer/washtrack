-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_date ON audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_date ON audit_log(table_name, changed_at DESC);

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Managers and admins can view audit logs
CREATE POLICY "Managers and admins can view audit logs"
ON audit_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('manager', 'admin', 'super_admin', 'finance')
  )
);

-- Policy: System can insert (triggers use SECURITY DEFINER)
CREATE POLICY "System can insert audit logs"
ON audit_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create trigger function
CREATE OR REPLACE FUNCTION audit_wash_entries()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES ('wash_entries', OLD.id, 'DELETE', to_jsonb(OLD), OLD.employee_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES ('wash_entries', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), NEW.employee_id);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES ('wash_entries', NEW.id, 'INSERT', to_jsonb(NEW), NEW.employee_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to wash_entries
DROP TRIGGER IF EXISTS wash_entries_audit ON wash_entries;
CREATE TRIGGER wash_entries_audit
AFTER INSERT OR UPDATE OR DELETE ON wash_entries
FOR EACH ROW EXECUTE FUNCTION audit_wash_entries();