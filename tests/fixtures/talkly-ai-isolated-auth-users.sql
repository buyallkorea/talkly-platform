-- ISOLATED QA ONLY. Administrative fixtures, not a signup-flow test.
-- Set qa.password within this same transaction using a generated temporary password.
-- Do not save passwords/tokens/service keys in this file or repository.
-- Delete these users after the Auth/PostgREST check; no email/SMS is sent here.
with ids as (select gen_random_uuid() id from generate_series(1,2)),
users as (
 insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
 confirmation_token,recovery_token,email_change_token_new,email_change)
 select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated',
 'qa-'||id::text||'@example.invalid',
 extensions.crypt(current_setting('qa.password'),extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}'::jsonb,
 '{"name":"Synthetic QA","role":"student"}'::jsonb,now(),now(),'','','',''
 from ids returning id,email
), identities as (
 insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at,last_sign_in_at)
 select id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true,'phone_verified',false),
 'email',now(),now(),now() from users returning user_id
), profiles as (
 insert into public.profiles(id,role,name) select id,'student','Synthetic QA' from users returning id
), members as (
 insert into public.ai_members(user_id,consent_version) select id,'2026-10-25-v2-adult19' from users returning user_id
) select id,email from users;
