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
5. **编校数据都记来源。** 谁写的、人写的还是 AI 写的、谁在何时确认的，所有编校表一个写法。
6. **同类问题一种写法。** 主键、枚举、时间戳、审计、视图各有约定（第七节），新表照着来。

## 二、全貌

```
歌曲 ─┬─ 版本（内容）            songs ─ song_revisions
      ├─ 外部平台 id              song_external_ids
      ├─ 音频                    song_audio
      ├─ 编校：意象、基调、校记      song_imagery · song_emotions · song_collations
      └─ 读者：评论、收藏、反馈      comments · collections · user_requests

意象体系   imagery（词） · imagery_categories（分类树） · imagery_motifs（词 → 母题）
基调词表   emotions
用户      users（auth.users 的扩展）
署名      credit_aliases（待定：是否升级为「人」，见第九节）
独立内容   story_qjtx · quiz_results · stream_grants · audit_logs
```

所有「挂在歌上」的表，外键一律指向 `songs.id`。公开端能不能看到它们，跟着歌的状态走（第三节）。

## 三、歌曲

### 表

```sql
songs                                -- 身份与状态
  id                     bigint identity primary key
  status                 text  check (status in ('draft', 'published', 'unpublished'))
  published_revision_id  bigint references song_revisions   -- 线上用哪一版
  published_at           timestamptz
  created_at, created_by
  check (status <> 'published' or published_revision_id is not null)

song_revisions                       -- 内容：每次保存追加一行，只增不改
  id                     bigint identity primary key
  song_id                bigint not null references songs on delete cascade
  base_revision_id       bigint references song_revisions   -- 基于哪一版改的
  title, date, album, track, tracktotal, discnumber, disctotal,
  artist[], lyricist[], composer[], arranger[], albumartist[],
  genre[], type[], length, lyrics, lyrics_start, comment, dispute_note,
  hascover, nmn_status
  source                 text check (source in ('human', 'ai'))
  created_at, created_by

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

- 资料字段只在 `song_revisions` 定义一次。现在 `temp`、`music` 两份列清单加上 `approve_music_sync` 里手抄的一份，三处要同步改，这个问题随之消失。
- 草稿就是每首歌最新的一版，不单独存。「有未发布的改动」= 最新一版不是 `published_revision_id`，不用逐字段比对。
- 外部平台 id 是身份信息，不进版本。平台 id 唯一，agent 盯新发布时按它去重，不会重复建歌；链接由视图按平台与 id 拼出来。
- `has_audio` 不存：视图里按 `song_audio` 有没有这首歌算出来。触发器 `update_music_has_audio` 与音频同步里写 `has_audio` 的代码一起删掉。
- `hascover`、`nmn_status` 是「有没有封面、简谱」的标记，现在靠表单里手勾，与实际上传的文件可能对不上。
  先原样放进版本；以后要做素材表时再改成由文件算出（第九节）。

### 视图

视图一律写明列名，不用 `select *`：`select *` 的视图在建立时就固定了列，表加列后视图不会跟着变。

| 视图              | 内容                                                                  | 谁读                                           |
| ----------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| `song_drafts`     | 每首歌 + 最新一版 + 状态                                              | 后台                                           |
| `published_songs` | `status = 'published'` 的歌 + 发布的那一版 + `has_audio` + 各平台链接 | 公开端                                         |
| `catalog`         | `published_songs` 去掉 `dispute_note` 非空的                          | 以曲库为整体的功能：统计、推荐、寻曲、意象索引 |

`published_songs` 的列与现在的 `music` 保持一致，公开端的代码只换表名。

### 生命周期

| 操作 | 函数                                                     | 前置条件                                    | 结果                        | 权限               |
| ---- | -------------------------------------------------------- | ------------------------------------------- | --------------------------- | ------------------ |
| 保存 | `save_song_revision(song_id, base_revision_id, content)` | `base_revision_id` 是当前最新一版，否则冲突 | 追加一版                    | 管理员（含机器人） |
| 新建 | `create_song(content)`                                   | —                                           | 一首 `draft` 的歌 + 第一版  | 管理员（含机器人） |
| 发布 | `publish_song(song_id)`                                  | 有版本                                      | 指向最新一版，`published`   | 管理员             |
| 下架 | `unpublish_song(song_id)`                                | `published`                                 | `unpublished`，所有数据保留 | 超管               |
| 删除 | `delete_song(song_id)`                                   | 不是 `published`                            | 歌及挂在上面的一切级联删除  | 超管               |

- 下架后再发布，就是普通的发布：评论、收藏、标注都还在。
- 保存用「基于哪一版」做乐观锁，取代现在比对 `updated_at` 的做法。
- 版本表本身就是修改历史，歌曲内容不再走 `audit_logs`；状态转换由函数写一条审计。

### 规则（取代 `SONGS.md` 的两张表规则）

1. 公开端只读 `published_songs` 与 `catalog`。
2. 后台读 `song_drafts`；写只经上表的函数。
3. 新增挂在歌上的表，外键指向 `songs.id`。公开端读它时必须经 `published_songs` 把关：
   按单曲读的，入口先确认歌已发布；汇总类（意象云、母题页、寻曲、统计）按 `catalog` 过滤 `song_id`。

## 四、编校数据

意象标注、基调、校记与补遗。人写也好，agent 写也好，都在草稿阶段就能写，不必等发布。

### 来源

三张表统一加：

```sql
source        text not null check (source in ('human', 'ai'))
created_by    uuid references users
created_at    timestamptz
confirmed_by  uuid references users     -- 人确认过的；human 写的在写入时即确认
confirmed_at  timestamptz
```

- agent 写的记 `ai`、未确认。后台按「未确认」统一筛出来逐条过，改了或点确认都记为确认。
- 现在只有 `song_emotions` 有 `source`，确认与「改为 human」是一回事；新写法把「谁写的」和「谁确认的」分开记。
- 未确认的 AI 数据公开端显不显示：**待定**（第九节）。

### 意象标注：`imagery_occurrences` → `song_imagery`

```sql
song_imagery
  song_id      bigint references songs on delete cascade
  imagery_id   bigint references imagery
  category_id  bigint references imagery_categories    -- 母题
  + 来源各列
  primary key (song_id, imagery_id, category_id)
```

- **时间标签不存。** 按 `IMAGERY.md`，时间标签就是「词字面出现的那几行」，由歌词与同曲各词算出（`songTimetags`）。
  公开端按发布那一版的歌词算，后台按草稿算。「改了歌词还没发布，标签对不齐」与「发布时重算标签」都随之消失。
- **「同时算进」不存。** 一条标注挂在词的「通常算作」上时，它的「同时算进」各母题由 `imagery_motifs` 决定，读的时候展开。
  现在 `addParts` 补写的那几行，以及改词、改母题、删除时的连带维护，都不需要了。
- 主键用自然键，去掉代理 id；后台按 (歌, 词) 定位一行。

### 基调 `song_emotions`

结构不变，补齐来源各列。

### 校记与补遗 `song_collations`

结构不变，补齐来源各列；锚点见下。订者名单 `song_collation_revisers` 不变。

### 锚点

评点（`comments`）与校记都用「第几行 + 引文」锚在歌词上，锚的是写下时那一版歌词；歌词改了行号就可能错位。

```sql
anchor_revision_id  bigint references song_revisions   -- 锚定时的那一版
```

显示时：锚定的版本就是当前显示的版本，直接用行号；不是，按引文在当前版本里找行，找不到的归到整首歌。

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
- 锚点加 `anchor_revision_id`（第四节）。

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

**来源与审计。**

- 歌曲内容：版本表即历史。
- 编校数据与意象体系、署名别名：`record_audit_log` 触发器，全部挂上。
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

分四段，前一段完成再开始下一段。公开页面在每一步都不能中断；只影响后台的，允许短暂不可用，写明上线顺序即可。

### 第一段：歌曲与编校（agent 依赖这一段）

内容：第三节全部；第四节的来源各列与 `song_imagery` 改名（时间标签与「同时算进」仍照旧存，第二段再改）；`song_audio`。

1. **migration A（只加不删）**
   - 建 `songs`、`song_revisions`、`song_external_ids`、`song_audio` 与三个视图。
   - 回填：每首 `temp` 里的歌建一行 `songs`，id 不变；`music` 里有的，以 `music` 的内容建第一版并设为已发布；
     `temp` 与 `music` 内容不同或不在 `music` 里的，以 `temp` 的内容再追加一版作为草稿。
     三个链接字段拆进 `song_external_ids`；`navid_song` 复制进 `song_audio`。
   - 编校表、读者表的外键改指 `songs`（id 不变，回填后直接改约束）。
   - 停掉每日同步（`cron.unschedule('Update music')`）。回填之后旧表不再写入。
   - 旧表 `temp`、`music`、`navid_song` 暂时保留，公开端此时仍读 `music`，内容与回填一致。
2. **部署代码**：公开端改读 `published_songs` / `catalog`；后台改走 `song_drafts` 与生命周期函数；发布、下架、删除的界面；agent 用的接口。
   migration A 与部署之间，后台不要编辑歌曲。
3. **migration B**：删 `temp`、`music`、`navid_song`、`music_catalog`、`approve_music_sync`、`sync_music_from_temp`、`update_music_has_audio`。

已写好、未上线的「编校数据改挂 `temp`」（`20261113140000_editorial_on_temp.sql` 及配套代码）不再单独上线：
代码里去掉「必须已发布」的那部分并入这一段，migration 作废。

### 第二段：意象派生

- 时间标签改为读时计算，删 `lyric_timetag`、`syncSongTimetags`、`resyncSongTimetags`。
- 「同时算进」改为读时展开，删 `addParts` 及连带维护，删已存的补写行。
- `imagery_categories` 加父外键，`level` 改由视图算。
- 锚点加 `anchor_revision_id`（评点与校记）。

### 第三段：小项（各自独立，顺序随意）

- `users.role` 取代 `is_admin` / `is_super`。
- `comments` 的状态与可见性改文本。
- `collections` 改主键。
- `stream_grants.song_id` 改类型。
- 补审计触发器。
- 公开端读的表与视图收回 anon / authenticated 的写权限（纵深防御）。

### 第四段：按需

第九节里定下来要做的。

## 九、待讨论

1. **未确认的 AI 数据公开端显不显示？** 显示：agent 填完就上线，确认只是后台的质量流程；不显示：公开端多一层过滤，
   未确认的标注、基调对读者不可见。也可以按表分别定（比如基调显示、补遗不显示）。
2. **外部链接要不要随发布？** 现在链接在资料里，暂存后要发布才上线。设计里外部 id 是身份信息，保存即上线（对已发布的歌）。
3. **机器人能不能发布？** 目前设计为只写不发布，发布由人来。
4. **「下架」之后是回到 `draft` 还是单独的 `unpublished`？** 设计里单独一个状态，后台能区分「从没发布过」与「下架了」。
5. **人与署名。** 署名现在是五个名字数组，`credit_aliases` 在读取时把别名归到主名，是在弥补「人」没有身份。
   完整的设计是「人」一张表，「哪一版、什么角色、谁、原署作什么」一张表，别名即同一人的不同原署。
   要不要做，取决于有没有按人浏览、人物页这类需求。
6. **专辑。** 曲序、碟号、专辑艺人、日期都在每首歌上重复存。要做专辑页时值得建表，否则不必。
7. **素材表。** 封面、简谱是哪个文件、何时上传，记一张表，`hascover` / `nmn_status` 由它算出，不再手勾。
8. **拆 `user_requests`。** 歌曲反馈是关于歌的，播放权限、管理员申请是关于权限的，流程也不同。
9. **贡献者资料拆出 `users`。**
10. **版本留多久？** 全部保留（数据量小：几百首歌、每次保存一行）；要不要做版本对比、回退的界面。
