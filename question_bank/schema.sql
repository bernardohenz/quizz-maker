create extension if not exists vector;

create table if not exists question_bank (
  id text primary key,
  subject text,
  grade_min int,
  grade_max int,
  difficulty int,
  skill text,
  skill_tags jsonb not null default '[]'::jsonb,
  theme_policy text,
  stem text,
  options jsonb not null default '[]'::jsonb,
  correct_index int,
  explanation text,
  invariant jsonb not null default '{"preserve":[]}'::jsonb,
  distractors jsonb not null default '[]'::jsonb,
  embedding vector(1536),
  origin text,
  source_label text,
  status text not null,
  created_at timestamptz not null default now()
);
