-- Enable useful extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Example table for the agent's state
create table public.agent_state (
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    key text not null,
    value jsonb not null
);



-- Example table for the source-registry JSON
create table public.source_registry (
    id uuid primary key default gen_random_uuid(),
    curriculum jsonb not null,
    created_at timestamp with time zone default now()
);



-- Enable Row Level Security on agent_state
enable row level security on public.agent_state;
create policy "owner_can_access" on public.agent_state for all using (true);

-- Enable RLS on source_registry (allow service_role)
enable row level security on public.source_registry;
create policy "service_role_access" on public.source_registry for all using (auth.role() = 'service_role');
