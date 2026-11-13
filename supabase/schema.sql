


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






CREATE OR REPLACE FUNCTION "public"."approve_music_sync"("temp_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$BEGIN
  INSERT INTO public.music (
    id, date, title, track, tracktotal, artist, lyricist,
    composer, arranger, lyrics, genre, album, albumartist, comment,
    length, discnumber, disctotal, kugolink, type, hascover, qmlink, nelink, nmn_status, updated_at, lyrics_start, dispute_note
  )
  SELECT 
    id, date, title, track, tracktotal, artist, lyricist,
    composer, arranger, lyrics, genre, album, albumartist, comment,
    length, discnumber, disctotal, kugolink, type, hascover, qmlink, nelink, nmn_status, updated_at, lyrics_start, dispute_note
  FROM public.temp
  WHERE id = temp_id
  ON CONFLICT (id) DO UPDATE SET
    date = EXCLUDED.date,
    title = EXCLUDED.title,
    track = EXCLUDED.track,
    tracktotal = EXCLUDED.tracktotal,
    artist = EXCLUDED.artist,
    lyricist = EXCLUDED.lyricist,
    composer = EXCLUDED.composer,
    arranger = EXCLUDED.arranger,
    lyrics = EXCLUDED.lyrics,
    genre = EXCLUDED.genre,
    album = EXCLUDED.album,
    albumartist = EXCLUDED.albumartist,
    comment = EXCLUDED.comment,
    length = EXCLUDED.length,
    discnumber = EXCLUDED.discnumber,
    disctotal = EXCLUDED.disctotal,
    kugolink = EXCLUDED.kugolink,
    type = EXCLUDED.type,
    hascover = EXCLUDED.hascover,
    qmlink = EXCLUDED.qmlink,
    nelink = EXCLUDED.nelink,
    nmn_status = EXCLUDED.nmn_status,
    updated_at = EXCLUDED.updated_at,
    lyrics_start = EXCLUDED.lyrics_start,
    dispute_note = EXCLUDED.dispute_note;
END;$$;


ALTER FUNCTION "public"."approve_music_sync"("temp_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_stream_grant"("p_user_id" "uuid", "p_song_id" integer, "p_hour_limit" integer, "p_day_limit" integer) RETURNS "text"
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


ALTER FUNCTION "public"."claim_stream_grant"("p_user_id" "uuid", "p_song_id" integer, "p_hour_limit" integer, "p_day_limit" integer) OWNER TO "postgres";


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
     or p.visibility <> 0
     or p.status <> 0 then
    raise exception 'invalid parent comment' using errcode = '23514';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."comments_check_reply"() OWNER TO "postgres";


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
    where id = p_id and user_id = auth.uid() and status <> 3;
  if not found then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.comments where parent_id = p_id) then
    update public.comments
      set status = 3, body = '', edited_at = now()
      where id = p_id;
  else
    delete from public.comments where id = p_id;
    if c.parent_id is not null then
      delete from public.comments p
        where p.id = c.parent_id
          and p.status = 3
          and not exists (
            select 1 from public.comments r where r.parent_id = p.id
          );
    end if;
  end if;
end;
$$;


ALTER FUNCTION "public"."delete_comment"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."edit_comment"("p_id" bigint, "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.comments
    set body = p_body, edited_at = now()
    where id = p_id and user_id = auth.uid() and status in (0, 1);
  if not found then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
end;
$$;


ALTER FUNCTION "public"."edit_comment"("p_id" bigint, "p_body" "text") OWNER TO "postgres";


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
  select o.song_id::bigint, count(*)::bigint
  from public.imagery_occurrences o
  group by o.song_id
$$;


ALTER FUNCTION "public"."imagery_occurrence_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_role_tampering"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- 如果当前操作是由普通登录用户（authenticated）或匿名用户（anon）发起的
  IF (auth.role() = 'authenticated' OR auth.role() = 'anon') THEN
    
    -- 1. 拦截对 is_admin 的篡改：如果新值和旧值不同，强制还原为旧值
    IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin) THEN
      NEW.is_admin := OLD.is_admin;
    END IF;
    
    -- 2. 拦截对 is_super 的篡改
    IF (NEW.is_super IS DISTINCT FROM OLD.is_super) THEN
      NEW.is_super := OLD.is_super;
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_role_tampering"() OWNER TO "postgres";


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
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, action_type, user_id, old_data)
        VALUES (TG_TABLE_NAME::text, TG_OP, auth.uid(), to_jsonb(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (table_name, action_type, user_id, old_data, new_data)
        VALUES (TG_TABLE_NAME::text, TG_OP, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (table_name, action_type, user_id, new_data)
        VALUES (TG_TABLE_NAME::text, TG_OP, auth.uid(), to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."record_audit_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."song_collations_record_reviser"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is not null and auth.uid() is distinct from new.created_by then
    insert into public.song_collation_revisers (collation_id, user_id)
    values (new.id, auth.uid())
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


CREATE OR REPLACE FUNCTION "public"."sync_music_from_temp"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$BEGIN
  -- 1. 增量同步 (UPSERT)：如果 id 存在则更新，不存在则插入
  INSERT INTO public.music (
    id, date, title, track, tracktotal, artist, lyricist,
    composer, arranger, lyrics, genre, album, albumartist, comment,
    length, discnumber, disctotal, kugolink, type, hascover, qmlink, nelink, nmn_status, updated_at, lyrics_start, dispute_note
  )
  SELECT 
    id, date, title, track, tracktotal, artist, lyricist,
    composer, arranger, lyrics, genre, album, albumartist, comment,
    length, discnumber, disctotal, kugolink, type, hascover, qmlink, nelink, nmn_status, updated_at, lyrics_start, dispute_note
  FROM public.temp
  ON CONFLICT (id) DO UPDATE SET
    date = EXCLUDED.date,
    title = EXCLUDED.title,
    track = EXCLUDED.track,
    tracktotal = EXCLUDED.tracktotal,
    artist = EXCLUDED.artist,
    lyricist = EXCLUDED.lyricist,
    composer = EXCLUDED.composer,
    arranger = EXCLUDED.arranger,
    lyrics = EXCLUDED.lyrics,
    genre = EXCLUDED.genre,
    album = EXCLUDED.album,
    albumartist = EXCLUDED.albumartist,
    comment = EXCLUDED.comment,
    length = EXCLUDED.length,
    discnumber = EXCLUDED.discnumber,
    disctotal = EXCLUDED.disctotal,
    kugolink = EXCLUDED.kugolink,
    type = EXCLUDED.type,
    hascover = EXCLUDED.hascover,
    qmlink = EXCLUDED.qmlink,
    nelink = EXCLUDED.nelink,
    nmn_status = EXCLUDED.nmn_status,
    updated_at = EXCLUDED.updated_at,
    lyrics_start = EXCLUDED.lyrics_start,
    dispute_note = EXCLUDED.dispute_note;

  -- 2. 镜像清理 (DELETE)：删除 music 表中有，但 temp 表中已经没有的旧数据
  DELETE FROM public.music 
  WHERE id NOT IN (SELECT id FROM public.temp);

  -- 3. 保留你的原有逻辑：重置 temp 表的序列
  PERFORM setval(pg_get_serial_sequence('public.temp', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.temp));
END;$$;


ALTER FUNCTION "public"."sync_music_from_temp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_claims_to_auth"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    -- 显式指定 auth.users，防止被路径劫持
    UPDATE auth.users
    SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
            'is_admin', NEW.is_admin,
            'is_super', NEW.is_super
        )
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_claims_to_auth"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_music_has_audio"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.music SET has_audio = true WHERE id = NEW.id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.music SET has_audio = false WHERE id = OLD.id;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.id IS DISTINCT FROM NEW.id) THEN
            UPDATE public.music SET has_audio = false WHERE id = OLD.id;
            UPDATE public.music SET has_audio = true WHERE id = NEW.id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_music_has_audio"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."updated_by"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."updated_by"() OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
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
    "visibility" smallint DEFAULT 0 NOT NULL,
    "status" smallint DEFAULT 0 NOT NULL,
    "like_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    CONSTRAINT "comments_anchor_check" CHECK (("anchor" = ANY (ARRAY['song'::"text", 'notes'::"text", 'lyrics'::"text", 'score'::"text"]))),
    CONSTRAINT "comments_body_length" CHECK ((("status" = 3) OR (("char_length"("body") >= 1) AND ("char_length"("body") <= 1000)))),
    CONSTRAINT "comments_quote_length" CHECK (("char_length"("anchor_quote") <= 200)),
    CONSTRAINT "comments_reply_shape" CHECK (((("parent_id" IS NULL) AND ("anchor" IS NOT NULL)) OR (("parent_id" IS NOT NULL) AND ("anchor" IS NULL) AND ("anchor_index" IS NULL) AND ("anchor_time" IS NULL) AND ("anchor_quote" IS NULL) AND ("visibility" = 0)))),
    CONSTRAINT "comments_status_check" CHECK (("status" = ANY (ARRAY[0, 1, 2, 3]))),
    CONSTRAINT "comments_visibility_check" CHECK (("visibility" = ANY (ARRAY[0, 1])))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


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
    "parent_id" smallint,
    "level" smallint,
    "description" "text"
);


ALTER TABLE "public"."imagery_categories" OWNER TO "postgres";


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
    "category_id" bigint NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "imagery_motifs_role_check" CHECK (("role" = ANY (ARRAY['primary'::"text", 'alternative'::"text", 'part'::"text"])))
);


ALTER TABLE "public"."imagery_motifs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."imagery_occurrences" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lyric_timetag" "jsonb"[] NOT NULL,
    "song_id" bigint NOT NULL,
    "imagery_id" bigint NOT NULL,
    "category_id" bigint NOT NULL
);


ALTER TABLE "public"."imagery_occurrences" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."imagery_summary_all" AS
 SELECT "i"."id",
    "i"."name",
    ("count"("o"."id"))::integer AS "count",
    COALESCE("array_agg"(DISTINCT "o"."category_id") FILTER (WHERE ("o"."category_id" IS NOT NULL)), '{}'::bigint[]) AS "categoryIds"
   FROM ("public"."imagery" "i"
     LEFT JOIN "public"."imagery_occurrences" "o" ON (("i"."id" = "o"."imagery_id")))
  GROUP BY "i"."id", "i"."name";


ALTER VIEW "public"."imagery_summary_all" OWNER TO "postgres";


ALTER TABLE "public"."imagery_occurrences" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."lyric_imagery_occurrences_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."music" (
    "id" bigint NOT NULL,
    "date" "date",
    "title" "text" NOT NULL,
    "track" bigint DEFAULT '1'::bigint,
    "tracktotal" bigint DEFAULT '1'::bigint,
    "artist" "text"[],
    "lyricist" "text"[],
    "composer" "text"[],
    "arranger" "text"[],
    "lyrics" "text",
    "genre" "text"[] DEFAULT '{古风}'::"text"[],
    "album" "text",
    "albumartist" "text"[],
    "comment" "text",
    "length" bigint,
    "discnumber" bigint DEFAULT '1'::bigint,
    "disctotal" bigint DEFAULT '1'::bigint,
    "kugolink" "text",
    "type" "text"[] DEFAULT '{原创}'::"text"[] NOT NULL,
    "hascover" boolean,
    "qmlink" "text",
    "nelink" "text",
    "nmn_status" boolean DEFAULT false,
    "has_audio" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lyrics_start" "text",
    "dispute_note" "text"
);


ALTER TABLE "public"."music" OWNER TO "postgres";


COMMENT ON TABLE "public"."music" IS 'main table';



CREATE OR REPLACE VIEW "public"."music_catalog" WITH ("security_invoker"='true') AS
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
    "dispute_note"
   FROM "public"."music"
  WHERE ("dispute_note" IS NULL);


ALTER VIEW "public"."music_catalog" OWNER TO "postgres";


ALTER TABLE "public"."music" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."music_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."navid_song" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" bigint NOT NULL,
    "navid_id" "text" NOT NULL,
    "suffix" "text",
    "duration" integer
);


ALTER TABLE "public"."navid_song" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."song_collation_revisers" (
    "collation_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "first_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."song_collation_revisers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."song_collations" (
    "id" bigint NOT NULL,
    "song_id" bigint NOT NULL,
    "anchor" "text" DEFAULT 'lyrics'::"text" NOT NULL,
    "anchor_index" integer,
    "anchor_time" numeric,
    "anchor_quote" "text",
    "kind" "text" NOT NULL,
    "quote" "text",
    "sung" "text",
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" "text",
    CONSTRAINT "song_collations_anchor_check" CHECK (("anchor" = ANY (ARRAY['song'::"text", 'notes'::"text", 'lyrics'::"text", 'score'::"text"]))),
    CONSTRAINT "song_collations_anchor_quote_check" CHECK (("char_length"("anchor_quote") <= 200)),
    CONSTRAINT "song_collations_body_check" CHECK (("char_length"("body") <= 4000)),
    CONSTRAINT "song_collations_check" CHECK ((("sung" IS NULL) OR ("quote" IS NOT NULL))),
    CONSTRAINT "song_collations_check1" CHECK ((("body" <> ''::"text") OR ("sung" IS NOT NULL))),
    CONSTRAINT "song_collations_date_check" CHECK (("date" ~ '^\d{4}(-\d{2}(-\d{2})?)?$'::"text")),
    CONSTRAINT "song_collations_kind_check" CHECK (((("anchor" = 'lyrics'::"text") AND ("kind" = ANY (ARRAY['slip'::"text", 'sung'::"text", 'version'::"text", 'note'::"text"]))) OR (("anchor" = 'song'::"text") AND ("kind" = ANY (ARRAY['release'::"text", 'draft'::"text", 'note'::"text"]))))),
    CONSTRAINT "song_collations_quote_check" CHECK ((("char_length"("quote") >= 1) AND ("char_length"("quote") <= 100))),
    CONSTRAINT "song_collations_sung_check" CHECK ((("char_length"("sung") >= 1) AND ("char_length"("sung") <= 100)))
);


ALTER TABLE "public"."song_collations" OWNER TO "postgres";


ALTER TABLE "public"."song_collations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."song_collations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."song_emotions" (
    "song_id" bigint NOT NULL,
    "emotion_id" smallint NOT NULL,
    "rank" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'human'::"text" NOT NULL,
    CONSTRAINT "song_emotions_rank_check" CHECK ((("rank" >= 1) AND ("rank" <= 3))),
    CONSTRAINT "song_emotions_source_check" CHECK (("source" = ANY (ARRAY['human'::"text", 'ai'::"text"])))
);


ALTER TABLE "public"."song_emotions" OWNER TO "postgres";


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
    "song_id" integer NOT NULL,
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



CREATE TABLE IF NOT EXISTS "public"."temp" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" "date",
    "title" "text" NOT NULL,
    "track" bigint DEFAULT '1'::bigint,
    "tracktotal" bigint DEFAULT '1'::bigint,
    "artist" "text"[],
    "lyricist" "text"[],
    "composer" "text"[],
    "arranger" "text"[],
    "lyrics" "text",
    "genre" "text"[] DEFAULT '{古风}'::"text"[],
    "album" "text",
    "albumartist" "text"[],
    "comment" "text",
    "length" bigint,
    "discnumber" bigint DEFAULT '1'::bigint,
    "disctotal" bigint DEFAULT '1'::bigint,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kugolink" "text",
    "type" "text"[] DEFAULT '{原创}'::"text"[] NOT NULL,
    "hascover" boolean,
    "qmlink" "text",
    "nelink" "text",
    "updated_by" "uuid" DEFAULT "auth"."uid"(),
    "nmn_status" boolean DEFAULT false,
    "lyrics_start" "text",
    "dispute_note" "text"
);


ALTER TABLE "public"."temp" OWNER TO "postgres";


COMMENT ON TABLE "public"."temp" IS 'for admin edit';



ALTER TABLE "public"."temp" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."temp_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" character varying(50) NOT NULL,
    "song_id" bigint,
    "category" character varying(100),
    "content" "text" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "reply" "text",
    "replied_by" "uuid",
    "replied_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_request_status" CHECK ((("status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('replied'::character varying)::"text", ('approved'::character varying)::"text", ('rejected'::character varying)::"text"]))),
    CONSTRAINT "chk_request_type" CHECK ((("type")::"text" = ANY (ARRAY[('song_feedback'::character varying)::"text", ('benefit_apply'::character varying)::"text", ('admin_apply'::character varying)::"text"])))
);


ALTER TABLE "public"."user_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "name" "text" DEFAULT "public"."random_user_name"() NOT NULL,
    "display" boolean DEFAULT false NOT NULL,
    "intro" "text",
    "sort_order" bigint NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "is_super" boolean DEFAULT false NOT NULL,
    "can_stream" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


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
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_user_song_key" UNIQUE ("user_id", "song_id");



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
    ADD CONSTRAINT "imagery_motifs_pkey" PRIMARY KEY ("imagery_id", "category_id");



ALTER TABLE ONLY "public"."imagery"
    ADD CONSTRAINT "imagery_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."imagery_occurrences"
    ADD CONSTRAINT "imagery_occurrences_song_imagery_motif" UNIQUE ("song_id", "imagery_id", "category_id");



ALTER TABLE ONLY "public"."imagery"
    ADD CONSTRAINT "imagery_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."imagery_occurrences"
    ADD CONSTRAINT "lyric_imagery_occurrences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."music"
    ADD CONSTRAINT "music_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."navid_song"
    ADD CONSTRAINT "navid_song_navid_id_key" UNIQUE ("navid_id");



ALTER TABLE ONLY "public"."navid_song"
    ADD CONSTRAINT "navid_song_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_results"
    ADD CONSTRAINT "quiz_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_results"
    ADD CONSTRAINT "quiz_results_user_id_quiz_version_code_key" UNIQUE ("user_id", "quiz_version", "code");



ALTER TABLE ONLY "public"."song_collation_revisers"
    ADD CONSTRAINT "song_collation_revisers_pkey" PRIMARY KEY ("collation_id", "user_id");



ALTER TABLE ONLY "public"."song_collations"
    ADD CONSTRAINT "song_collations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."song_emotions"
    ADD CONSTRAINT "song_emotions_pkey" PRIMARY KEY ("song_id", "emotion_id");



ALTER TABLE ONLY "public"."song_emotions"
    ADD CONSTRAINT "song_emotions_song_id_rank_key" UNIQUE ("song_id", "rank");



ALTER TABLE ONLY "public"."story_qjtx"
    ADD CONSTRAINT "story_qjtx_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stream_grants"
    ADD CONSTRAINT "stream_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."temp"
    ADD CONSTRAINT "temp_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "imagery_motifs_category" ON "public"."imagery_motifs" USING "btree" ("category_id");



CREATE UNIQUE INDEX "imagery_motifs_one_primary" ON "public"."imagery_motifs" USING "btree" ("imagery_id") WHERE ("role" = 'primary'::"text");



CREATE INDEX "imagery_occurrences_category_id" ON "public"."imagery_occurrences" USING "btree" ("category_id");



CREATE INDEX "imagery_occurrences_imagery_id" ON "public"."imagery_occurrences" USING "btree" ("imagery_id");



CREATE INDEX "quiz_results_user_created" ON "public"."quiz_results" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "song_collations_song" ON "public"."song_collations" USING "btree" ("song_id");



CREATE INDEX "song_emotions_emotion" ON "public"."song_emotions" USING "btree" ("emotion_id");



CREATE INDEX "stream_grants_user_time" ON "public"."stream_grants" USING "btree" ("user_id", "issued_at" DESC);



CREATE UNIQUE INDEX "users_name_unique" ON "public"."users" USING "btree" ("lower"("btrim"("name")));



CREATE OR REPLACE TRIGGER "comment_likes_sync_count" AFTER INSERT OR DELETE ON "public"."comment_likes" FOR EACH ROW EXECUTE FUNCTION "public"."comment_likes_sync_count"();



CREATE OR REPLACE TRIGGER "comments_check_reply" BEFORE INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."comments_check_reply"();



CREATE OR REPLACE TRIGGER "credit_aliases_no_chain" BEFORE INSERT OR UPDATE ON "public"."credit_aliases" FOR EACH ROW EXECUTE FUNCTION "public"."credit_aliases_no_chain"();



CREATE OR REPLACE TRIGGER "imagery_audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."imagery" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "imagery_categories_audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."imagery_categories" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "imagery_occurrences_audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."imagery_occurrences" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "on_user_role_change" AFTER INSERT OR UPDATE OF "is_admin", "is_super" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_claims_to_auth"();



CREATE OR REPLACE TRIGGER "quiz_results_keep_latest" AFTER INSERT ON "public"."quiz_results" FOR EACH ROW EXECUTE FUNCTION "public"."quiz_results_keep_latest"();



CREATE OR REPLACE TRIGGER "song_collations_record_reviser" AFTER UPDATE ON "public"."song_collations" FOR EACH ROW WHEN ((("old"."kind" IS DISTINCT FROM "new"."kind") OR ("old"."date" IS DISTINCT FROM "new"."date") OR ("old"."quote" IS DISTINCT FROM "new"."quote") OR ("old"."sung" IS DISTINCT FROM "new"."sung") OR ("old"."body" IS DISTINCT FROM "new"."body") OR ("old"."anchor_quote" IS DISTINCT FROM "new"."anchor_quote"))) EXECUTE FUNCTION "public"."song_collations_record_reviser"();



CREATE OR REPLACE TRIGGER "song_collations_stamp" BEFORE INSERT OR UPDATE ON "public"."song_collations" FOR EACH ROW EXECUTE FUNCTION "public"."song_collations_stamp"();



CREATE OR REPLACE TRIGGER "temp_audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."temp" FOR EACH ROW EXECUTE FUNCTION "public"."record_audit_log"();



CREATE OR REPLACE TRIGGER "trg_prevent_role_tampering" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_role_tampering"();



CREATE OR REPLACE TRIGGER "trigger_sync_has_audio" AFTER INSERT OR DELETE OR UPDATE ON "public"."navid_song" FOR EACH ROW EXECUTE FUNCTION "public"."update_music_has_audio"();



CREATE OR REPLACE TRIGGER "updated_at" BEFORE INSERT OR UPDATE ON "public"."temp" FOR EACH ROW EXECUTE FUNCTION "public"."updated_at"();



CREATE OR REPLACE TRIGGER "updated_by" BEFORE INSERT OR UPDATE ON "public"."temp" FOR EACH ROW EXECUTE FUNCTION "public"."updated_by"();



CREATE OR REPLACE TRIGGER "users_guard_can_stream" BEFORE INSERT OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."users_guard_can_stream"();



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."music"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."music"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."imagery_motifs"
    ADD CONSTRAINT "imagery_motifs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."imagery_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."imagery_motifs"
    ADD CONSTRAINT "imagery_motifs_imagery_id_fkey" FOREIGN KEY ("imagery_id") REFERENCES "public"."imagery"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."imagery_occurrences"
    ADD CONSTRAINT "imagery_occurrences_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."imagery_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."imagery_occurrences"
    ADD CONSTRAINT "imagery_occurrences_imagery_id_fkey" FOREIGN KEY ("imagery_id") REFERENCES "public"."imagery"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."imagery_occurrences"
    ADD CONSTRAINT "imagery_occurrences_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."music"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."navid_song"
    ADD CONSTRAINT "navid_song_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."music"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_results"
    ADD CONSTRAINT "quiz_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_collation_revisers"
    ADD CONSTRAINT "song_collation_revisers_collation_id_fkey" FOREIGN KEY ("collation_id") REFERENCES "public"."song_collations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_collation_revisers"
    ADD CONSTRAINT "song_collation_revisers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_collations"
    ADD CONSTRAINT "song_collations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."song_collations"
    ADD CONSTRAINT "song_collations_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."music"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_collations"
    ADD CONSTRAINT "song_collations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."song_emotions"
    ADD CONSTRAINT "song_emotions_emotion_id_fkey" FOREIGN KEY ("emotion_id") REFERENCES "public"."emotions"("id");



ALTER TABLE ONLY "public"."song_emotions"
    ADD CONSTRAINT "song_emotions_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."music"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stream_grants"
    ADD CONSTRAINT "stream_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_requests"
    ADD CONSTRAINT "user_requests_replied_by_fkey" FOREIGN KEY ("replied_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_requests"
    ADD CONSTRAINT "user_requests_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."music"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_requests"
    ADD CONSTRAINT "user_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Admins and supers can insert" ON "public"."imagery" FOR INSERT TO "authenticated" WITH CHECK ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Admins and supers can insert" ON "public"."imagery_categories" FOR INSERT TO "authenticated" WITH CHECK ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Admins and supers can insert" ON "public"."imagery_occurrences" FOR INSERT TO "authenticated" WITH CHECK ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Admins and supers can insert" ON "public"."temp" FOR INSERT TO "authenticated" WITH CHECK ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Admins and supers can update" ON "public"."imagery" FOR UPDATE TO "authenticated" USING ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE))) WITH CHECK ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Admins and supers can update" ON "public"."imagery_categories" FOR UPDATE TO "authenticated" USING ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE))) WITH CHECK ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Admins and supers can update" ON "public"."imagery_occurrences" FOR UPDATE TO "authenticated" USING ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE))) WITH CHECK ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Admins and supers can update" ON "public"."temp" FOR UPDATE TO "authenticated" USING ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE))) WITH CHECK ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Admins and supers can view" ON "public"."imagery" FOR SELECT TO "authenticated" USING ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Admins and supers can view" ON "public"."imagery_categories" FOR SELECT TO "authenticated" USING ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Admins and supers can view" ON "public"."imagery_occurrences" FOR SELECT TO "authenticated" USING ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Admins and supers can view" ON "public"."music" FOR SELECT TO "authenticated" USING ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Admins and supers can view" ON "public"."temp" FOR SELECT TO "authenticated" USING ((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Enable users and super admins to view data" ON "public"."users" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "id") OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "Enable users to view their own data only" ON "public"."collections" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comment_likes_select" ON "public"."comment_likes" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_select" ON "public"."comments" FOR SELECT USING (((("status" = 0) AND ("visibility" = 0)) OR (("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = ANY (ARRAY[0, 1])))));



ALTER TABLE "public"."credit_aliases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_aliases_admin" ON "public"."credit_aliases" TO "authenticated" USING (((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE)) WITH CHECK (((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE));



ALTER TABLE "public"."emotions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "emotions_admin" ON "public"."emotions" TO "authenticated" USING (((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE)) WITH CHECK (((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE));



ALTER TABLE "public"."imagery" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."imagery_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "imagery_categories_admin_delete" ON "public"."imagery_categories" FOR DELETE TO "authenticated" USING (((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE));



ALTER TABLE "public"."imagery_motifs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "imagery_motifs_admin" ON "public"."imagery_motifs" TO "authenticated" USING (((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE)) WITH CHECK (((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE));



ALTER TABLE "public"."imagery_occurrences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."music" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."navid_song" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quiz_results_select_own" ON "public"."quiz_results" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."song_collation_revisers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."song_collations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "song_collations_admin" ON "public"."song_collations" TO "authenticated" USING (((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE)) WITH CHECK (((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE));



ALTER TABLE "public"."song_emotions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "song_emotions_admin" ON "public"."song_emotions" TO "authenticated" USING (((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE)) WITH CHECK (((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE));



ALTER TABLE "public"."story_qjtx" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stream_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temp" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_requests_select" ON "public"."user_requests" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) AND (("type")::"text" = 'song_feedback'::"text")) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



CREATE POLICY "user_requests_update" ON "public"."user_requests" FOR UPDATE TO "authenticated" USING (((((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_admin'::"text"))::boolean IS TRUE) AND (("type")::"text" = 'song_feedback'::"text")) OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE))) WITH CHECK (((("type")::"text" = 'song_feedback'::"text") OR ((((( SELECT "auth"."jwt"() AS "jwt") -> 'app_metadata'::"text") ->> 'is_super'::"text"))::boolean IS TRUE)));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































REVOKE ALL ON FUNCTION "public"."approve_music_sync"("temp_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_music_sync"("temp_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."approve_music_sync"("temp_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_music_sync"("temp_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_stream_grant"("p_user_id" "uuid", "p_song_id" integer, "p_hour_limit" integer, "p_day_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_stream_grant"("p_user_id" "uuid", "p_song_id" integer, "p_hour_limit" integer, "p_day_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_stream_grant"("p_user_id" "uuid", "p_song_id" integer, "p_hour_limit" integer, "p_day_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_stream_grant"("p_user_id" "uuid", "p_song_id" integer, "p_hour_limit" integer, "p_day_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."comment_likes_sync_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."comment_likes_sync_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comment_likes_sync_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comments_check_reply"() TO "anon";
GRANT ALL ON FUNCTION "public"."comments_check_reply"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comments_check_reply"() TO "service_role";



GRANT ALL ON FUNCTION "public"."credit_aliases_no_chain"() TO "anon";
GRANT ALL ON FUNCTION "public"."credit_aliases_no_chain"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."credit_aliases_no_chain"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_comment"("p_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_comment"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_comment"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_comment"("p_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."edit_comment"("p_id" bigint, "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."edit_comment"("p_id" bigint, "p_body" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."edit_comment"("p_id" bigint, "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."edit_comment"("p_id" bigint, "p_body" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."imagery_occurrence_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."imagery_occurrence_counts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_role_tampering"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_role_tampering"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_role_tampering"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_role_tampering"() TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."sync_music_from_temp"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_music_from_temp"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_music_from_temp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_music_from_temp"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_user_claims_to_auth"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_user_claims_to_auth"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_claims_to_auth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_claims_to_auth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_music_has_audio"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_music_has_audio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_music_has_audio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."updated_by"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."updated_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."updated_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."updated_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."users_guard_can_stream"() TO "anon";
GRANT ALL ON FUNCTION "public"."users_guard_can_stream"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."users_guard_can_stream"() TO "service_role";
























GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."audit_logs" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."collections" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."collections" TO "authenticated";
GRANT ALL ON TABLE "public"."collections" TO "service_role";



GRANT SELECT,MAINTAIN,UPDATE ON TABLE "public"."comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_likes" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."comments" TO "anon";
GRANT SELECT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comments_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."credit_aliases" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."credit_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_aliases" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."emotions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."emotions" TO "authenticated";
GRANT ALL ON TABLE "public"."emotions" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imagery" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imagery" TO "authenticated";
GRANT ALL ON TABLE "public"."imagery" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imagery_categories" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imagery_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."imagery_categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."imagery_categories_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."imagery_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imagery_motifs" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imagery_motifs" TO "authenticated";
GRANT ALL ON TABLE "public"."imagery_motifs" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imagery_occurrences" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imagery_occurrences" TO "authenticated";
GRANT ALL ON TABLE "public"."imagery_occurrences" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imagery_summary_all" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imagery_summary_all" TO "authenticated";
GRANT ALL ON TABLE "public"."imagery_summary_all" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lyric_imagery_occurrences_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."music" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."music" TO "authenticated";
GRANT ALL ON TABLE "public"."music" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."music_catalog" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."music_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."music_catalog" TO "service_role";



GRANT ALL ON SEQUENCE "public"."music_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."navid_song" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."navid_song" TO "authenticated";
GRANT ALL ON TABLE "public"."navid_song" TO "service_role";



GRANT SELECT,MAINTAIN,UPDATE ON TABLE "public"."quiz_results" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_results" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."song_collation_revisers" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."song_collation_revisers" TO "authenticated";
GRANT ALL ON TABLE "public"."song_collation_revisers" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."song_collations" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."song_collations" TO "authenticated";
GRANT ALL ON TABLE "public"."song_collations" TO "service_role";



GRANT INSERT("song_id") ON TABLE "public"."song_collations" TO "authenticated";



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



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."song_emotions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."song_emotions" TO "authenticated";
GRANT ALL ON TABLE "public"."song_emotions" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."story_qjtx" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."story_qjtx" TO "authenticated";
GRANT ALL ON TABLE "public"."story_qjtx" TO "service_role";



GRANT ALL ON SEQUENCE "public"."story_qjtx_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."stream_grants" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."stream_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."stream_grants" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stream_grants_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."temp" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."temp" TO "authenticated";
GRANT ALL ON TABLE "public"."temp" TO "service_role";



GRANT ALL ON SEQUENCE "public"."temp_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_requests" TO "anon";
GRANT SELECT,MAINTAIN,UPDATE ON TABLE "public"."user_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."user_requests" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."users" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT SELECT("can_stream") ON TABLE "public"."users" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."users_sort_order_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































