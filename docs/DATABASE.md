# 数据库

本站数据库的结构与约定。新建表、改表结构、新增挂在别的数据上的表之前先读本文件。完整的表结构看 `supabase/schema.sql`（CI 生成，不要手改）。

## 原则

1. **身份与内容分开。** 歌有一张身份表，只回答「这是哪一首」；会变的内容放在版本里。读者数据指向身份，内容怎么改都不牵动它们。
2. **只存事实，能算的不存。** 存了就会与源头对不上，还得有人同步。确有理由要存的，写进「约定」里的缓存清单。
3. **状态由事实得出。** 「在线」「有未发布改动」「已下架」都从指针与版本算出，不另设状态列。
4. **规则尽量由结构保证。** 能用外键、唯一索引表达的，不靠约定和代码检查。
5. **审核以整首歌为单位。** 编校数据不分人写的、agent 写的，也不逐条确认：人审核一首歌就是审核它的全部，发布就是一起发布。agent 只写草稿，不能发布。
6. **公开端只读视图。** 「只看线上版本」这个条件写在视图里，不靠每处查询自己记得加。

## 全貌

```
歌 songs ─┬─ 版本 song_versions ─┬─ song_imagery     意象标注
          │   （资料）            ├─ song_emotions    基调
          │                      └─ song_collations  校记与补遗（+ 订者名单）
          ├─ song_links    各平台链接
          ├─ song_audio    音频
          └─ 读者数据       comments · collections · user_requests · stream_grants

意象体系   imagery_categories（类别）─ motifs（母题）─ imagery_motifs ─ imagery（词）
基调词表   emotions
用户      users
署名      credit_aliases
独立内容   story_qjtx · quiz_results · audit_logs
```

挂在歌上的数据分两类：

| | 挂在哪 | 随发布吗 |
|---|---|---|
| 资料（含封面、简谱的选项）、意象标注、基调、校记与补遗 | 版本 `song_versions` | 随：在草稿上改，发布时一起上线 |
| 链接、音频、读者数据 | 歌 `songs` | 不随：属于这首歌本身，保存即生效 |

新增挂在歌上的表，先判断属于哪一类。随发布的要做三件事：外键指 `song_versions`、加进 `ensure_draft` 的复制、补 `published_` 视图。

## 歌曲与版本

### 表

```sql
songs
  id               bigint identity primary key
  live_version_id  bigint null          -- 线上版本；空 = 不在线上
  created_at, created_by
  foreign key (id, live_version_id) references song_versions (song_id, id)  -- 只能指向自己的版本

song_versions
  id               bigint identity primary key
  song_id          bigint not null references songs on delete cascade
  title, date, album, track, tracktotal, discnumber, disctotal,
  artist[], lyricist[], composer[], arranger[], albumartist[],
  genre[], type[], length, lyrics, lyrics_start, comment, dispute_note,
  hascover, nmn_status                   -- 封面三选一（见下）、有无简谱
  published_at     timestamptz null     -- 空 = 草稿；非空 = 已冻结
  created_at, created_by, updated_at, updated_by
  unique (song_id, id)
  unique (song_id) where published_at is null    -- 每首歌至多一个草稿
```

- 一个版本一行：草稿至多一行，保存就是覆盖它，不留历史；每发布一次多一行冻结的版本。
- 历史版本全部保留，不参与任何读取，只备查。
- 冻结的版本及挂在它上面的编校数据，触发器拒绝修改与删除（删歌时的级联除外）。
- `hascover` 是**三选一的封面**，不是「有没有封面文件」：空 = 白底狐狸（默认图）、false = 初号机（黑底占位图）、true = 定制封面（R2 上的 `cover/{id}.jpg`）。这是人的选择，算不出来，所以留在版本里随发布上线；`nmn_status` 同理。

### 状态

| 状态 | 判断 |
|---|---|
| 在线 | `live_version_id` 非空 |
| 从未发布 | `live_version_id` 为空，且没有冻结版本 |
| 已下架 | `live_version_id` 为空，但有冻结版本 |
| 有未发布的改动 | 存在草稿 |

### 生命周期

除「保存草稿」外都经数据库函数，函数里检查前置条件与权限，并写一条审计日志。

| 操作 | 做法 | 前置条件 | 结果 | 谁能做 |
|---|---|---|---|---|
| 新建 | `create_song(资料)` | — | 一首歌 + 它的草稿 | bot 及以上 |
| 开草稿 | `ensure_draft(song_id)` | — | 已有草稿就返回它；没有就复制最新冻结版本的资料与编校数据 | bot 及以上 |
| 保存草稿 | 直接改草稿那一行 | `updated_at` 未变（乐观锁） | 覆盖草稿 | bot 及以上 |
| 放弃草稿 | `discard_draft(song_id)` | 有冻结版本 | 删掉草稿及其编校数据 | admin 及以上 |
| 发布 | `publish_song(song_id)` | 有草稿 | 草稿冻结，`live_version_id` 指向它 | admin 及以上 |
| 重新上线 | `publish_song(song_id)` | 已下架且没有草稿 | `live_version_id` 指回最新的冻结版本 | admin 及以上 |
| 下架 | `unpublish_song(song_id)` | 在线 | `live_version_id` 置空；版本、草稿、读者数据都保留 | super |
| 删除 | `delete_song(song_id)` | 不在线 | 歌及挂在上面的一切级联删除 | super |

- 写编校数据的接口先调 `ensure_draft`，写在草稿上。只是打开看看不会开出草稿。
- 函数按 JWT 里的角色检查，不只靠接口层拦。

### 链接与音频

```sql
song_links
  song_id   bigint references songs on delete cascade
  platform  text check (platform in ('netease', 'qq', 'kugou'))
  url       text not null
  primary key (song_id, platform)
  unique (platform, url)                  -- 同一个链接不能挂在两首歌上

song_audio
  song_id   bigint primary key references songs on delete cascade
  navid_id  text unique not null
  suffix, duration, created_at
```

链接与音频是这首歌本身的事实，不随版本，保存即生效。agent 给已发布的歌补的链接因此不经审核就上线，这是接受的取舍。`has_audio` 不存，由视图按 `song_audio` 算。

### 视图

视图一律写明列名，用 `security_invoker`。

| 视图 | 内容 | 谁读 |
|---|---|---|
| `published_songs` | 在线的歌 + 线上版本的资料 + `has_audio` + 三个链接列 + `version_id`；`updated_at` 是发布时间 | 公开端 |
| `catalog` | `published_songs` 去掉 `dispute_note` 非空的 | 统计、推荐、寻曲、意象索引、登录画廊 |
| `published_song_imagery` | 线上版本的意象标注，带 `song_id`、读时展开的 `part_motif_ids` | 公开端 |
| `published_song_emotions` | 线上版本的基调，带 `song_id` | 公开端（意象索引、寻曲） |
| `working_songs` | 每首歌的工作版本（有草稿用草稿，否则用最新冻结版本）+ `version_id`、`is_live`、`has_draft`、`ever_published` | 后台、agent |
| `working_song_imagery` | 工作版本的意象标注，带 `song_id`、歌名、词名、母题名、`part_motif_ids` | 后台意象库的跨歌查询 |
| `imagery_summary_all` | 全部词及标注条数，按工作版本统计 | 后台词典 |

- 按单首歌读基调、校记时，先从 `published_songs` 或 `working_songs` 拿到版本 id，再按 `version_id` 直接查表，不另设视图。
- 函数 `imagery_occurrence_counts` 也按工作版本统计，否则草稿与线上版会重复计数。
- 争议歌曲照常标注，汇总时由 `catalog` 排除。

## 编校数据

三张表都挂在版本上，开草稿时整份复制，发布时一起上线。

**行的 id 在各版本间不变。** 开草稿时连 id 一起复制，主键是 `(version_id, id)`。后台拿着的 id 在开草稿前后都有效：写的时候先开草稿，再按 `(草稿的 version_id, id)` 定位。校记、订者名单靠这个对上，也方便比对两个版本。

```sql
song_imagery
  version_id  bigint references song_versions on delete cascade
  id          bigint identity             -- 各版本间不变
  imagery_id  bigint references imagery on delete cascade
  motif_id    bigint references motifs on delete cascade
  created_at, created_by
  primary key (version_id, id);  unique (version_id, imagery_id)   -- 一个版本里一个词一条

song_emotions
  version_id, emotion_id, rank, created_at, created_by
  primary key (version_id, emotion_id);  unique (version_id, rank)

song_collations
  primary key (version_id, id)            -- id 各版本间不变
song_collation_revisers                   -- (version_id, collation_id, user_id)，跟着校记一起复制
```

- **时间标签不存，读时在服务端算。** 标签就是「词在本曲字面出现的那几行」（见 `IMAGERY.md`），由 `songTimetags` 按同一版本的歌词算出，返回给前端时叫 `lyric_timetag`。公开端在意象索引里算好再缓存，后台读标注时现算。
- **「同时算进」不存，读时展开。** 标注挂在词的 `primary` 母题上时，它的 `part` 各母题由 `imagery_motifs` 决定，视图算成一列 `part_motif_ids`（一条标注仍是一行）。挂在 `alternative` 上的不展开。
- 草稿里改了歌词，后台按引文核对校记、按字面核对标注，标出对不上的，发布前处理。
- 评点（`comments`）挂在歌上，锚点按行号 + 引文重定位，不记版本。

## 意象体系

标注规范见 `IMAGERY.md`。

```sql
imagery_categories                        -- 十七个类别，固定
  id, name unique, description, created_at
  domain  text check (domain in ('自然', '人文', '情志'))     -- 门类

motifs                                    -- 母题；id 出现在 /imagery/[id] 的地址里
  id, name unique, created_at
  category_id  bigint not null references imagery_categories
  description  text                       -- 后台新建时必填；早期建的大多没写，所以库里允许空

imagery                                   -- 词
imagery_motifs                            -- 词 → 可取的母题（primary / alternative / part），motif_id on delete restrict
```

- 「标注只能挂在母题上」由外键保证。
- 类别固定，后台只读（没有 insert、update、delete 的策略），增减走 migration。
- 门类只是一列：代码里门类只按名字用（配色顺序、后台类别栏、分类路径），不进地址、不落库，不需要成表。

## 用户与角色

`users.role` 是 `user / bot / admin / super`，逐级包含：

- `bot`（agent 的账号）：后台的读写，但不能发布、下架、删除，也不处理用户请求。
- `admin`：再加发布与放弃草稿。
- `super`：再加下架、删除与用户管理。

`role` 由触发器同步到 JWT 的 `app_metadata.role`，RLS 与 `withAuth` 都读它。改了角色要重新登录才生效。新账号默认是 `user`，在后台「用户」里改。

读者数据（收藏、评点、纠错、试听领取）挂在 `songs` 上，歌下架后数据仍在。公开端写之前都调 `isSongPublished`（`service-songs.ts`），不在线返回 404。

`quiz_results.song_ids` 是测试结果的快照，不加外键。

## 约定

**主键。** 实体用 `bigint` identity；关系表用自然的复合主键，不另加代理键；`users` 跟 `auth.users` 用 uuid；出现在分享链接里的用短文本 id（`quiz_results`）。`credit_aliases` 以别名本身为主键（一个别名只归到一个主名）。

**枚举。** `text` + `check`。代码值用英文小写；领域词汇本身是中文的（门类、基调的明暗扬抑）照用中文。不用数字代码，不用 enum 类型。例外：`song_versions.hascover` 是三值的 boolean，在每个冻结的版本里，公开端处处在用，改成文本不值。

**列名。** `albumartist`、`comment`、`nmn_status` 等沿用，不为好看改名。

**时间戳。** 每张表有非空的 `created_at`，行是什么时候建的就记什么时候（订者名单里是第一次订正的时间，试听记录里是领取的时间）。行会被修改且有人读修改时间的才加 `updated_at`，由触发器维护（`song_versions`、`song_collations`）。某件事发生的时间另起有意义的名字：`published_at`、`replied_at`、`edited_at`。

**外键。** 引用必有外键，类型与被引用的列一致。例外只有快照，在列注释里写明（`quiz_results.song_ids`）。指向用户的「谁做的」一律 `on delete set null`（`created_by`、`updated_by`、`replied_by`、`audit_logs.user_id`）：人删了，记录留着。用户外键指 `public.users`，不指 `auth.users`。

**权限。**

- `anon`、`authenticated` 在表上、函数上的默认权限都已收回，新建的表、函数不在 migration 里显式授权就谁都用不了（`service_role` 也要写明）。
- `anon` 在任何表、视图上都没有权限。`authenticated` 只有代码里用本人 JWT 做的那些事。有 RLS 策略却没有授权的，策略删掉，不留看似生效的规则。
- 公开端：服务端用 service role 读视图。
- 后台与 agent：用本人的 JWT，经 RLS；生命周期函数是 `SECURITY DEFINER`，函数里按 JWT 的角色检查。
- 普通用户的写入：经服务端接口，用 service role（限流、校验都在接口里，直连 PostgREST 写不进去）。本人的读用自己的会话，经 RLS。

**审计。** `record_audit_log` 触发器挂在：草稿的保存、三张编校表、`song_links`、意象体系四张表、`emotions`、`credit_aliases`。`ensure_draft` 的整份复制不记（函数里设会话标记 `hetu.copying`，触发器跳过）；删歌、放弃草稿连带删掉的行也不记。生命周期操作由函数各记一条（`table_name = songs`）。读者数据不审计。日志保留 90 天。

**缓存清单**（存了派生数据的地方）：

| 存在哪里 | 由什么算出 | 谁维护 |
|---|---|---|
| `comments.like_count` | `comment_likes` 的行数 | 触发器 `comment_likes_sync_count` |
| JWT `app_metadata.role` | `users.role` | 触发器 `sync_user_claims_to_auth` |

## 刻意不做

| 不做 | 现在的做法 | 什么时候再做 |
|---|---|---|
| 「人」表 | 署名是版本里的名字数组，`credit_aliases` 归并别名 | 要做人物页时 |
| 专辑表 | 专辑名、曲序、碟号存在每首歌上 | 要做专辑页时 |
| 拆 `user_requests` | 歌曲反馈与两种权限申请共用一张表 | 流程明显分叉时 |
| 评点记锚定的版本 | 按行号 + 引文重定位 | 重定位不够准时 |

## 改表的流程

1. 在 `supabase/migrations/` 手写 migration。新表、新函数写明授权；回填数据的在末尾用断言核对行数，对不上就整体回滚。
2. 本地没有 Docker，在 PGlite 里重放验证：桩出 Supabase 的 `auth`、`cron`、角色，跑全部迁移，塞样本数据后核对。
3. 开 PR：CI（`db.yml`）在空库上重放全部迁移，把结果导出成 `supabase/schema.sql` 提交回 PR 分支。
4. 合并到 main 后，`db.yml` 经 `production` 环境审批再推到线上。只影响后台的改动不做无缝兼容，按「迁移 → 部署代码」的顺序上线。
