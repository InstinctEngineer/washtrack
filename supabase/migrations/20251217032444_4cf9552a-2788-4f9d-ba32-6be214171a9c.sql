-- Create table for message replies
CREATE TABLE public.message_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.employee_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reply_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_replies ENABLE ROW LEVEL SECURITY;

-- Finance and admin can insert replies
CREATE POLICY "Finance and admin can insert replies"
ON public.message_replies
FOR INSERT
WITH CHECK (has_role_or_higher(auth.uid(), 'finance'::app_role));

-- Finance and admin can view all replies
CREATE POLICY "Finance and admin can view all replies"
ON public.message_replies
FOR SELECT
USING (has_role_or_higher(auth.uid(), 'finance'::app_role));

-- Employees can view replies on their own comments
CREATE POLICY "Employees can view replies to their comments"
ON public.message_replies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employee_comments ec
    WHERE ec.id = comment_id AND ec.employee_id = auth.uid()
  )
);

-- Create indexes
CREATE INDEX idx_message_replies_comment ON public.message_replies(comment_id);
CREATE INDEX idx_message_replies_user ON public.message_replies(user_id);

-- Enable realtime for replies
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_replies;