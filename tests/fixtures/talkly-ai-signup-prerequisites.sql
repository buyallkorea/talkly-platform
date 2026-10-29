-- ISOLATED SIGNUP/AI QA ONLY. Schema metadata snapshot 2026-10-29.
-- No production users, contacts, passwords or keys. Not a full TALKLY schema clone.
-- Client DDL privileges (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) are intentionally omitted.
-- Do not apply on production or on top of the minimal profiles prerequisite.
begin;
set local search_path=public;
create table public."admin_profiles" (
  "user_id" uuid not null,
  "admin_level" text default 'staff'::text not null,
  "department" text,
  "job_title" text,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table public."parent_profiles" (
  "user_id" uuid not null,
  "relationship_note" text,
  "notes" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table public."phone_verifications" (
  "id" uuid default gen_random_uuid() not null,
  "phone" text not null,
  "code_hash" text not null,
  "expires_at" timestamp with time zone not null,
  "verified_at" timestamp with time zone,
  "attempt_count" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "verification_token_hash" text,
  "consumed_at" timestamp with time zone
);
create table public."profiles" (
  "id" uuid not null,
  "role" text default 'student'::text not null,
  "name" text,
  "phone" text,
  "birth_date" date,
  "gender" text,
  "profile_image_url" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table public."student_profiles" (
  "user_id" uuid not null,
  "school_name" text,
  "grade" text,
  "english_level" text,
  "learning_goal" text,
  "parent_name" text,
  "parent_phone" text,
  "notes" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."admin_profiles" add constraint "admin_profiles_admin_level_check" CHECK ((admin_level = ANY (ARRAY['staff'::text, 'manager'::text, 'super_admin'::text])));
alter table public."phone_verifications" add constraint "phone_verifications_attempt_count_check" CHECK ((attempt_count >= 0));
alter table public."profiles" add constraint "profiles_gender_check" CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])));
alter table public."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['student'::text, 'parent'::text, 'teacher'::text, 'admin'::text])));
alter table public."admin_profiles" add constraint "admin_profiles_pkey" PRIMARY KEY (user_id);
alter table public."parent_profiles" add constraint "parent_profiles_pkey" PRIMARY KEY (user_id);
alter table public."phone_verifications" add constraint "phone_verifications_pkey" PRIMARY KEY (id);
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."student_profiles" add constraint "student_profiles_pkey" PRIMARY KEY (user_id);
alter table public."admin_profiles" add constraint "admin_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."parent_profiles" add constraint "parent_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."student_profiles" add constraint "student_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
CREATE INDEX phone_verifications_verified_lookup_idx ON public.phone_verifications USING btree (phone, verified_at DESC) WHERE ((verified_at IS NOT NULL) AND (consumed_at IS NULL));
CREATE INDEX phone_verifications_phone_created_at_idx ON public.phone_verifications USING btree (phone, created_at DESC);
CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user NOT IN ('postgres', 'supabase_auth_admin')
     AND coalesce(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators may change profile roles' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  new_role text;
  new_name text;
  new_phone text;
BEGIN
  -- Only server-controlled app metadata may grant privileged roles.
  new_role := CASE
    WHEN NEW.raw_app_meta_data ->> 'role' IN ('admin', 'teacher')
      THEN NEW.raw_app_meta_data ->> 'role'
    WHEN NEW.raw_user_meta_data ->> 'role' = 'parent' THEN 'parent'
    ELSE 'student'
  END;
  new_name := coalesce(NEW.raw_user_meta_data ->> 'name', '');
  new_phone := nullif(regexp_replace(coalesce(NEW.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g'), '');
  INSERT INTO public.profiles (id, name, role, phone)
  VALUES (NEW.id, new_name, new_role, new_phone)
  ON CONFLICT (id) DO UPDATE SET name = excluded.name, role = excluded.role, phone = excluded.phone;
  IF new_role = 'parent' THEN
    INSERT INTO public.parent_profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  ELSIF new_role = 'student' THEN
    INSERT INTO public.student_profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and is_active = true
  );
$function$;

alter table public."admin_profiles" enable row level security;
revoke all on public."admin_profiles" from public,anon,authenticated,service_role;
alter table public."parent_profiles" enable row level security;
revoke all on public."parent_profiles" from public,anon,authenticated,service_role;
alter table public."phone_verifications" enable row level security;
revoke all on public."phone_verifications" from public,anon,authenticated,service_role;
alter table public."profiles" enable row level security;
revoke all on public."profiles" from public,anon,authenticated,service_role;
alter table public."student_profiles" enable row level security;
revoke all on public."student_profiles" from public,anon,authenticated,service_role;
grant INSERT on public."phone_verifications" to "service_role";
grant SELECT on public."phone_verifications" to "service_role";
grant UPDATE on public."phone_verifications" to "service_role";
grant DELETE on public."phone_verifications" to "service_role";
grant SELECT on public."profiles" to "authenticated";
grant UPDATE on public."profiles" to "authenticated";
grant INSERT on public."profiles" to "service_role";
grant SELECT on public."profiles" to "service_role";
grant UPDATE on public."profiles" to "service_role";
grant DELETE on public."profiles" to "service_role";
grant SELECT on public."student_profiles" to "authenticated";
grant INSERT on public."student_profiles" to "service_role";
grant SELECT on public."student_profiles" to "service_role";
grant UPDATE on public."student_profiles" to "service_role";
grant DELETE on public."student_profiles" to "service_role";
create policy "Admins can view own admin profile" on public."admin_profiles" as PERMISSIVE for SELECT to "authenticated" using ((auth.uid() = user_id));
create policy "Admins can update parent profiles" on public."parent_profiles" as PERMISSIVE for UPDATE to "authenticated" using (is_admin()) with check (is_admin());
create policy "Admins can view all parent profiles" on public."parent_profiles" as PERMISSIVE for SELECT to "authenticated" using (is_admin());
create policy "Parents can update own parent profile" on public."parent_profiles" as PERMISSIVE for UPDATE to "authenticated" using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Parents can view own parent profile" on public."parent_profiles" as PERMISSIVE for SELECT to "authenticated" using ((auth.uid() = user_id));
create policy "Admins can update profiles" on public."profiles" as PERMISSIVE for UPDATE to "authenticated" using (is_admin()) with check (is_admin());
create policy "Admins can view all profiles" on public."profiles" as PERMISSIVE for SELECT to "authenticated" using (is_admin());
create policy "Users can update own profile" on public."profiles" as PERMISSIVE for UPDATE to "authenticated" using ((auth.uid() = id)) with check ((auth.uid() = id));
create policy "Users can view own profile" on public."profiles" as PERMISSIVE for SELECT to "authenticated" using ((auth.uid() = id));
create policy "Admins can update student profiles" on public."student_profiles" as PERMISSIVE for UPDATE to "authenticated" using (is_admin()) with check (is_admin());
create policy "Admins can view all student profiles" on public."student_profiles" as PERMISSIVE for SELECT to "authenticated" using (is_admin());
create policy "Students can update own student profile" on public."student_profiles" as PERMISSIVE for UPDATE to "authenticated" using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Students can view own student profile" on public."student_profiles" as PERMISSIVE for SELECT to "authenticated" using ((auth.uid() = user_id));
revoke all on function public.handle_new_user(),public.guard_profile_role_change() from public,anon,authenticated;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated,service_role;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger protect_profile_role before update of role on public.profiles for each row execute function public.guard_profile_role_change();
commit;

