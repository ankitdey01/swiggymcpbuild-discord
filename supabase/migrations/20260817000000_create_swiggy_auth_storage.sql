create table if not exists public.swiggy_auth_tokens (
    discord_user_id text primary key,
    encrypted_token text not null,
    encrypted_key text not null,
    scope text not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.swiggy_oauth_states (
    state text primary key,
    discord_user_id text not null,
    code_verifier text not null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
);

create index if not exists swiggy_oauth_states_expires_at_idx
    on public.swiggy_oauth_states (expires_at);

alter table public.swiggy_auth_tokens enable row level security;
alter table public.swiggy_oauth_states enable row level security;

revoke all on table public.swiggy_auth_tokens from anon, authenticated;
revoke all on table public.swiggy_oauth_states from anon, authenticated;
grant select, insert, update, delete on table public.swiggy_auth_tokens to service_role;
grant select, insert, update, delete on table public.swiggy_oauth_states to service_role;
