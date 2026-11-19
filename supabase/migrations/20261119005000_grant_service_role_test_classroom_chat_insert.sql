-- Fix test classroom chat failures after role grants were hardened:
-- [TEST CLASSROOM CHAT INSERT FAILED] code 42501 permission denied.
--
-- The test-student chat API validates the authenticated admin's signed test
-- student session, exact origin, test session status and test enrollment before
-- using the service-role connection to INSERT one message.
-- Restore only the INSERT privilege required by that server-side endpoint.
-- Do NOT grant anon or authenticated extra privileges. Keep RLS/policies intact.
grant insert on table public.classroom_messages to service_role;
