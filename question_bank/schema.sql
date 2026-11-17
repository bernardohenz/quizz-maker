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

alter table question_bank enable row level security;

drop policy if exists question_bank_app on question_bank;

-- Não há política para anon nem authenticated.
-- A chave pública não lê nem grava esta tabela.
-- O servidor grava com SUPABASE_SECRET_KEY, que não passa por estas regras
-- e não deve ir para o navegador nem para o git.
