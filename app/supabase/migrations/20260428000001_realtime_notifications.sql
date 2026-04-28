-- Adds public.notifications to the supabase_realtime publication so the bell
-- drawer can subscribe to INSERTs and update without a page refresh.
-- RLS on notifications already restricts SELECT to user_id = auth.uid(),
-- so Realtime won't leak rows across users.

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
