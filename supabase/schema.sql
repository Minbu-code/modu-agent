create table if not exists public.users_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  organization text,
  role text default '담당교사',
  preferred_provider text,
  preferred_model text,
  response_style text default '중립적이고 공적인 문체',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_number text not null,
  occurrence_datetime timestamptz,
  occurrence_location text not null,
  school_level text,
  case_type text,
  anonymous_title text not null,
  anonymous_summary text not null,
  current_stage text not null default '접수',
  progress_rate integer not null default 0 check (progress_rate between 0 and 100),
  status text not null default '진행 중' check (status in ('진행 중', '검토 대기', '종결')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null,
  task_title text not null,
  task_description text,
  due_date timestamptz,
  status text not null default '대기' check (status in ('대기', '완료')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  title text not null,
  content text not null,
  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  action_summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists cases_user_id_idx on public.cases(user_id);
create index if not exists case_tasks_case_id_idx on public.case_tasks(case_id);

alter table public.users_profile enable row level security;
alter table public.cases enable row level security;
alter table public.case_tasks enable row level security;
alter table public.generated_documents enable row level security;
alter table public.activity_logs enable row level security;

create policy "users manage own profile" on public.users_profile for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own cases" on public.cases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own tasks" on public.case_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own documents" on public.generated_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own activity" on public.activity_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
