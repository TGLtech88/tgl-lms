-- Run these queries in your Supabase SQL Editor to set up the database

-- Profiles (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users primary key,
  full_name text,
  email text unique,
  role text check (role in ('super_admin', 'staff', 'student')),
  created_at timestamptz default now()
);

-- Batches
create table batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  start_date date,
  end_date date,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table batches enable row level security;
create policy "Allow admins to create batches" on batches for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);
create policy "Allow all authenticated users to read batches" on batches for select to authenticated using (true);
create policy "Allow admins to update batches" on batches for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);
create policy "Allow admins to delete batches" on batches for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);

-- Batch Students (enrollment)
create table batch_students (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  enrolled_at timestamptz default now(),
  unique(batch_id, student_id)
);

alter table batch_students enable row level security;
create policy "Allow admins to manage batch students" on batch_students for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin', 'admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin', 'admin'))
);
create policy "Allow students to view their own enrollments" on batch_students for select to authenticated using (
  auth.uid() = student_id
);

-- Content Posts (per batch, scheduled)
create table content_posts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches(id) on delete cascade,
  title text not null,
  description text,
  release_date date not null,
  is_published boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table content_posts enable row level security;
create policy "Allow admins to create content" on content_posts for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);
create policy "Allow all authenticated to read content" on content_posts for select to authenticated using (true);
create policy "Allow admins to update content" on content_posts for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);
create policy "Allow admins to delete content" on content_posts for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);

-- Content Files (attachments per post)
create table content_files (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references content_posts(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text, -- 'pdf', 'ppt', 'assignment', 'other'
  uploaded_at timestamptz default now()
);

alter table content_files enable row level security;
create policy "Allow admins to manage content files" on content_files for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);
create policy "Allow students to view content files" on content_files for select to authenticated using (true);

-- Attendance Sessions (one per content post day)
create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references content_posts(id) on delete cascade,
  batch_id uuid references batches(id) on delete cascade,
  session_date date not null,
  attendance_code text not null,
  code_expires_at timestamptz not null, -- 1 minute window
  is_open boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table attendance_sessions enable row level security;
create policy "Allow admins to create sessions" on attendance_sessions for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);
create policy "Allow all authenticated to read sessions" on attendance_sessions for select to authenticated using (true);
create policy "Allow admins to update sessions" on attendance_sessions for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);
create policy "Allow admins to delete sessions" on attendance_sessions for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);

-- Attendance Records
create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references attendance_sessions(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  marked_at timestamptz default now(),
  is_approved boolean default false,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  unique(session_id, student_id)
);

alter table attendance_records enable row level security;
create policy "Allow students to insert own records" on attendance_records for insert with check (
  auth.uid() = student_id
);
create policy "Allow all authenticated to read records" on attendance_records for select to authenticated using (true);
create policy "Allow admins to update records" on attendance_records for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);
create policy "Allow admins to delete records" on attendance_records for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);

-- RLS should be enabled on all tables
-- Below is a basic example of RLS for profiles.
alter table profiles enable row level security;
create policy "Public readable profiles" on profiles for select using (true);
create policy "Allow admins to insert profiles" on profiles for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('staff', 'super_admin'))
);
create policy "Allow admins to update profiles" on profiles for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('staff', 'super_admin'))
);
create policy "Allow admins to delete profiles" on profiles for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('staff', 'super_admin'))
);

-- Trigger to automatically create a profile for new users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, coalesce(new.raw_user_meta_data->>'role', 'student'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Content Progress (tracking Student Progress)
create table content_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  post_id uuid references content_posts(id) on delete cascade,
  completed_at timestamptz default now(),
  unique(student_id, post_id)
);

alter table content_progress enable row level security;
create policy "Allow students to read own progress" on content_progress for select to authenticated using (auth.uid() = student_id);
create policy "Allow admins to read all progress" on content_progress for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);
create policy "Allow students to insert own progress" on content_progress for insert with check (auth.uid() = student_id);
create policy "Allow students to delete own progress" on content_progress for delete using (auth.uid() = student_id);

-- Project Reports 
create table project_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade not null,
  batch_id uuid references batches(id) on delete set null,
  title text default '',
  acknowledgement text default '',
  description text default '',
  objectives text default '',
  components_used text default '',
  methodology text default '',
  observations text default '',
  results text default '',
  conclusion text default '',
  future_scope text default '',
  references text default '',
  status text default 'Draft',
  admin_feedback text default '',
  updated_at timestamptz default now(),
  unique(student_id)
);

alter table project_reports enable row level security;
create policy "Allow students to read own reports" on project_reports for select to authenticated using (auth.uid() = student_id);
create policy "Allow students to insert own reports" on project_reports for insert with check (auth.uid() = student_id);
create policy "Allow students to update own reports" on project_reports for update using (auth.uid() = student_id);
create policy "Allow admins to read all reports" on project_reports for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);
create policy "Allow admins to update reports" on project_reports for update to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);


-- Certificate Settings
create table certificate_settings (
  id uuid primary key default gen_random_uuid(),
  template_url text,
  issuer_name text default 'Internship Program',
  issuer_title text default 'Director',
  issuer_signature_url text,
  updated_at timestamptz default now()
);

alter table certificate_settings enable row level security;
create policy "Allow all authenticated to read certificate settings" on certificate_settings for select to authenticated using (true);
create policy "Allow admins to manage certificate settings" on certificate_settings for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);

-- Daily Journals
create table daily_journals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade not null,
  batch_id uuid references batches(id) on delete set null,
  date date not null default current_date,
  activities_performed text not null default '',
  learning_outcome text not null default '',
  challenges_faced text not null default '',
  image_urls text[] default array[]::text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table daily_journals enable row level security;
create policy "Allow students to read own journals" on daily_journals for select to authenticated using (auth.uid() = student_id);
create policy "Allow students to insert own journals" on daily_journals for insert with check (auth.uid() = student_id);
create policy "Allow students to update own journals" on daily_journals for update using (auth.uid() = student_id);
create policy "Allow students to delete own journals" on daily_journals for delete using (auth.uid() = student_id);
create policy "Allow admins to read all journals" on daily_journals for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);



-- RPC function to completely delete a user and their profile
create or replace function delete_user(user_id uuid)
returns void as $$
begin
  -- Ensure only staff or super_admin can execute this
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('staff', 'super_admin')) then
    raise exception 'Unauthorized';
  end if;

  -- Delete from dependent tables first to handle missing cascade constraints
  delete from public.batch_students where student_id = user_id;
  delete from public.attendance_records where student_id = user_id;
  
  -- Delete the profile
  delete from public.profiles where id = user_id;

  -- Delete the auth user (completely revokes access)
  delete from auth.users where id = user_id;
end;
$$ language plpgsql security definer;



-- Announcements
create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  type text not null check (type in ('notice', 'update', 'assignment', 'deadline')),
  batch_id uuid references batches(id) on delete cascade, -- null means global
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table announcements enable row level security;
create policy "Allow admins to manage announcements" on announcements for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'super_admin'))
);
create policy "Allow students to read relevant announcements" on announcements for select to authenticated using (
  batch_id is null or 
  exists (select 1 from batch_students bs where bs.student_id = auth.uid() and bs.batch_id = announcements.batch_id)
);



