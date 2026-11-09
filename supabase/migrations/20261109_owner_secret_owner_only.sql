-- fp_owner_secret: only the owner (the first account) may read the watch-sync key.
-- Sign-ups are already locked by the lock_signups trigger; this makes the function safe on its own.
create or replace function public.fp_owner_secret(n text) returns text
language sql security definer set search_path = public, vault as $$
  select case when auth.uid() is not null
      and auth.uid() = (select id from auth.users order by created_at limit 1)
      and n in ('hae_key')
    then (select decrypted_secret from vault.decrypted_secrets where name = n limit 1) end
$$;
revoke all on function public.fp_owner_secret(text) from public, anon;
grant execute on function public.fp_owner_secret(text) to authenticated;
