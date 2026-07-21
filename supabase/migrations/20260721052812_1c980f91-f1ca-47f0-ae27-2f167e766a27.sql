DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email ILIKE 'employee@test.com';
  IF uid IS NULL THEN RETURN; END IF;

  UPDATE public.audit_log SET changed_by = NULL WHERE changed_by = uid;
  UPDATE public.system_settings SET updated_by = NULL WHERE updated_by = uid;
  UPDATE public.system_settings_audit SET changed_by = NULL WHERE changed_by = uid;
  UPDATE public.users SET manager_id = NULL WHERE manager_id = uid;

  DELETE FROM public.work_logs WHERE employee_id = uid;
  DELETE FROM public.user_roles WHERE user_id = uid;
  DELETE FROM public.user_locations WHERE user_id = uid;
  DELETE FROM public.message_reads WHERE user_id = uid;
  DELETE FROM public.message_replies WHERE user_id = uid;
  DELETE FROM public.user_message_views WHERE user_id = uid;
  DELETE FROM public.error_report_replies WHERE user_id = uid;
  DELETE FROM public.error_reports WHERE reported_by = uid;
  DELETE FROM public.activity_logs WHERE user_id = uid;
  DELETE FROM public.employee_comments WHERE employee_id = uid OR recipient_id = uid;

  DELETE FROM public.users WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
END $$;