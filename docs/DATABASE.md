# 数据库设计

本站数据库的目标结构、设计原则与迁移计划。新建表、改表结构、新增挂在别的数据上的表之前先读本文件。

本文是**目标**，不是现状。迁移完成前，歌曲表的现行规则见 `SONGS.md`；各部分迁到哪一步，见第八节「迁移计划」。
标「**待定**」的地方还没拍板，讨论记录在第九节。

## 一、原则

1. **身份与内容分开。** 一个东西先有一张身份表，只回答「这是哪一个」；会变的内容另放。所有外键指向身份表，
   内容怎么改、改几版，都不牵动挂在它上面的数据。
2. **只存事实，派生的算出来。** 能由别的数据算出的东西不存：存了就会与源头对不上，还得有人维护。
   确有性能理由要存的，标明是缓存、由谁维护，写进第七节的缓存清单。
3. **状态一列，转换走函数。** 有生命周期的东西用一列文本表示状态；状态只经数据库函数转换，函数里检查前置条件与权限。
4. **引用必有外键，类型一致。** 唯一的例外是快照（记录某一时刻的结果，事后不随源头变），在表注释里写明。
5. **审核以整首歌为单位。** 编校数据不分人写的、AI 写的，也没有逐条确认：人审核一首歌就是审核它的全部，发布就是一起发布。
   谁在何时改了什么，由审计日志与版本记录。
6. **同类问题一种写法。** 主键、枚举、时间戳、审计、视图各有约定（第七节），新表照着来。

## 二、全貌

```
歌曲 ─┬─ 版本：资料 + 编校        songs ─ song_versions ─┬─ song_imagery    意象标注
      │                                                  ├─ song_emotions   基调
      │                                                  └─ song_collations 校记与补遗
      ├─ 外部平台 id              song_external_ids
      ├─ 音频                    song_audio
      └─ 读者：评论、收藏、反馈      comments · collections · user_requests

意象体系   imagery（词） · imagery_categories（分类树） · imagery_motifs（词 → 母题）
基调词表   emotions
用户      users（auth.users 的扩展）
署名      credit_aliases（待定：是否升级为「人」，见第九节）
独立内容   story_qjtx · quiz_results · stream_grants · audit_logs
```

挂在歌上的数据分两类，挂的地方不同：

|                                                 | 挂在哪               | 随发布吗                           |
| ----------------------------------------------- | -------------------- | ---------------------------------- |
| 资料、编校数据（意象、基调、校记与补遗）        | 版本 `song_versions` | 随：在草稿上改，发布时一起上线     |
| 读者数据（评论、收藏、反馈）、音频、外部平台 id | 歌 `songs`           | 不随：属于这首歌本身，与哪一版无关 |

## 三、歌曲与版本

### 模型

- 一首歌有**至多一个草稿**和**若干已发布的版本**，线上用其中最新发布的那个。
- 草稿可以随便改：保存就是覆盖草稿，不留历史。填一项存一下也不会多出数据。
- 发布时草稿**冻结**成版本，此后不能再改；再要修改，就从线上版本复制出一份新草稿。
- 版本包含这首歌的**资料与全部编校数据**：审核一首歌就是审核它的全部，发布就是一起发布（原则 5）。
  agent 不论给新歌还是老歌写东西，都写在草稿上，人看过、发布了才上线。

### 表

```sql
songs                                -- 身份与状态
  id                     bigint identity primary key
  status                 text check (status in ('draft', 'published', 'unpublished'))
  published_version_id   bigint references song_versions   -- 线上的版本；从没发布过为空
  draft_version_id       bigint references song_versions   -- 正在改的草稿；没有为空
  created_at, created_by
  check ((status = 'draft') = (published_version_id is null))

song_versions                        -- 资料
  id                     bigint identity primary key
  song_id                bigint not null references songs on delete cascade
  title, date, album, track, tracktotal, discnumber, disctotal,
  artist[], lyricist[], composer[], arranger[], albumartist[],
  genre[], type[], length, lyrics, lyrics_start, comment, dispute_note,
  hascover, nmn_status
  published_at           timestamptz    -- 空 = 草稿；非空 = 已冻结
  created_at, created_by
  updated_at, updated_by                -- 草稿最后一次保存

song_external_ids                    -- 各平台上的这首歌
  platform               text check (platform in ('netease', 'qq', 'kugou'))
  external_id            text
  song_id                bigint not null references songs on delete cascade
  primary key (platform, external_id)

song_audio                           -- 原 navid_song
  song_id                bigint primary key references songs on delete cascade
  navid_id               text unique not null
  suffix, duration
```

- **冻结由数据库保证**：`published_at` 非空的版本，以及挂在它上面的编校数据，触发器拒绝修改。
- **「有未发布的改动」= `draft_version_id` 非空**，不用逐字段比对。草稿只在真有写入时才开（见下），打开看看不会开出草稿。
- 资料字段只在 `song_versions` 定义一次。现在 `temp`、`music` 两份列清单加上 `approve_music_sync` 里手抄的一份，三处要同步改，这个问题随之消失。
- 外部平台 id 是身份信息，不进版本。平台 id 唯一，agent 盯新发布时按它去重，不会重复建歌；链接由视图按平台与 id 拼出来。
- `has_audio` 不存：视图里按 `song_audio` 有没有这首歌算出来。触发器 `update_music_has_audio` 与音频同步里写 `has_audio` 的代码一起删掉。
- `hascover`、`nmn_status` 是「有没有封面、简谱」的标记，现在靠表单里手勾，与实际上传的文件可能对不上。
  先原样放进版本；以后要做素材表时再改成由文件算出（第九节）。

### 生命周期

所有写操作都经数据库函数，函数里检查前置条件与权限。

| 操作     | 函数                                           | 前置条件                               | 结果                                                               | 权限               |
| -------- | ---------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------ | ------------------ |
| 新建     | `create_song(资料)`                            | —                                      | 一首 `draft` 的歌 + 它的草稿                                       | 管理员（含机器人） |
| 开草稿   | `ensure_draft(song_id)`                        | —                                      | 已有草稿就返回它；没有就复制线上版本的资料与编校数据，开一份新草稿 | 管理员（含机器人） |
| 保存资料 | `save_draft(song_id, 资料, 基于的 updated_at)` | `updated_at` 与草稿一致，否则冲突      | 覆盖草稿                                                           | 管理员（含机器人） |
| 放弃草稿 | `discard_draft(song_id)`                       | 已发布过（从没发布过的歌要用「删除」） | 删掉草稿及其编校数据，回到线上版本                                 | 管理员             |
| 发布     | `publish_song(song_id)`                        | 有草稿；或已下架（直接重新上线原版本） | 草稿冻结并成为线上版本，`published`                                | 管理员             |
| 下架     | `unpublish_song(song_id)`                      | `published`                            | `unpublished`；版本、草稿、读者数据都保留                          | 超管               |
| 删除     | `delete_song(song_id)`                         | 不是 `published`                       | 歌及挂在上面的一切级联删除                                         | 超管               |

- 写编校数据（加一条标注、改基调、写补遗）的函数都先调 `ensure_draft`，写在草稿上。
- 保存用「基于哪一次保存」（`updated_at`）做乐观锁：两个人（或人与 agent）同时改同一份草稿时，后存的会收到冲突。
- 历史：发布过的版本全部保留，可以看每次发布的样子、比对两次发布的差别。草稿期间的保存不留历史。
- 状态转换（发布、下架、删除、放弃草稿）由函数写一条审计日志。

### 视图

视图一律写明列名，不用 `select *`：`select *` 的视图在建立时就固定了列，表加列后视图不会跟着变。

| 视图                        | 内容                                                                    | 谁读                                           |
| --------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| `published_songs`           | `status = 'published'` 的歌 + 线上版本的资料 + `has_audio` + 各平台链接 | 公开端                                         |
| `catalog`                   | `published_songs` 去掉 `dispute_note` 非空的                            | 以曲库为整体的功能：统计、推荐、寻曲、意象索引 |
| `published_song_imagery` 等 | 线上版本的编校数据，带上 `song_id`                                      | 公开端                                         |
| `working_songs`             | 每首歌的工作版本（有草稿用草稿，否则用线上版本）+ 状态 + 有无未发布改动 | 后台                                           |
| `working_song_imagery` 等   | 工作版本的编校数据，带上 `song_id`                                      | 后台                                           |

`published_songs` 的列与现在的 `music` 保持一致，公开端的代码只换表名。

### 规则（取代 `SONGS.md` 的两张表规则）

1. 公开端只读 `published_*` 视图与 `catalog`，不碰表。编校数据的视图已经只含线上版本，不用再自己过滤「歌发布了没有」。
2. 后台读 `working_*` 视图；写只经上表的函数。
3. 新增挂在歌上的表，先判断属于哪一类（第二节）：随发布的挂 `song_versions`，并在开草稿时一起复制、补上两种视图；
   不随发布的挂 `songs`，公开端读它时经 `published_songs` 把关。

## 四、编校数据

意象标注、基调、校记与补遗。都挂在版本上，在草稿里写，随发布上线。

- 不分来源：人写的、agent 写的同样对待，表里不记 `human` / `ai`，也不逐条确认。
- 去掉现有的区分：`song_emotions.source` 列，以及后台基调栏「AI 预标待确认」的提示与「确认」按钮。
- 谁写的：各表有 `created_by`（agent 写的就是机器人账号）。

### 意象标注：`imagery_occurrences` → `song_imagery`

```sql
song_imagery
  version_id   bigint references song_versions on delete cascade
  imagery_id   bigint references imagery
  category_id  bigint references imagery_categories    -- 母题
  created_by, created_at
  primary key (version_id, imagery_id, category_id)
```

- **时间标签不存。** 按 `IMAGERY.md`，时间标签就是「词字面出现的那几行」，由歌词与同曲各词算出（`songTimetags`）。
  标注和它对应的歌词在同一个版本里，读的时候按这一版的歌词算，永远对得上；「发布时重算标签」也不需要了。
- **「同时算进」不存。** 一条标注挂在词的「通常算作」上时，它的「同时算进」各母题由 `imagery_motifs` 决定，读的时候展开。
  现在 `addParts` 补写的那几行，以及改词、改母题、删除时的连带维护，都不需要了。
- 主键用自然键，去掉代理 id；后台按 (歌, 词) 定位一行。

### 基调 `song_emotions`

`song_id` 改为 `version_id`；去掉 `source`，加 `created_by`。

### 校记与补遗 `song_collations`

`song_id` 改为 `version_id`，其余不变。订者名单 `song_collation_revisers` 跟着校记走，开草稿时一起复制。

校记锚在同一版本的歌词上，版本冻结后不会错位。草稿里改了歌词，后台按引文核对，标出对不上的校记，发布前处理。

### 评点的锚点

评点挂在歌上（不随发布），锚的是写下时线上那一版的歌词。加 `anchor_version_id`：
显示时锚定的版本就是线上版本，直接用行号；不是，按引文在线上版本里找行，找不到的归到整首歌。

## 五、意象体系

- `imagery`（词）：不变。
- `imagery_categories`（分类树）：
  - `parent_id` 改为 `bigint references imagery_categories`。现在没有外键，类型还与 `id` 不一致，树的完整性没有任何保证。
  - `level` 不存，由视图按父链算（表只有几百行）。「母题 = 第三级」照旧，由函数在写入时检查。
- `imagery_motifs`：不变，补审计触发器（现在只有它没有）。
- `imagery_summary_all`：不变。

## 六、用户与互动

### 用户 `users`

- `is_admin`、`is_super` 两个布尔合成一列 `role text check (role in ('user', 'admin', 'super'))`。
  现在能组合出「超管但不是管理员」这种不合法的状态（`withAuth` 会拒绝他）。
  同步到 JWT 的 `app_metadata.role`；RLS 策略与 `withAuth` 改读这一个字段。
- `can_stream` 不变。
- 贡献者的公开资料（`display`、`intro`、`sort_order`）与账号同表：可以拆出，不急（第九节）。

### 评点 `comments`

- `status`（0–3）、`visibility`（0–1）改为文本：`'normal' | 'pending' | 'hidden' | 'deleted'`、`'public' | 'private'`。
- `like_count` 是计数缓存，由 `comment_likes` 上的触发器维护，保留。
- 锚点加 `anchor_version_id`（第四节「评点的锚点」）。

### 其他

| 表                                                          | 改动                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `collections`                                               | 去掉用不上的 uuid 主键，主键改为 `(user_id, song_id)`，与 `comment_likes` 一致 |
| `user_requests`                                             | 混了歌曲反馈与两种权限申请，拆分**待定**（第九节）                             |
| `quiz_results`                                              | `song_ids` 是测试结果的快照，不加外键，注释写明                                |
| `stream_grants`                                             | 限流日志，不加外键；`song_id` 改为 `bigint` 与歌曲 id 一致                     |
| `story_qjtx`、`emotions`、`comment_likes`、`credit_aliases` | 不变                                                                           |

## 七、约定

**主键。** 实体用 `bigint generated always as identity`；关系表用自然的复合主键；`users` 跟 `auth.users` 用 uuid；
要出现在分享链接里的用短文本 id（`quiz_results`）。不为关系表另加代理键。

**枚举。** 一律 `text` + `check`。状态、类型这类代码值用英文小写；领域词汇本身是中文的（基调的明暗、扬抑）照用中文。
不用数字代码，不用 Postgres 的 enum 类型（改值要重建类型）。

**时间戳。** 每张表有 `created_at`。行会被修改、且有人读修改时间的，才加 `updated_at`，由触发器维护。

**审计。**

- 歌曲的资料与编校数据：发布过的版本即历史；草稿期间的保存不留历史，也不审计（开草稿时整份复制，逐行审计只是噪音）。
- 歌曲的状态转换：由生命周期函数各写一条审计。
- 意象体系（词、分类、母题登记）与署名别名：`record_audit_log` 触发器，全部挂上。
- 用户产生的内容（评点、收藏、测试结果）：不审计。

**视图。** 写明列名，不用 `select *`；公开端读的视图用 `security_invoker`。

**权限。**

- 公开端：服务端用 service role 读视图。
- 后台：用管理员本人的 JWT，经 RLS；生命周期操作走 `SECURITY DEFINER` 函数，函数里按 `role` 检查。
- 普通用户的写入：经服务端接口，用 service role；RLS 不给 `authenticated` 直接写用户可见的表。
- 新表、新函数都在 migration 里显式授权，不依赖默认权限（`20261113130000` 起函数默认不再授予 anon / authenticated）。

**缓存清单**（存了派生数据的地方，改源头时记得它们）：

| 存在哪里                | 由什么算出             | 谁维护                            |
| ----------------------- | ---------------------- | --------------------------------- |
| `comments.like_count`   | `comment_likes` 的行数 | 触发器 `comment_likes_sync_count` |
| JWT `app_metadata.role` | `users.role`           | 触发器 `sync_user_claims_to_auth` |

## 八、迁移计划

这次重构**允许整站中断**，不做无缝迁移：每一段都是「批准 migration → 立即部署代码」，两步之间站点可能报错，
不写兼容旧结构的过渡代码，旧表在同一个 migration 里删掉。

分段只是为了每次改动能看得过来。各段的 migration 与代码一起审、一起上；相邻两段也可以合并成一次停机。

上线前：备份数据库（Supabase 的时间点恢复或手动导出），并在 PR 的 CI 里用空库重放全部 migration 确认能跑通。
回填类的 migration 在末尾用断言核对行数（如「`songs` 行数 = 原 `temp` 行数」），对不上就整体回滚。

### 第一段：歌曲、版本与编校（agent 依赖这一段）

内容：第二至四节全部，包括时间标签与「同时算进」改为读时计算（编校表本来就要重建，一并做掉，免得迁两遍）。

**migration**

- 建 `songs`、`song_versions`、`song_external_ids`、`song_audio`，重建三张编校表（外键改指版本），建全部视图与生命周期函数、冻结触发器。
- 回填，id 沿用 `temp` 的：
  - 每首 `temp` 里的歌建一行 `songs`。
  - `music` 里有的：以 `music` 的内容建一个已冻结的版本，设为线上版本；现有的编校数据挂到这个版本上。
    `temp` 与 `music` 内容不同的，再以 `temp` 的内容开一份草稿，编校数据复制一份过去。
  - 不在 `music` 里的：以 `temp` 的内容建草稿，状态 `draft`。
  - 三个链接字段拆进 `song_external_ids`；`navid_song` 搬进 `song_audio`。
  - 意象标注只搬「主条」：`addParts` 补写的「同时算进」各行、`lyric_timetag` 都不搬。
- 读者表（评论、收藏、反馈）的外键改指 `songs`（id 不变，直接改约束）。
- 停掉每日同步（`cron.unschedule('Update music')`）。
- 删 `temp`、`music`、`navid_song`、`imagery_occurrences`、`music_catalog`、`approve_music_sync`、`sync_music_from_temp`、`update_music_has_audio`。
- 末尾断言：`songs` 行数 = 原 `temp` 行数；线上版本数 = 原 `music` 行数；标注主条数一致。

**代码**

- 公开端改读 `published_*` 视图与 `catalog`；时间标签与「同时算进」改为读时计算。
- 后台改读 `working_*` 视图，写走生命周期函数；发布、下架、放弃草稿、删除的界面；去掉基调的「待确认」。
- 删 `syncSongTimetags`、`resyncSongTimetags`、`addParts` 及发布时重算标签的步骤。
- agent 用的接口。

已写好、未上线的「编校数据改挂 `temp`」（`20261113140000_editorial_on_temp.sql` 及配套代码）作废，不上线。

### 第二段：小项（各自独立，顺序随意）

- `imagery_categories` 加父外键，`level` 改由视图算。
- 评点：状态与可见性改文本，锚点加 `anchor_version_id`。
- `users.role` 取代 `is_admin` / `is_super`。
- `collections` 改主键。
- `stream_grants.song_id` 改类型。
- 补审计触发器（`imagery_motifs`、`credit_aliases`）。
- 公开端读的表与视图收回 anon / authenticated 的写权限（纵深防御）。

### 第三段：按需

第九节里定下来要做的。

## 九、待讨论

已定（2026-11-13）：

- 编校数据不分人写、AI 写，不逐条确认；审核以整首歌为单位，发布就是一起发布（原则 5）。
- 编校数据随版本：草稿可改、发布即冻结；保存覆盖草稿，不留历史（第三节）。
- 这次重构允许整站中断，不做无缝迁移（第八节）。

还没定：

1. **外部链接要不要随发布？** 现在链接在资料里，要发布才上线。设计里外部 id 是身份信息、挂在歌上，保存即上线（对已发布的歌）；
   要随发布的话就挂到版本上，代价是按平台 id 去重时要看「任一版本」。
2. **机器人能不能发布？** 目前设计为只写不发布，发布由人来。
3. **「下架」之后是回到 `draft` 还是单独的 `unpublished`？** 设计里单独一个状态，后台能区分「从没发布过」与「下架了」。
4. **人与署名。** 署名现在是五个名字数组，`credit_aliases` 在读取时把别名归到主名，是在弥补「人」没有身份。
   完整的设计是「人」一张表，「哪一版、什么角色、谁、原署作什么」一张表，别名即同一人的不同原署。
   要不要做，取决于有没有按人浏览、人物页这类需求。
5. **专辑。** 曲序、碟号、专辑艺人、日期都在每首歌上重复存。要做专辑页时值得建表，否则不必。
6. **素材表。** 封面、简谱是哪个文件、何时上传，记一张表，`hascover` / `nmn_status` 由它算出，不再手勾。
7. **拆 `user_requests`。** 歌曲反馈是关于歌的，播放权限、管理员申请是关于权限的，流程也不同。
8. **贡献者资料拆出 `users`。**
9. **版本对比与回退的界面要不要做？** 发布过的版本全部保留（每发布一次一行，数据量很小），界面上看不看、能不能回退到旧版本，可以以后再定。
