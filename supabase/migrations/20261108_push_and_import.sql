-- Healthspan: keys in Vault, restricted readers, and the push trigger.
-- Secrets are generated inside Postgres; no key value ever leaves the database except
-- hae_key, which the signed-in owner can read in the app to configure Health Auto Export.

create extension if not exists pg_net with schema extensions;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'hae_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'hae_key', 'Health Auto Export import key');
  end if;
  if not exists (select 1 from vault.secrets where name = 'push_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'push_key', 'push/send key');
  end if;
end $$;

-- service role only: read any secret
create or replace function public.fp_secret(n text) returns text
language sql security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = n limit 1
$$;
revoke all on function public.fp_secret(text) from public, anon, authenticated;
grant execute on function public.fp_secret(text) to service_role;

-- service role only: create or replace a secret (the push function stores its VAPID pair with this)
create or replace function public.fp_set_secret(n text, v text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare sid uuid;
begin
  select id into sid from vault.secrets where name = n limit 1;
  if sid is null then perform vault.create_secret(v, n); else perform vault.update_secret(sid, v); end if;
end $$;
revoke all on function public.fp_set_secret(text, text) from public, anon, authenticated;
grant execute on function public.fp_set_secret(text, text) to service_role;

-- the signed-in owner: read the import key only, to set up Health Auto Export
create or replace function public.fp_owner_secret(n text) returns text
language sql security definer set search_path = public, vault as $$
  select case when auth.uid() is not null and n in ('hae_key')
    then (select decrypted_secret from vault.decrypted_secrets where name = n limit 1) end
$$;
revoke all on function public.fp_owner_secret(text) from public, anon;
grant execute on function public.fp_owner_secret(text) to authenticated;

-- push on: a new notify/{id} row (the coach writes one when something needs the owner),
-- or a request whose status leaves pending (the coach replied)
create or replace function public.fp_notify() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare k text; t text; b text; u text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'push_key' limit 1;
  if k is null then return new; end if;
  if new.coll = 'notify' and tg_op = 'INSERT' then
    t := coalesce(new.data->>'title', 'Healthspan'); b := coalesce(new.data->>'body', ''); u := coalesce(new.data->>'url', './');
  elsif new.coll = 'requests' and tg_op = 'UPDATE'
        and coalesce(old.data->>'status', 'pending') = 'pending' and coalesce(new.data->>'status', 'pending') <> 'pending' then
    t := 'Coach replied'; b := left(coalesce(new.data->>'reply', ''), 200); u := './#you';
  else
    return new;
  end if;
  perform net.http_post(
    url := 'https://jpfvrrdxulcawectrozo.supabase.co/functions/v1/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-key', k),
    body := jsonb_build_object('title', t, 'body', b, 'url', u, 'tag', new.coll || '-' || new.id));
  return new;
end $$;
drop trigger if exists fp_notify_tr on public.docs;
create trigger fp_notify_tr after insert or update on public.docs
  for each row when (new.coll in ('notify', 'requests')) execute function public.fp_notify();
