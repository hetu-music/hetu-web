


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."assert_role"("allowed" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
begin
  if not (public.jwt_role() = any (allowed)) then
    raise exception '没有权限' using errcode = '42501';
  end if;
end;
$$;


ALTER FUNCTION "public"."assert_role"("allowed" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_stream_grant"("p_user_id" "uuid", "p_song_id" bigint, "p_hour_limit" integer, "p_day_limit" integer) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (
    select 1 from stream_grants
    where user_id = p_user_id and song_id = p_song_id
      and issued_at > now() - interval '1 hour'
  ) and (
    select count(distinct song_id) from stream_grants
    where user_id = p_user_id and issued_at > now() - interval '1 hour'
  ) >= p_hour_limit then
    return 'hour';
  end if;

  if not exists (
    select 1 from stream_grants
    where user_id = p_user_id and song_id = p_song_id
      and issued_at > now() - interval '1 day'
  ) and (
    select count(distinct song_id) from stream_grants
    where user_id = p_user_id and issued_at > now() - interval '1 day'
  ) >= p_day_limit then
    return 'day';
  end if;

  insert into stream_grants (user_id, song_id) values (p_user_id, p_song_id);

  delete from stream_grants
  where user_id = p_user_id and issued_at < now() - interval '7 days';

  return 'ok';
end;
$$;


ALTER FUNCTION "public"."claim_stream_grant"("p_user_id" "uuid", "p_song_id" bigint, "p_hour_limit" integer, "p_day_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comment_likes_sync_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.comments
      set like_count = like_count + 1
      where id = new.comment_id;
  else
    update public.comments
      set like_count = greatest(like_count - 1, 0)
      where id = old.comment_id;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."comment_likes_sync_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comments_check_reply"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  p public.comments;
begin
  if new.parent_id is null then
    return new;
  end if;
  select * into p from public.comments where id = new.parent_id;
  if not found
     or p.parent_id is not null
     or p.song_id <> new.song_id
     or p.visibility <> 'public'
     or p.status <> 'normal' then
    raise exception 'invalid parent comment' using errcode = '23514';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."comments_check_reply"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_song"("p_fields" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  f public.song_versions;
  sid bigint;
  vid bigint;
begin
  perform public.assert_role(array['bot', 'admin', 'super']);
  f := jsonb_populate_record(null::public.song_versions, p_fields);

  insert into public.songs (created_by) values (auth.uid()) returning id into sid;
  insert into public.song_versions (
    song_id, title, date, album, track, tracktotal, discnumber, disctotal,
    artist, lyricist, composer, arranger, albumartist, genre, type, length,
    lyrics, lyrics_start, comment, dispute_note, hascover, nmn_status,
    created_by, updated_by
  ) values (
    -- 没给的列用表上的默认值；明确给了 null 的照存 null（与原先往 temp 里 insert 一致）
    sid, f.title, f.date, f.album,
    case when p_fields ? 'track' then f.track else 1 end,
    case when p_fields ? 'tracktotal' then f.tracktotal else 1 end,
    case when p_fields ? 'discnumber' then f.discnumber else 1 end,
    case when p_fields ? 'disctotal' then f.disctotal else 1 end,
    f.artist, f.lyricist, f.composer, f.arranger, f.albumartist,
    case when p_fields ? 'genre' then f.genre else '{古风}'::text[] end,
    coalesce(f.type, '{原创}'::text[]),
    f.length, f.lyrics, f.lyrics_start, f.comment, f.dispute_note, f.hascover,
    case when p_fields ? 'nmn_status' then f.nmn_status else false end,
    auth.uid(), auth.uid()
  ) returning id into vid;

  perform public.log_song_event('CREATE', sid, vid);
  return sid;
end;
$$;


ALTER FUNCTION "public"."create_song"("p_fields" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."credit_aliases_no_chain"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if exists (select 1 from public.credit_aliases where alias = new.name) then
    raise exception '主名「%」本身已登记为别名', new.name;
  end if;
  if exists (select 1 from public.credit_aliases where name = new.alias) then
    raise exception '「%」已是其他别名的主名，不能再登记为别名', new.alias;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."credit_aliases_no_chain"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_comment"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  c public.comments;
begin
  select * into c from public.comments
    where id = p_id and user_id = auth.uid() and status <> 'deleted';
  if not found then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.comments where parent_id = p_id) then
    update public.comments
      set status = 'deleted', body = '', edited_at = now()
      where id = p_id;
  else
    delete from public.comments where id = p_id;
    if c.parent_id is not null then
      delete from public.comments p
        where p.id = c.parent_id
          and p.status = 'deleted'
          and not exists (
            select 1 from public.comments r where r.parent_id = p.id
          );
    end if;
  end if;
end;
$$;


ALTER FUNCTION "public"."delete_comment"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_song"("p_song_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  live bigint;
begin
  perform public.assert_role(array['super']);

  select live_version_id into live from public.songs where id = p_song_id for update;
  if not found then
    raise exception '歌曲不存在' using errcode = 'P0002';
  end if;
  if live is not null then
    raise exception '在线的歌要先下架再删除' using errcode = 'P0001';
  end if;
  perform public.log_song_event('DELETE', p_song_id, null);
  delete from public.songs where id = p_song_id;
end;
$$;


ALTER FUNCTION "public"."delete_song"("p_song_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."discard_draft"("p_song_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  draft bigint;
begin
  perform public.assert_role(array['admin', 'super']);
  perform 1 from public.songs where id = p_song_id for update;

  select id into draft
  from public.song_versions
  where song_id = p_song_id and published_at is null;
  if draft is null then
    raise exception '没有草稿' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.song_versions
    where song_id = p_song_id and published_at is not null
  ) then
    raise exception '这首歌从没发布过，不能放弃草稿，要删就删歌' using errcode = 'P0001';
  end if;

  delete from public.song_versions where id = draft;
  perform public.log_song_event('DISCARD_DRAFT', p_song_id, draft);
end;
$$;


ALTER FUNCTION "public"."discard_draft"("p_song_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."edit_comment"("p_id" bigint, "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.comments
    set body = p_body, edited_at = now()
    where id = p_id and user_id = auth.uid() and status in ('normal', 'pending');
  if not found then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
end;
$$;


ALTER FUNCTION "public"."edit_comment"("p_id" bigint, "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."editorial_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  vid bigint;
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then
      return old;
    end if;
    vid := old.version_id;
  else
    if tg_op = 'UPDATE' and new.version_id is distinct from old.version_id then
      raise exception '编校数据不能换版本' using errcode = '42501';
    end if;
    vid := new.version_id;
  end if;

  if exists (
    select 1 from public.song_versions v
    where v.id = vid and v.published_at is not null
  ) then
    raise exception '已发布的版本不能修改，先开草稿' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."editorial_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_draft"("p_song_id" bigint) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  draft bigint;
  src bigint;
begin
  perform public.assert_role(array['bot', 'admin', 'super']);

  -- 锁住这首歌，两个请求同时开草稿时只开一份
  perform 1 from public.songs where id = p_song_id for update;
  if not found then
    raise exception '歌曲不存在' using errcode = 'P0002';
  end if;

  select id into draft
  from public.song_versions
  where song_id = p_song_id and published_at is null;
  if found then
    return draft;
  end if;

  select id into src
  from public.song_versions
  where song_id = p_song_id
  order by published_at desc
  limit 1;
  if src is null then
    raise exception '这首歌没有任何版本' using errcode = 'P0002';
  end if;

  perform set_config('hetu.copying', 'on', true);

  insert into public.song_versions (
    song_id, title, date, album, track, tracktotal, discnumber, disctotal,
    artist, lyricist, composer, arranger, albumartist, genre, type, length,
    lyrics, lyrics_start, comment, dispute_note, hascover, nmn_status,
    created_by, updated_at, updated_by
  )
  select
    song_id, title, date, album, track, tracktotal, discnumber, disctotal,
    artist, lyricist, composer, arranger, albumartist, genre, type, length,
    lyrics, lyrics_start, comment, dispute_note, hascover, nmn_status,
    auth.uid(), updated_at, updated_by     -- 沿用源版本的 updated_at：打开着的表单不会误报冲突
  from public.song_versions
  where id = src
  returning id into draft;

  insert into public.song_imagery (version_id, id, imagery_id, motif_id, created_at, created_by)
  select draft, id, imagery_id, motif_id, created_at, created_by
  from public.song_imagery where version_id = src;

  insert into public.song_emotions (version_id, emotion_id, rank, created_at, created_by)
  select draft, emotion_id, rank, created_at, created_by
  from public.song_emotions where version_id = src;

  insert into public.song_collations (
    version_id, id, anchor, anchor_index, anchor_time, anchor_quote, kind, quote,
    sung, body, date, created_by, updated_by, created_at, updated_at
  )
  select
    draft, id, anchor, anchor_index, anchor_time, anchor_quote, kind, quote,
    sung, body, date, created_by, updated_by, created_at, updated_at
  from public.song_collations where version_id = src;

  insert into public.song_collation_revisers (version_id, collation_id, user_id, first_at)
  select draft, collation_id, user_id, first_at
  from public.song_collation_revisers where version_id = src;

  perform set_config('hetu.copying', 'off', true);
  return draft;
end;
$$;


ALTER FUNCTION "public"."ensure_draft"("p_song_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- 只同步 id，其他字段使用表里的默认值
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;      -- 防止万一重复插入导致错误

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."imagery_occurrence_counts"() RETURNS TABLE("song_id" bigint, "n" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select i.song_id, count(*)::bigint
  from public.working_song_imagery i
  group by i.song_id
$$;


ALTER FUNCTION "public"."imagery_occurrence_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."jwt_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', 'user')
$$;


ALTER FUNCTION "public"."jwt_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_song_event"("p_action" "text", "p_song_id" bigint, "p_version_id" bigint) RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  insert into public.audit_logs (table_name, action_type, user_id, new_data)
  values ('songs', p_action, auth.uid(),
          jsonb_build_object('song_id', p_song_id, 'version_id', p_version_id))
$$;


ALTER FUNCTION "public"."log_song_event"("p_action" "text", "p_song_id" bigint, "p_version_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_song"("p_song_id" bigint) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  draft bigint;
  latest bigint;
  live bigint;
begin
  perform public.assert_role(array['admin', 'super']);

  select live_version_id into live from public.songs where id = p_song_id for update;
  if not found then
    raise exception '歌曲不存在' using errcode = 'P0002';
  end if;

  select id into draft
  from public.song_versions
  where song_id = p_song_id and published_at is null;

  if draft is not null then
    update public.song_versions set published_at = now() where id = draft;
    update public.songs set live_version_id = draft where id = p_song_id;
    perform public.log_song_event('PUBLISH', p_song_id, draft);
    return draft;
  end if;

  if live is null then
    select id into latest
    from public.song_versions
    where song_id = p_song_id
    order by published_at desc
    limit 1;
    update public.songs set live_version_id = latest where id = p_song_id;
    perform public.log_song_event('REPUBLISH', p_song_id, latest);
    return latest;
  end if;

  raise exception '没有要发布的改动' using errcode = 'P0001';
end;
$$;


ALTER FUNCTION "public"."publish_song"("p_song_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."quiz_results_keep_latest"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  perform pg_advisory_xact_lock(hashtext('quiz_results'), hashtext(new.user_id::text));
  delete from public.quiz_results
   where user_id = new.user_id
     and id not in (
       select id
         from public.quiz_results
        where user_id = new.user_id
        order by created_at desc, id desc
        limit 5
     );
  return null;
end
$$;


ALTER FUNCTION "public"."quiz_results_keep_latest"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."random_quiz_result_id"() RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select string_agg(
           substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
                  get_byte(r.b, i.pos) % 62 + 1, 1),
           '' order by i.n)
    from (select uuid_send(gen_random_uuid()) as b) r,
         unnest(array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11]) with ordinality as i (pos, n)
$$;


ALTER FUNCTION "public"."random_quiz_result_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."random_user_name"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  candidate text;
begin
  loop
    candidate := '用户' || substr(md5(gen_random_uuid()::text), 1, 8);
    exit when not exists (
      select 1 from public.users where lower(btrim(name)) = candidate
    );
  end loop;
  return candidate;
end;
$$;


ALTER FUNCTION "public"."random_user_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_audit_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  row_data jsonb;
begin
  if current_setting('hetu.copying', true) = 'on' then
    return null;
  end if;
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
    if (row_data ? 'version_id' and not exists (
          select 1 from public.song_versions where id = (row_data ->> 'version_id')::bigint))
       or (tg_table_name = 'song_links' and not exists (
          select 1 from public.songs where id = (row_data ->> 'song_id')::bigint)) then
      return null;
    end if;
  end if;
  if tg_op = 'DELETE' then
    insert into public.audit_logs (table_name, action_type, user_id, old_data)
    values (tg_table_name::text, tg_op, auth.uid(), to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (table_name, action_type, user_id, old_data, new_data)
    values (tg_table_name::text, tg_op, auth.uid(), to_jsonb(old), to_jsonb(new));
  else
    insert into public.audit_logs (table_name, action_type, user_id, new_data)
    values (tg_table_name::text, tg_op, auth.uid(), to_jsonb(new));
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."record_audit_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."song_collations_record_reviser"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is not null and auth.uid() is distinct from new.created_by then
    insert into public.song_collation_revisers (version_id, collation_id, user_id)
    values (new.version_id, new.id, auth.uid())
    on conflict do nothing;
  end if;
  return null;
end $$;


ALTER FUNCTION "public"."song_collations_record_reviser"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."song_collations_stamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if current_setting('hetu.copying', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := null;
  elsif auth.uid() is not null then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."song_collations_stamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."song_versions_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.published_at is not null and pg_trigger_depth() = 1 then
      raise exception '已发布的版本不能删除' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.published_at is not null then
    raise exception '已发布的版本不能修改，先开草稿' using errcode = '42501';
  end if;
  if new.song_id is distinct from old.song_id then
    raise exception '版本不能换歌' using errcode = '42501';
  end if;
  if new.published_at is distinct from old.published_at then
    return new;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;


ALTER FUNCTION "public"."song_versions_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_claims_to_auth"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update auth.users
  set raw_app_meta_data = (coalesce(raw_app_meta_data, '{}'::jsonb) - 'is_admin' - 'is_super')
    || jsonb_build_object('role', new.role)
  where id = new.id;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_user_claims_to_auth"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unpublish_song"("p_song_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  live bigint;
begin
  perform public.assert_role(array['super']);

  select live_version_id into live from public.songs where id = p_song_id for update;
  if live is null then
    raise exception '这首歌不在线上' using errcode = 'P0001';
  end if;
  update public.songs set live_version_id = null where id = p_song_id;
  perform public.log_song_event('UNPUBLISH', p_song_id, live);
end;
$$;


ALTER FUNCTION "public"."unpublish_song"("p_song_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."users_guard_can_stream"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.can_stream then
      raise exception 'can_stream 只能由管理员开启';
    end if;
  elsif new.can_stream is distinct from old.can_stream then
    raise exception 'can_stream 只能由管理员修改';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."users_guard_can_stream"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."users_guard_role"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if current_user in ('anon', 'authenticated')
     and new.role is distinct from old.role then
    raise exception '角色只能由超级管理员修改' using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."users_guard_role"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "user_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."song_audio" (
    "song_id" bigint NOT NULL,
    "navid_id" "text" NOT NULL,
    "suffix" "text",
    "duration" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."song_audio" OWNER TO "postgres";


COMMENT ON TABLE "public"."song_audio" IS 'Navidrome 上的音频（原 navid_song）。has_audio 由视图按有没有这一行算出';



CREATE TABLE IF NOT EXISTS "public"."song_links" (
    "song_id" bigint NOT NULL,
    "platform" "text" NOT NULL,
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "song_links_platform_check" CHECK (("platform" = ANY (ARRAY['netease'::"text", 'qq'::"text", 'kugou'::"text"]))),
    CONSTRAINT "song_links_url_check" CHECK (("url" <> ''::"text"))
);


ALTER TABLE "public"."song_links" OWNER TO "postgres";


COMMENT ON TABLE "public"."song_links" IS '各平台上的这首歌。挂在歌上，不随版本，保存即生效';



CREATE TABLE IF NOT EXISTS "public"."song_versions" (
    "id" bigint NOT NULL,
    "song_id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "date" "date",
    "album" "text",
    "track" bigint DEFAULT 1,
    "tracktotal" bigint DEFAULT 1,
    "discnumber" bigint DEFAULT 1,
    "disctotal" bigint DEFAULT 1,
    "artist" "text"[],
    "lyricist" "text"[],
    "composer" "text"[],
    "arranger" "text"[],
    "albumartist" "text"[],
    "genre" "text"[] DEFAULT '{古风}'::"text"[],
    "type" "text"[] DEFAULT '{原创}'::"text"[] NOT NULL,
    "length" bigint,
    "lyrics" "text",
    "lyrics_start" "text",
    "comment" "text",
    "dispute_note" "text",
    "hascover" boolean,
    "nmn_status" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."song_versions" OWNER TO "postgres";


COMMENT ON TABLE "public"."song_versions" IS '歌的资料，一个版本一行。published_at 为空是草稿（每首歌至多一个，保存即覆盖），非空是已冻结的版本，历史全部保留';



CREATE TABLE IF NOT EXISTS "public"."songs" (
    "id" bigint NOT NULL,
    "live_version_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."songs" OWNER TO "postgres";


COMMENT ON TABLE "public"."songs" IS '歌的身份。live_version_id 指向线上版本，为空表示不在线上（从未发布或已下架）。读者数据、链接、音频挂在这里';



CREATE OR REPLACE VIEW "public"."published_songs" WITH ("security_invoker"='true') AS
 SELECT "s"."id",
    "v"."date",
    "v"."title",
    "v"."track",
    "v"."tracktotal",
    "v"."artist",
    "v"."lyricist",
    "v"."composer",
    "v"."arranger",
    "v"."lyrics",
    "v"."genre",
    "v"."album",
    "v"."albumartist",
    "v"."comment",
    "v"."length",
    "v"."discnumber",
    "v"."disctotal",
    ( SELECT "l"."url"
           FROM "public"."song_links" "l"
          WHERE (("l"."song_id" = "s"."id") AND ("l"."platform" = 'kugou'::"text"))) AS "kugolink",
    "v"."type",
    "v"."hascover",
    ( SELECT "l"."url"
           FROM "public"."song_links" "l"
          WHERE (("l"."song_id" = "s"."id") AND ("l"."platform" = 'qq'::"text"))) AS "qmlink",
    ( SELECT "l"."url"
           FROM "public"."song_links" "l"
          WHERE (("l"."song_id" = "s"."id") AND ("l"."platform" = 'netease'::"text"))) AS "nelink",
    "v"."nmn_status",
    (EXISTS ( SELECT 1
           FROM "public"."song_audio" "a"
          WHERE ("a"."song_id" = "s"."id"))) AS "has_audio",
    "v"."published_at" AS "updated_at",
    "v"."lyrics_start",
    "v"."dispute_note",
    "v"."id" AS "version_id"
   FROM ("public"."songs" "s"
     JOIN "public"."song_versions" "v" ON (("v"."id" = "s"."live_version_id")));


ALTER VIEW "public"."published_songs" OWNER TO "postgres";


COMMENT ON VIEW "public"."published_songs" IS '线上的歌：线上版本的资料 + 链接 + has_audio。updated_at 是这一版的发布时间';



CREATE OR REPLACE VIEW "public"."catalog" WITH ("security_invoker"='true') AS
 SELECT "id",
    "date",
    "title",
    "track",
    "tracktotal",
    "artist",
    "lyricist",
    "composer",
    "arranger",
    "lyrics",
    "genre",
    "album",
    "albumartist",
    "comment",
    "length",
    "discnumber",
    "disctotal",
    "kugolink",
    "type",
    "hascover",
    "qmlink",
    "nelink",
    "nmn_status",
    "has_audio",
    "updated_at",
    "lyrics_start",
    "dispute_note",
    "version_id"
   FROM "public"."published_songs"
  WHERE ("dispute_note" IS NULL);


ALTER VIEW "public"."catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collections" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "song_id" bigint NOT NULL
);


ALTER TABLE "public"."collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "comment_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" bigint NOT NULL,
    "song_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_id" bigint,
    "anchor" "text",
    "anchor_index" integer,
    "anchor_time" numeric(8,3),
    "anchor_quote" "text",
    "body" "text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "status" "text" DEFAULT 'normal'::"text" NOT NULL,
    "like_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    CONSTRAINT "comments_anchor_check" CHECK (("anchor" = ANY (ARRAY['song'::"text", 'notes'::"text", 'lyrics'::"text", 'score'::"text"]))),
    CONSTRAINT "comments_body_length" CHECK ((("status" = 'deleted'::"text") OR (("char_length"("body") >= 1) AND ("char_length"("body") <= 1000)))),
    CONSTRAINT "comments_quote_length" CHECK (("char_length"("anchor_quote") <= 200)),
    CONSTRAINT "comments_reply_shape" CHECK (((("parent_id" IS NULL) AND ("anchor" IS NOT NULL)) OR (("parent_id" IS NOT NULL) AND ("anchor" IS NULL) AND ("anchor_index" IS NULL) AND ("anchor_time" IS NULL) AND ("anchor_quote" IS NULL) AND ("visibility" = 'public'::"text")))),
    CONSTRAINT "comments_status_check" CHECK (("status" = ANY (ARRAY['normal'::"text", 'pending'::"text", 'hidden'::"text", 'deleted'::"text"]))),
    CONSTRAINT "comments_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."comments"."visibility" IS 'public 公开；private 只有作者看得到。回复一律 public';



COMMENT ON COLUMN "public"."comments"."status" IS 'normal 正常；pending 待审（只有作者看得到）；hidden 被管理员隐藏；deleted 作者删了但还有回复，内容已清空，留作占位';



ALTER TABLE "public"."comments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."comments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."credit_aliases" (
    "alias" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_aliases_not_self" CHECK (("alias" <> "name"))
);


ALTER TABLE "public"."credit_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emotions" (
    "id" smallint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "tone" "text" NOT NULL,
    "energy" "text" NOT NULL,
    "sort" smallint NOT NULL,
    CONSTRAINT "emotions_energy_check" CHECK (("energy" = ANY (ARRAY['扬'::"text", '抑'::"text"]))),
    CONSTRAINT "emotions_tone_check" CHECK (("tone" = ANY (ARRAY['明'::"text", '暗'::"text"])))
);


ALTER TABLE "public"."emotions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."imagery" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."imagery" OWNER TO "postgres";


COMMENT ON TABLE "public"."imagery" IS '意象表，只存意象';



CREATE TABLE IF NOT EXISTS "public"."imagery_categories" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "domain" "text" NOT NULL,
    CONSTRAINT "imagery_categories_domain_check" CHECK (("domain" = ANY (ARRAY['自然'::"text", '人文'::"text", '情志'::"text"])))
);


ALTER TABLE "public"."imagery_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."imagery_categories" IS '意象的十七个类别，各属一个门类（domain）。固定不变，增减要先讨论（见 IMAGERY.md），后台只读';



ALTER TABLE "public"."imagery_categories" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."imagery_categories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."imagery" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."imagery_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."imagery_motifs" (
    "imagery_id" bigint NOT NULL,
    "motif_id" bigint NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "imagery_motifs_role_check" CHECK (("role" = ANY (ARRAY['primary'::"text", 'alternative'::"text", 'part'::"text"])))
);


ALTER TABLE "public"."imagery_motifs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."motifs" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "category_id" bigint NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."motifs" OWNER TO "postgres";


COMMENT ON TABLE "public"."motifs" IS '母题：标注与词登记挂的那一层（见 IMAGERY.md）。id 沿用原分类树第三级，/imagery/[id] 的地址不变';



COMMENT ON COLUMN "public"."motifs"."description" IS '这个母题指什么。后台新建时必填；拆表前建的大多没写';



CREATE TABLE IF NOT EXISTS "public"."song_imagery" (
    "version_id" bigint NOT NULL,
    "id" bigint NOT NULL,
    "imagery_id" bigint NOT NULL,
    "motif_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."song_imagery" OWNER TO "postgres";


COMMENT ON TABLE "public"."song_imagery" IS '意象标注，挂在版本上。时间标签由服务端按同一版本的歌词算出；「同时算进」由视图的 part_motif_ids 展开，都不存';



CREATE OR REPLACE VIEW "public"."working_songs" WITH ("security_invoker"='true') AS
 SELECT "s"."id",
    "v"."date",
    "v"."title",
    "v"."track",
    "v"."tracktotal",
    "v"."artist",
    "v"."lyricist",
    "v"."composer",
    "v"."arranger",
    "v"."lyrics",
    "v"."genre",
    "v"."album",
    "v"."albumartist",
    "v"."comment",
    "v"."length",
    "v"."discnumber",
    "v"."disctotal",
    ( SELECT "l"."url"
           FROM "public"."song_links" "l"
          WHERE (("l"."song_id" = "s"."id") AND ("l"."platform" = 'kugou'::"text"))) AS "kugolink",
    "v"."type",
    "v"."hascover",
    ( SELECT "l"."url"
           FROM "public"."song_links" "l"
          WHERE (("l"."song_id" = "s"."id") AND ("l"."platform" = 'qq'::"text"))) AS "qmlink",
    ( SELECT "l"."url"
           FROM "public"."song_links" "l"
          WHERE (("l"."song_id" = "s"."id") AND ("l"."platform" = 'netease'::"text"))) AS "nelink",
    "v"."nmn_status",
    (EXISTS ( SELECT 1
           FROM "public"."song_audio" "a"
          WHERE ("a"."song_id" = "s"."id"))) AS "has_audio",
    "v"."updated_at",
    "v"."updated_by",
    "v"."lyrics_start",
    "v"."dispute_note",
    "s"."created_at",
    "v"."id" AS "version_id",
    ("s"."live_version_id" IS NOT NULL) AS "is_live",
    ("v"."published_at" IS NULL) AS "has_draft",
    (EXISTS ( SELECT 1
           FROM "public"."song_versions" "f"
          WHERE (("f"."song_id" = "s"."id") AND ("f"."published_at" IS NOT NULL)))) AS "ever_published"
   FROM ("public"."songs" "s"
     JOIN LATERAL ( SELECT "x"."id",
            "x"."song_id",
            "x"."title",
            "x"."date",
            "x"."album",
            "x"."track",
            "x"."tracktotal",
            "x"."discnumber",
            "x"."disctotal",
            "x"."artist",
            "x"."lyricist",
            "x"."composer",
            "x"."arranger",
            "x"."albumartist",
            "x"."genre",
            "x"."type",
            "x"."length",
            "x"."lyrics",
            "x"."lyrics_start",
            "x"."comment",
            "x"."dispute_note",
            "x"."hascover",
            "x"."nmn_status",
            "x"."published_at",
            "x"."created_at",
            "x"."created_by",
            "x"."updated_at",
            "x"."updated_by"
           FROM "public"."song_versions" "x"
          WHERE ("x"."song_id" = "s"."id")
          ORDER BY "x"."published_at" DESC
         LIMIT 1) "v" ON (true));


ALTER VIEW "public"."working_songs" OWNER TO "postgres";


COMMENT ON VIEW "public"."working_songs" IS '每首歌的工作版本（有草稿用草稿，否则用最新冻结版本）。is_live 在线；has_draft 有未发布的改动；ever_published 发布过';



CREATE OR REPLACE VIEW "public"."working_song_imagery" WITH ("security_invoker"='true') AS
 SELECT "w"."id" AS "song_id",
    "w"."title" AS "song_title",
    "w"."album" AS "song_album",
    "i"."version_id",
    "i"."id",
    "i"."imagery_id",
    "im"."name" AS "imagery_name",
    "i"."motif_id",
    "mo"."name" AS "motif_name",
    COALESCE("parts"."ids", '{}'::bigint[]) AS "part_motif_ids",
    "i"."created_at"
   FROM (((("public"."working_songs" "w"
     JOIN "public"."song_imagery" "i" ON (("i"."version_id" = "w"."version_id")))
     JOIN "public"."imagery" "im" ON (("im"."id" = "i"."imagery_id")))
     JOIN "public"."motifs" "mo" ON (("mo"."id" = "i"."motif_id")))
     LEFT JOIN LATERAL ( SELECT "array_agg"("p"."motif_id" ORDER BY "p"."motif_id") AS "ids"
           FROM ("public"."imagery_motifs" "p"
             JOIN "public"."imagery_motifs" "m" ON ((("m"."imagery_id" = "p"."imagery_id") AND ("m"."role" = 'primary'::"text") AND ("m"."motif_id" = "i"."motif_id"))))
          WHERE (("p"."imagery_id" = "i"."imagery_id") AND ("p"."role" = 'part'::"text"))) "parts" ON (true));


ALTER VIEW "public"."working_song_imagery" OWNER TO "postgres";


COMMENT ON VIEW "public"."working_song_imagery" IS '工作版本的意象标注，带歌名、词名、母题名，一条标注一行。part_motif_ids 同 published_song_imagery';



CREATE OR REPLACE VIEW "public"."imagery_summary_all" WITH ("security_invoker"='true') AS
 SELECT "im"."id",
    "im"."name",
    ("count"("i"."id"))::integer AS "count"
   FROM ("public"."imagery" "im"
     LEFT JOIN "public"."working_song_imagery" "i" ON (("i"."imagery_id" = "im"."id")))
  GROUP BY "im"."id", "im"."name";


ALTER VIEW "public"."imagery_summary_all" OWNER TO "postgres";


ALTER TABLE "public"."motifs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."motifs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."song_emotions" (
    "version_id" bigint NOT NULL,
    "emotion_id" smallint NOT NULL,
    "rank" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "song_emotions_rank_check" CHECK ((("rank" >= 1) AND ("rank" <= 3)))
);


ALTER TABLE "public"."song_emotions" OWNER TO "postgres";


COMMENT ON TABLE "public"."song_emotions" IS '歌的基调：rank 1 为主基调，2、3 为副基调。挂在版本上';



CREATE OR REPLACE VIEW "public"."published_song_emotions" WITH ("security_invoker"='true') AS
 SELECT "s"."id" AS "song_id",
    "e"."version_id",
    "e"."emotion_id",
    "e"."rank"
   FROM ("public"."songs" "s"
     JOIN "public"."song_emotions" "e" ON (("e"."version_id" = "s"."live_version_id")));


ALTER VIEW "public"."published_song_emotions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."published_song_imagery" WITH ("security_invoker"='true') AS
 SELECT "s"."id" AS "song_id",
    "i"."version_id",
    "i"."id",
    "i"."imagery_id",
    "i"."motif_id",
    COALESCE("parts"."ids", '{}'::bigint[]) AS "part_motif_ids",
    "i"."created_at"
   FROM (("public"."songs" "s"
     JOIN "public"."song_imagery" "i" ON (("i"."version_id" = "s"."live_version_id")))
     LEFT JOIN LATERAL ( SELECT "array_agg"("p"."motif_id" ORDER BY "p"."motif_id") AS "ids"
           FROM ("public"."imagery_motifs" "p"
             JOIN "public"."imagery_motifs" "m" ON ((("m"."imagery_id" = "p"."imagery_id") AND ("m"."role" = 'primary'::"text") AND ("m"."motif_id" = "i"."motif_id"))))
          WHERE (("p"."imagery_id" = "i"."imagery_id") AND ("p"."role" = 'part'::"text"))) "parts" ON (true));


ALTER VIEW "public"."published_song_imagery" OWNER TO "postgres";


COMMENT ON VIEW "public"."published_song_imagery" IS '线上版本的意象标注，一条标注一行。part_motif_ids 是读时展开的「同时算进」；时间标签由服务端按歌词算';



CREATE TABLE IF NOT EXISTS "public"."quiz_results" (
    "id" "text" DEFAULT "public"."random_quiz_result_id"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "quiz_version" "text" NOT NULL,
    "code" "text" NOT NULL,
    "persona" "text" NOT NULL,
    "secondary" "text",
    "profile" "jsonb" NOT NULL,
    "imagery" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "song_ids" integer[] NOT NULL,
    "percents" integer[] NOT NULL,
    "reasons" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quiz_results_check" CHECK (("cardinality"("song_ids") = "cardinality"("percents"))),
    CONSTRAINT "quiz_results_id_check" CHECK (("id" ~ '^[0-9A-Za-z]{10}$'::"text"))
);


ALTER TABLE "public"."quiz_results" OWNER TO "postgres";


COMMENT ON COLUMN "public"."quiz_results"."song_ids" IS '测验结果的快照：当时推荐的歌。不加外键，歌改了、删了也照原样保留';



CREATE TABLE IF NOT EXISTS "public"."song_collation_revisers" (
    "version_id" bigint NOT NULL,
    "collation_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "first_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."song_collation_revisers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."song_collations" (
    "version_id" bigint NOT NULL,
    "id" bigint NOT NULL,
    "anchor" "text" DEFAULT 'lyrics'::"text" NOT NULL,
    "anchor_index" integer,
    "anchor_time" numeric,
    "anchor_quote" "text",
    "kind" "text" NOT NULL,
    "quote" "text",
    "sung" "text",
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "date" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "song_collations_anchor_check" CHECK (("anchor" = ANY (ARRAY['song'::"text", 'notes'::"text", 'lyrics'::"text", 'score'::"text"]))),
    CONSTRAINT "song_collations_anchor_quote_check" CHECK (("char_length"("anchor_quote") <= 200)),
    CONSTRAINT "song_collations_body_check" CHECK (("char_length"("body") <= 4000)),
    CONSTRAINT "song_collations_check" CHECK ((("sung" IS NULL) OR ("quote" IS NOT NULL))),
    CONSTRAINT "song_collations_check1" CHECK ((("body" <> ''::"text") OR ("sung" IS NOT NULL))),
    CONSTRAINT "song_collations_check2" CHECK (((("anchor" = 'lyrics'::"text") AND ("kind" = ANY (ARRAY['slip'::"text", 'sung'::"text", 'version'::"text", 'note'::"text"]))) OR (("anchor" = 'song'::"text") AND ("kind" = ANY (ARRAY['release'::"text", 'draft'::"text", 'note'::"text"]))))),
    CONSTRAINT "song_collations_date_check" CHECK (("date" ~ '^\d{4}(-\d{2}(-\d{2})?)?$'::"text")),
    CONSTRAINT "song_collations_quote_check" CHECK ((("char_length"("quote") >= 1) AND ("char_length"("quote") <= 100))),
    CONSTRAINT "song_collations_sung_check" CHECK ((("char_length"("sung") >= 1) AND ("char_length"("sung") <= 100)))
);


ALTER TABLE "public"."song_collations" OWNER TO "postgres";


COMMENT ON TABLE "public"."song_collations" IS '校记（anchor = lyrics）与补遗（anchor = song），挂在版本上';



ALTER TABLE "public"."song_collations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."song_collations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."song_imagery" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."song_imagery_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."song_versions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."song_versions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."songs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."songs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."story_qjtx" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "year" "text",
    "month" "text" DEFAULT '无考'::"text",
    "content" "text"[],
    "important" boolean DEFAULT false NOT NULL,
    "detail_title" "text",
    "detail_quote" "text",
    "detail_body" "text"[],
    "detail_closing" "text"
);


ALTER TABLE "public"."story_qjtx" OWNER TO "postgres";


ALTER TABLE "public"."story_qjtx" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."story_qjtx_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."stream_grants" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "song_id" bigint NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stream_grants" OWNER TO "postgres";


ALTER TABLE "public"."stream_grants" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."stream_grants_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "song_id" bigint,
    "category" "text",
    "content" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reply" "text",
    "replied_by" "uuid",
    "replied_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'replied'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "user_requests_type_check" CHECK (("type" = ANY (ARRAY['song_feedback'::"text", 'benefit_apply'::"text", 'admin_apply'::"text"])))
);


ALTER TABLE "public"."user_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "name" "text" DEFAULT "public"."random_user_name"() NOT NULL,
    "display" boolean DEFAULT false NOT NULL,
    "intro" "text",
    "sort_order" bigint NOT NULL,
    "can_stream" boolean DEFAULT false NOT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'bot'::"text", 'admin'::"text", 'super'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."role" IS '逐级包含：bot 能读写后台但不能发布、下架、删歌，不处理用户请求；admin 再加发布与放弃草稿；super 再加下架、删歌与用户管理。同步到 JWT 的 app_metadata.role';



ALTER TABLE "public"."users" ALTER COLUMN "sort_order" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."users_sort_order_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("user_id", "song_id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("comment_id", "user_id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_aliases"
    ADD CONSTRAINT "credit_aliases_pkey" PRIMARY KEY ("alias");



ALTER TABLE ONLY "public"."emotions"
    ADD CONSTRAINT "emotions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."emotions"
    ADD CONSTRAINT "emotions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."imagery_categories"
    ADD CONSTRAINT "imagery_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."imagery_categories"
    ADD CONSTRAINT "imagery_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."imagery_motifs"
    ADD CONSTRAINT "imagery_motifs_pkey" PRIMARY KEY ("imagery_id", "motif_id");



ALTER TABLE ONLY "public"."imagery"
    ADD CONSTRAINT "imagery_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."imagery"
    ADD CONSTRAINT "imagery_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."motifs"
    ADD CONSTRAINT "motifs_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."motifs"
    ADD CONSTRAINT "motifs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_results"
    ADD CONSTRAINT "quiz_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_results"
    ADD CONSTRAINT "quiz_results_user_id_quiz_version_code_key" UNIQUE ("user_id", "quiz_version", "code");



ALTER TABLE ONLY "public"."song_audio"
    ADD CONSTRAINT "song_audio_navid_id_key" UNIQUE ("navid_id");



ALTER TABLE ONLY "public"."song_audio"
    ADD CONSTRAINT "song_audio_pkey" PRIMARY KEY ("song_id");



ALTER TABLE ONLY "public"."song_collation_revisers"
    ADD CONSTRAINT "song_collation_revisers_pkey" PRIMARY KEY ("version_id", "collation_id", "user_id");



ALTER TABLE ONLY "public"."song_collations"
    ADD CONSTRAINT "song_collations_pkey" PRIMARY KEY ("version_id", "id");



ALTER TABLE ONLY "public"."song_emotions"
    ADD CONSTRAINT "song_emotions_pkey" PRIMARY KEY ("version_id", "emotion_id");



ALTER TABLE ONLY "public"."song_emotions"
    ADD CONSTRAINT "song_emotions_version_id_rank_key" UNIQUE ("version_id", "rank");



ALTER TABLE ONLY "public"."song_imagery"
    ADD CONSTRAINT "song_imagery_pkey" PRIMARY KEY ("version_id", "id");



ALTER TABLE ONLY "public"."song_imagery"
    ADD CONSTRAINT "song_imagery_version_id_imagery_id_key" UNIQUE ("version_id", "imagery_id");



ALTER TABLE ONLY "public"."song_links"
    ADD CONSTRAINT "song_links_pkey" PRIMARY KEY ("song_id", "platform");



ALTER TABLE ONLY "public"."song_links"
    ADD CONSTRAINT "song_links_platform_url_key" UNIQUE ("platform", "url");



ALTER TABLE ONLY "public"."song_versions"
    ADD CONSTRAINT "song_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."song_versions"
    ADD CONSTRAINT "song_versions_song_id_id_key" UNIQUE ("song_id", "id");



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_qjtx"
    ADD CONSTRAINT "story_qjtx_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stream_grants"
    ADD CONSTRAINT "stream_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_requests"
    ADD CONSTRAINT "user_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "collections_song_id" ON "public"."collections" USING "btree" ("song_id");



CREATE INDEX "comment_likes_user_idx" ON "public"."comment_likes" USING "btree" ("user_id");



CREATE INDEX "comments_parent_idx" ON "public"."comments" USING "btree" ("parent_id") WHERE ("parent_id" IS NOT NULL);



CREATE INDEX "comments_song_idx" ON "public"."comments" USING "btree" ("song_id", "created_at");



CREATE INDEX "comments_user_idx" ON "public"."comments" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_requests_type_status" ON "public"."user_requests" USING "btree" ("type", "status");



CREATE INDEX "idx_user_requests_user_id" ON "public"."user_requests" USING "btree" ("user_id");



CREATE INDEX "imagery_motifs_motif_id" ON "public"."imagery_motifs" USING "btree" ("motif_id");



CREATE UNIQUE INDEX "imagery_motifs_one_primary" ON "public"."imagery_motifs" USING "btree" ("imagery_id") WHERE ("role" = 'primary'::"text");



CREATE INDEX "motifs_category_id" ON "public"."motifs" USING "btree" ("category_id");



CREATE INDEX "quiz_results_user_created" ON "public"."quiz_results" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "song_collation_revisers_user" ON "public"."song_collation_revisers" USING "btree" ("user_id");



CREATE INDEX "song_emotions_emotion" ON "public"."song_emotions" USING "btree" ("emotion_id");



CREATE INDEX "song_imagery_imagery_id" ON "public"."song_imagery" USING "btree" ("imagery_id");



CREATE INDEX "song_imagery_motif_id" ON "public"."song_imagery" USING "btree" ("motif_id");



CREATE UNIQUE INDEX "song_versions_one_draft" ON "public"."song_versions" USING "btree" ("song_id") WHERE ("published_at" IS NULL);



CREATE INDEX "stream_grants_song_id" ON "public"."stream_grants" USING "btree" ("song_id");



CREATE INDEX "stream_grants_user_time" ON "public"."stream_grants" USING "btree" ("user_id", "issued_at" DESC);



CREATE UNIQUE INDEX "users_name_unique" ON "public"."users" USING "btree" ("lower"("btrim"("name")));



CREATE OR REPLACE TRIGGER "comment_likes_sync_count" AFTER INSERT OR DELETE ON "public"."comment_likes" FOR EACH ROW EXECUTE FUNCTION "public"."comment_likes_sync_count"();



CREATE OR REPLACE TRIGGER "comments_check_reply" BEFORE INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."comments_check_reply"();



CREATE OR REPLACE TRIGGER "credit_aliases_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."credit_aliases" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "credit_aliases_no_chain" BEFORE INSERT OR UPDATE ON "public"."credit_aliases" FOR EACH ROW EXECUTE FUNCTION "public"."credit_aliases_no_chain"();



CREATE OR REPLACE TRIGGER "emotions_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."emotions" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "imagery_audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."imagery" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "imagery_categories_audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."imagery_categories" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "imagery_motifs_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."imagery_motifs" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "motifs_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."motifs" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "on_user_role_change" AFTER INSERT OR UPDATE OF "role" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_claims_to_auth"();



CREATE OR REPLACE TRIGGER "quiz_results_keep_latest" AFTER INSERT ON "public"."quiz_results" FOR EACH ROW EXECUTE FUNCTION "public"."quiz_results_keep_latest"();



CREATE OR REPLACE TRIGGER "song_collation_revisers_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."song_collation_revisers" FOR EACH ROW EXECUTE FUNCTION "public"."editorial_guard"();



CREATE OR REPLACE TRIGGER "song_collations_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."song_collations" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "song_collations_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."song_collations" FOR EACH ROW EXECUTE FUNCTION "public"."editorial_guard"();



CREATE OR REPLACE TRIGGER "song_collations_record_reviser" AFTER UPDATE ON "public"."song_collations" FOR EACH ROW WHEN ((("old"."kind" IS DISTINCT FROM "new"."kind") OR ("old"."date" IS DISTINCT FROM "new"."date") OR ("old"."quote" IS DISTINCT FROM "new"."quote") OR ("old"."sung" IS DISTINCT FROM "new"."sung") OR ("old"."body" IS DISTINCT FROM "new"."body") OR ("old"."anchor_quote" IS DISTINCT FROM "new"."anchor_quote"))) EXECUTE FUNCTION "public"."song_collations_record_reviser"();



CREATE OR REPLACE TRIGGER "song_collations_stamp" BEFORE INSERT OR UPDATE ON "public"."song_collations" FOR EACH ROW EXECUTE FUNCTION "public"."song_collations_stamp"();



CREATE OR REPLACE TRIGGER "song_emotions_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."song_emotions" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "song_emotions_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."song_emotions" FOR EACH ROW EXECUTE FUNCTION "public"."editorial_guard"();



CREATE OR REPLACE TRIGGER "song_imagery_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."song_imagery" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "song_imagery_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."song_imagery" FOR EACH ROW EXECUTE FUNCTION "public"."editorial_guard"();



CREATE OR REPLACE TRIGGER "song_links_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."song_links" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "song_versions_audit" AFTER UPDATE ON "public"."song_versions" FOR EACH ROW WHEN ((NOT ("old"."published_at" IS DISTINCT FROM "new"."published_at"))) EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "song_versions_guard" BEFORE DELETE OR UPDATE ON "public"."song_versions" FOR EACH ROW EXECUTE FUNCTION "public"."song_versions_guard"();



CREATE OR REPLACE TRIGGER "users_guard_can_stream" BEFORE INSERT OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."users_guard_can_stream"();



CREATE OR REPLACE TRIGGER "users_guard_role" BEFORE UPDATE OF "role" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."users_guard_role"();



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."imagery_motifs"
    ADD CONSTRAINT "imagery_motifs_imagery_id_fkey" FOREIGN KEY ("imagery_id") REFERENCES "public"."imagery"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."imagery_motifs"
    ADD CONSTRAINT "imagery_motifs_motif_id_fkey" FOREIGN KEY ("motif_id") REFERENCES "public"."motifs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."motifs"
    ADD CONSTRAINT "motifs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."imagery_categories"("id");



ALTER TABLE ONLY "public"."quiz_results"
    ADD CONSTRAINT "quiz_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_audio"
    ADD CONSTRAINT "song_audio_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_collation_revisers"
    ADD CONSTRAINT "song_collation_revisers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_collation_revisers"
    ADD CONSTRAINT "song_collation_revisers_version_id_collation_id_fkey" FOREIGN KEY ("version_id", "collation_id") REFERENCES "public"."song_collations"("version_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_collations"
    ADD CONSTRAINT "song_collations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."song_collations"
    ADD CONSTRAINT "song_collations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."song_collations"
    ADD CONSTRAINT "song_collations_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."song_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_emotions"
    ADD CONSTRAINT "song_emotions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."song_emotions"
    ADD CONSTRAINT "song_emotions_emotion_id_fkey" FOREIGN KEY ("emotion_id") REFERENCES "public"."emotions"("id");



ALTER TABLE ONLY "public"."song_emotions"
    ADD CONSTRAINT "song_emotions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."song_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_imagery"
    ADD CONSTRAINT "song_imagery_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."song_imagery"
    ADD CONSTRAINT "song_imagery_imagery_id_fkey" FOREIGN KEY ("imagery_id") REFERENCES "public"."imagery"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_imagery"
    ADD CONSTRAINT "song_imagery_motif_id_fkey" FOREIGN KEY ("motif_id") REFERENCES "public"."motifs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_imagery"
    ADD CONSTRAINT "song_imagery_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."song_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_links"
    ADD CONSTRAINT "song_links_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_versions"
    ADD CONSTRAINT "song_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."song_versions"
    ADD CONSTRAINT "song_versions_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_versions"
    ADD CONSTRAINT "song_versions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_live_version_fkey" FOREIGN KEY ("id", "live_version_id") REFERENCES "public"."song_versions"("song_id", "id");



ALTER TABLE ONLY "public"."stream_grants"
    ADD CONSTRAINT "stream_grants_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stream_grants"
    ADD CONSTRAINT "stream_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_requests"
    ADD CONSTRAINT "user_requests_replied_by_fkey" FOREIGN KEY ("replied_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_requests"
    ADD CONSTRAINT "user_requests_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_requests"
    ADD CONSTRAINT "user_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Enable users to view their own data only" ON "public"."collections" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_select" ON "public"."comments" FOR SELECT TO "authenticated" USING (((("status" = 'normal'::"text") AND ("visibility" = 'public'::"text")) OR (("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = ANY (ARRAY['normal'::"text", 'pending'::"text"])))));



ALTER TABLE "public"."credit_aliases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_aliases_staff" ON "public"."credit_aliases" TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"]))) WITH CHECK ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



ALTER TABLE "public"."emotions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."imagery" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."imagery_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "imagery_categories_staff_select" ON "public"."imagery_categories" FOR SELECT TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



ALTER TABLE "public"."imagery_motifs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "imagery_motifs_staff" ON "public"."imagery_motifs" TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"]))) WITH CHECK ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



CREATE POLICY "imagery_staff_insert" ON "public"."imagery" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



CREATE POLICY "imagery_staff_select" ON "public"."imagery" FOR SELECT TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



CREATE POLICY "imagery_staff_update" ON "public"."imagery" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"]))) WITH CHECK ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



ALTER TABLE "public"."motifs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "motifs_admin_delete" ON "public"."motifs" FOR DELETE TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['admin'::"text", 'super'::"text"])));



CREATE POLICY "motifs_staff_insert" ON "public"."motifs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



CREATE POLICY "motifs_staff_select" ON "public"."motifs" FOR SELECT TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



CREATE POLICY "motifs_staff_update" ON "public"."motifs" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"]))) WITH CHECK ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



ALTER TABLE "public"."quiz_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quiz_results_select_own" ON "public"."quiz_results" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."song_audio" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "song_audio_staff_select" ON "public"."song_audio" FOR SELECT TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



ALTER TABLE "public"."song_collation_revisers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "song_collation_revisers_staff_select" ON "public"."song_collation_revisers" FOR SELECT TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



ALTER TABLE "public"."song_collations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "song_collations_staff" ON "public"."song_collations" TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"]))) WITH CHECK ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



ALTER TABLE "public"."song_emotions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "song_emotions_staff" ON "public"."song_emotions" TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"]))) WITH CHECK ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



ALTER TABLE "public"."song_imagery" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "song_imagery_staff" ON "public"."song_imagery" TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"]))) WITH CHECK ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



ALTER TABLE "public"."song_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "song_links_staff" ON "public"."song_links" TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"]))) WITH CHECK ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



ALTER TABLE "public"."song_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "song_versions_staff_select" ON "public"."song_versions" FOR SELECT TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



CREATE POLICY "song_versions_staff_update" ON "public"."song_versions" FOR UPDATE TO "authenticated" USING (((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])) AND ("published_at" IS NULL))) WITH CHECK (((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])) AND ("published_at" IS NULL)));



ALTER TABLE "public"."songs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "songs_staff_select" ON "public"."songs" FOR SELECT TO "authenticated" USING ((( SELECT "public"."jwt_role"() AS "jwt_role") = ANY (ARRAY['bot'::"text", 'admin'::"text", 'super'::"text"])));



ALTER TABLE "public"."story_qjtx" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stream_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_requests_select" ON "public"."user_requests" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ((( SELECT "public"."jwt_role"() AS "jwt_role") = 'admin'::"text") AND ("type" = 'song_feedback'::"text")) OR (( SELECT "public"."jwt_role"() AS "jwt_role") = 'super'::"text")));



CREATE POLICY "user_requests_update" ON "public"."user_requests" FOR UPDATE TO "authenticated" USING ((((( SELECT "public"."jwt_role"() AS "jwt_role") = 'admin'::"text") AND ("type" = 'song_feedback'::"text")) OR (( SELECT "public"."jwt_role"() AS "jwt_role") = 'super'::"text"))) WITH CHECK ((("type" = 'song_feedback'::"text") OR (( SELECT "public"."jwt_role"() AS "jwt_role") = 'super'::"text")));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select" ON "public"."users" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "id") OR (( SELECT "public"."jwt_role"() AS "jwt_role") = 'super'::"text")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































REVOKE ALL ON FUNCTION "public"."assert_role"("allowed" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_role"("allowed" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_stream_grant"("p_user_id" "uuid", "p_song_id" bigint, "p_hour_limit" integer, "p_day_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_stream_grant"("p_user_id" "uuid", "p_song_id" bigint, "p_hour_limit" integer, "p_day_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."comment_likes_sync_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."comment_likes_sync_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comment_likes_sync_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comments_check_reply"() TO "anon";
GRANT ALL ON FUNCTION "public"."comments_check_reply"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comments_check_reply"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_song"("p_fields" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_song"("p_fields" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."credit_aliases_no_chain"() TO "anon";
GRANT ALL ON FUNCTION "public"."credit_aliases_no_chain"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."credit_aliases_no_chain"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_comment"("p_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_comment"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_comment"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_song"("p_song_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_song"("p_song_id" bigint) TO "authenticated";



GRANT ALL ON FUNCTION "public"."discard_draft"("p_song_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."discard_draft"("p_song_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."edit_comment"("p_id" bigint, "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."edit_comment"("p_id" bigint, "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."edit_comment"("p_id" bigint, "p_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."editorial_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_draft"("p_song_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."ensure_draft"("p_song_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."imagery_occurrence_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."jwt_role"() TO "service_role";
GRANT ALL ON FUNCTION "public"."jwt_role"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."log_song_event"("p_action" "text", "p_song_id" bigint, "p_version_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_song_event"("p_action" "text", "p_song_id" bigint, "p_version_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."publish_song"("p_song_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."publish_song"("p_song_id" bigint) TO "authenticated";



GRANT ALL ON FUNCTION "public"."quiz_results_keep_latest"() TO "anon";
GRANT ALL ON FUNCTION "public"."quiz_results_keep_latest"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."quiz_results_keep_latest"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."random_quiz_result_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."random_quiz_result_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."random_quiz_result_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."random_quiz_result_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."random_user_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."random_user_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."random_user_name"() TO "service_role";
GRANT ALL ON FUNCTION "public"."random_user_name"() TO "supabase_auth_admin";



REVOKE ALL ON FUNCTION "public"."record_audit_log"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_audit_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_audit_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_audit_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."song_collations_record_reviser"() TO "anon";
GRANT ALL ON FUNCTION "public"."song_collations_record_reviser"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."song_collations_record_reviser"() TO "service_role";



GRANT ALL ON FUNCTION "public"."song_collations_stamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."song_collations_stamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."song_collations_stamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."song_versions_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_user_claims_to_auth"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_user_claims_to_auth"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_claims_to_auth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_claims_to_auth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unpublish_song"("p_song_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."unpublish_song"("p_song_id" bigint) TO "authenticated";



GRANT ALL ON FUNCTION "public"."updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."users_guard_can_stream"() TO "anon";
GRANT ALL ON FUNCTION "public"."users_guard_can_stream"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."users_guard_can_stream"() TO "service_role";



GRANT ALL ON FUNCTION "public"."users_guard_role"() TO "service_role";
























GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."song_audio" TO "service_role";
GRANT SELECT ON TABLE "public"."song_audio" TO "authenticated";



GRANT ALL ON TABLE "public"."song_links" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."song_links" TO "authenticated";



GRANT ALL ON TABLE "public"."song_versions" TO "service_role";
GRANT SELECT ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("title") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("date") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("album") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("track") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("tracktotal") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("discnumber") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("disctotal") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("artist") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("lyricist") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("composer") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("arranger") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("albumartist") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("genre") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("type") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("length") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("lyrics") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("lyrics_start") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("comment") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("dispute_note") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("hascover") ON TABLE "public"."song_versions" TO "authenticated";



GRANT UPDATE("nmn_status") ON TABLE "public"."song_versions" TO "authenticated";



GRANT ALL ON TABLE "public"."songs" TO "service_role";
GRANT SELECT ON TABLE "public"."songs" TO "authenticated";



GRANT ALL ON TABLE "public"."published_songs" TO "service_role";
GRANT SELECT ON TABLE "public"."published_songs" TO "authenticated";



GRANT ALL ON TABLE "public"."catalog" TO "service_role";
GRANT SELECT ON TABLE "public"."catalog" TO "authenticated";



GRANT ALL ON TABLE "public"."collections" TO "service_role";
GRANT SELECT ON TABLE "public"."collections" TO "authenticated";



GRANT ALL ON TABLE "public"."comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "service_role";
GRANT SELECT ON TABLE "public"."comments" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."comments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."credit_aliases" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."credit_aliases" TO "authenticated";



GRANT ALL ON TABLE "public"."emotions" TO "service_role";



GRANT ALL ON TABLE "public"."imagery" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."imagery" TO "authenticated";



GRANT ALL ON TABLE "public"."imagery_categories" TO "service_role";
GRANT SELECT ON TABLE "public"."imagery_categories" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."imagery_categories_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."imagery_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."imagery_motifs" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."imagery_motifs" TO "authenticated";



GRANT ALL ON TABLE "public"."motifs" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."motifs" TO "authenticated";



GRANT ALL ON TABLE "public"."song_imagery" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."song_imagery" TO "authenticated";



GRANT INSERT("version_id") ON TABLE "public"."song_imagery" TO "authenticated";



GRANT INSERT("imagery_id"),UPDATE("imagery_id") ON TABLE "public"."song_imagery" TO "authenticated";



GRANT INSERT("motif_id"),UPDATE("motif_id") ON TABLE "public"."song_imagery" TO "authenticated";



GRANT ALL ON TABLE "public"."working_songs" TO "service_role";
GRANT SELECT ON TABLE "public"."working_songs" TO "authenticated";



GRANT ALL ON TABLE "public"."working_song_imagery" TO "service_role";
GRANT SELECT ON TABLE "public"."working_song_imagery" TO "authenticated";



GRANT ALL ON TABLE "public"."imagery_summary_all" TO "service_role";
GRANT SELECT ON TABLE "public"."imagery_summary_all" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."motifs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."song_emotions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."song_emotions" TO "authenticated";



GRANT ALL ON TABLE "public"."published_song_emotions" TO "service_role";
GRANT SELECT ON TABLE "public"."published_song_emotions" TO "authenticated";



GRANT ALL ON TABLE "public"."published_song_imagery" TO "service_role";
GRANT SELECT ON TABLE "public"."published_song_imagery" TO "authenticated";



GRANT ALL ON TABLE "public"."quiz_results" TO "service_role";
GRANT SELECT ON TABLE "public"."quiz_results" TO "authenticated";



GRANT ALL ON TABLE "public"."song_collation_revisers" TO "service_role";
GRANT SELECT ON TABLE "public"."song_collation_revisers" TO "authenticated";



GRANT ALL ON TABLE "public"."song_collations" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."song_collations" TO "authenticated";



GRANT INSERT("version_id") ON TABLE "public"."song_collations" TO "authenticated";



GRANT INSERT("anchor"),UPDATE("anchor") ON TABLE "public"."song_collations" TO "authenticated";



GRANT INSERT("anchor_index"),UPDATE("anchor_index") ON TABLE "public"."song_collations" TO "authenticated";



GRANT INSERT("anchor_time"),UPDATE("anchor_time") ON TABLE "public"."song_collations" TO "authenticated";



GRANT INSERT("anchor_quote"),UPDATE("anchor_quote") ON TABLE "public"."song_collations" TO "authenticated";



GRANT INSERT("kind"),UPDATE("kind") ON TABLE "public"."song_collations" TO "authenticated";



GRANT INSERT("quote"),UPDATE("quote") ON TABLE "public"."song_collations" TO "authenticated";



GRANT INSERT("sung"),UPDATE("sung") ON TABLE "public"."song_collations" TO "authenticated";



GRANT INSERT("body"),UPDATE("body") ON TABLE "public"."song_collations" TO "authenticated";



GRANT INSERT("date"),UPDATE("date") ON TABLE "public"."song_collations" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."song_collations_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."song_imagery_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."song_versions_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."songs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."story_qjtx" TO "service_role";



GRANT ALL ON SEQUENCE "public"."story_qjtx_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stream_grants" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stream_grants_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_requests" TO "service_role";
GRANT SELECT ON TABLE "public"."user_requests" TO "authenticated";



GRANT UPDATE("status") ON TABLE "public"."user_requests" TO "authenticated";



GRANT UPDATE("reply") ON TABLE "public"."user_requests" TO "authenticated";



GRANT UPDATE("replied_by") ON TABLE "public"."user_requests" TO "authenticated";



GRANT UPDATE("replied_at") ON TABLE "public"."user_requests" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."user_requests" TO "authenticated";



GRANT ALL ON TABLE "public"."users" TO "service_role";
GRANT SELECT ON TABLE "public"."users" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."users_sort_order_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































