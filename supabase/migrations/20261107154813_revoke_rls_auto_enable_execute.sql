-- rls_auto_enable() legt Supabase für die Projektoption "Enable automatic RLS" an.
-- Die Funktion ist SECURITY DEFINER und liegt im öffentlichen Schema, war also per
-- /rest/v1/rpc/rls_auto_enable für jeden aufrufbar (Supabase-Advisor 0028/0029).
-- Der Event-Trigger braucht kein EXECUTE-Recht der API-Rollen.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
