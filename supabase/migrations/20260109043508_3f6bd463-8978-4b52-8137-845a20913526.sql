-- Add columns to employee_comments for linking notes to work submissions
ALTER TABLE employee_comments 
  ADD COLUMN IF NOT EXISTS work_submission_date date,
  ADD COLUMN IF NOT EXISTS work_log_ids uuid[];