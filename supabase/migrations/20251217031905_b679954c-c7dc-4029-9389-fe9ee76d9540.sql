-- Create table to track when users last viewed messages
CREATE TABLE public.user_message_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_message_views ENABLE ROW LEVEL SECURITY;

-- Users can view their own record
CREATE POLICY "Users can view their own message view record"
ON public.user_message_views
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own record
CREATE POLICY "Users can insert their own message view record"
ON public.user_message_views
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own record
CREATE POLICY "Users can update their own message view record"
ON public.user_message_views
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for efficient lookups
CREATE INDEX idx_user_message_views_user ON public.user_message_views(user_id);