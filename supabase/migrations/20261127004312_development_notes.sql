create table public.development_notes (
 author text primary key check (author in ('Rafael','Joao')),
 body text not null default '' check (char_length(body) <= 100000)
);
alter table public.development_notes enable row level security;
revoke all on public.development_notes from anon, authenticated;
grant select on public.development_notes to anon, authenticated;
grant update (body) on public.development_notes to anon, authenticated;
create policy "Public shared development notes read" on public.development_notes for select to anon, authenticated using (true);
create policy "Public shared development notes edit" on public.development_notes for update to anon, authenticated using (true) with check (true);
insert into public.development_notes(author) values ('Rafael'),('Joao');