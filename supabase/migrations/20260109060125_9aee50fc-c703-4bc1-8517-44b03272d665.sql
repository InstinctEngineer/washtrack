-- Add recipient_id column to support office-initiated messages
ALTER TABLE employee_comments 
ADD COLUMN recipient_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- Add index for querying messages by recipient
CREATE INDEX idx_employee_comments_recipient_id ON employee_comments(recipient_id);