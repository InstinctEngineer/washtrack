-- Create table to track which users have read which messages
CREATE TABLE public.message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.employee_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Enable RLS
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Finance and admin can view all read records
CREATE POLICY "Finance and admin can view message reads"
ON public.message_reads
FOR SELECT
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

-- Finance and admin can insert their own read records
CREATE POLICY "Users can mark messages as read"
ON public.message_reads
FOR INSERT
WITH CHECK (auth.uid() = user_id AND has_role_or_higher(auth.uid(), 'finance'::app_role));

-- Create indexes for efficient lookups
CREATE INDEX idx_message_reads_comment ON public.message_reads(comment_id);
CREATE INDEX idx_message_reads_user ON public.message_reads(user_id);