-- 每晚 sync_music_from_temp 会删掉 temp 里已经没有的歌。这三张表引用 music 的外键没写级联，
-- 被删的歌只要有基调标注、校记或收藏，删除就被外键挡住，整次同步回滚，之后每晚都失败。
-- 改成随歌曲一起删除，与 comments、imagery_occurrences、navid_song 一致。
-- song_collation_revisers 已随 song_collations 级联。

alter table public.song_emotions
  drop constraint song_emotions_song_id_fkey,
  add constraint song_emotions_song_id_fkey
    foreign key (song_id) references public.music (id) on delete cascade;

alter table public.song_collations
  drop constraint song_collations_song_id_fkey,
  add constraint song_collations_song_id_fkey
    foreign key (song_id) references public.music (id) on delete cascade;

alter table public.collections
  drop constraint collections_song_id_fkey,
  add constraint collections_song_id_fkey
    foreign key (song_id) references public.music (id) on delete cascade;
