-- 编校数据（意象标注、基调、校记与补遗）改挂暂存表：未发布的歌也能标注、录入。规则见 docs/SONGS.md。
--
-- 公开端读这几张表都经正式表把关——单曲页先确认歌已发布，意象云、母题页、寻曲等汇总
-- 按 music_catalog 过滤 song_id——未发布歌的条目不会出现在公开页面上。
-- 读者与发布数据（评论、收藏、用户请求、navid_song）仍挂正式表。

-- 每日同步会删掉暂存表里没有的歌，正式表的歌应当都在暂存表里；万一有例外，停下来人工处理
do $$
declare
  orphans text;
begin
  select string_agg(distinct s.song_id::text, ', ')
    into orphans
  from (
    select song_id from public.imagery_occurrences
    union all
    select song_id from public.song_emotions
    union all
    select song_id from public.song_collations
  ) s
  where not exists (select 1 from public.temp t where t.id = s.song_id);

  if orphans is not null then
    raise exception '这些歌有编校数据，却不在暂存表里：%', orphans;
  end if;
end $$;

alter table public.imagery_occurrences
  drop constraint imagery_occurrences_song_id_fkey,
  add constraint imagery_occurrences_song_id_fkey
    foreign key (song_id) references public.temp (id) on delete cascade;

alter table public.song_emotions
  drop constraint song_emotions_song_id_fkey,
  add constraint song_emotions_song_id_fkey
    foreign key (song_id) references public.temp (id) on delete cascade;

alter table public.song_collations
  drop constraint song_collations_song_id_fkey,
  add constraint song_collations_song_id_fkey
    foreign key (song_id) references public.temp (id) on delete cascade;
