-- 河图志：迁入用户投稿的打卡表（见 docs/PLACES.md 第六节）
--
-- 打卡表由「正版雨清」整理，共 46 行。地点的短名、全称与地区按原型（/lab/map）核对过，合并成 45 处；
-- 引句按线上歌词定位到句（详情页切出的句子），抄错的几处按歌词改正；鸟巢是演出场馆，不引歌词。
-- 本文件由 scripts/places-seed.ts 生成，生成时与线上歌词逐句核对过；歌词改过就重新生成。
--
-- 地点照常写入。歌与地点的对应写进每首歌的线上版本，有草稿的同时写进草稿（id 相同），
-- 否则草稿一发布就把这些行丢了。这张表是新建的，写进已发布的版本等于补数据，
-- 这里临时关掉守卫与审计触发器，写完打开（同 20261116120000_motifs.sql）。
-- 曲库是空的（CI 在空库上重放）时只建地点；不空时逐首核对歌名与引文，对不上就整体回滚。

insert into public.places (id, name, full_name, region) overriding system value values
  (1, '文昌阁', null, '北京'),
  (2, '鸟巢', '鸟巢国家体育场', '北京'),
  (3, '故宫午门', '故宫博物院·午门', '北京'),
  (4, '蓬莱阁', '蓬莱阁景区', '山东 · 烟台 · 蓬莱'),
  (5, '宝塔镇', null, '江苏 · 盐城'),
  (6, '徐州', '徐州市', '江苏 · 徐州'),
  (7, '洛阳', '洛阳市', '河南 · 洛阳'),
  (8, '西安', '西安市', '陕西 · 西安'),
  (9, '黄浦江', null, '上海'),
  (10, '滁州', '滁州市', '安徽 · 滁州'),
  (11, '南京', '南京市', '江苏 · 南京'),
  (12, '文赤壁', null, '湖北 · 黄冈 · 黄州'),
  (13, '江阳', null, '四川 · 泸州 · 江阳'),
  (14, '八境台', null, '江西 · 赣州 · 章贡'),
  (15, '慈云塔', null, '江西 · 赣州 · 章贡'),
  (16, '郁孤台', '郁孤台公园', '江西 · 赣州 · 章贡'),
  (17, '洞庭湖', null, '湖南 · 岳阳 · 湘阴'),
  (18, '左公故里', null, '湖南 · 岳阳 · 湘阴'),
  (19, '乔口镇', null, '湖南 · 长沙 · 望城'),
  (20, '铜官古镇', null, '湖南 · 长沙 · 望城'),
  (21, '湘江', null, '湖南 · 长沙 · 开福'),
  (22, '渔阳墓', '西汉长沙王后渔阳墓', '湖南 · 长沙 · 岳麓'),
  (23, '岳麓山', null, '湖南 · 长沙 · 岳麓'),
  (24, '杜甫江阁', null, '湖南 · 长沙 · 天心'),
  (25, '赫曦台', null, '湖南 · 长沙 · 岳麓'),
  (26, '定王台', null, '湖南 · 长沙 · 芙蓉'),
  (27, '自卑亭', null, '湖南 · 长沙 · 岳麓'),
  (28, '蘋岛', null, '湖南 · 永州'),
  (29, '谭嗣同故居', null, '湖南 · 长沙 · 浏阳'),
  (30, '沅江', null, '湖南'),
  (31, '五强溪古栈道', '五强溪镇明代古栈道遗址', '湖南 · 怀化 · 沅陵'),
  (32, '瓮子洞', null, '湖南 · 怀化 · 沅陵'),
  (33, '清浪乡', null, '湖南 · 怀化 · 沅陵'),
  (34, '壶头山', null, '湖南 · 怀化 · 沅陵'),
  (35, '明月山', null, '湖南 · 怀化 · 沅陵'),
  (36, '龙兴讲寺', null, '湖南 · 怀化 · 沅陵'),
  (37, '武陵桥', null, '湖南 · 怀化 · 沅陵'),
  (38, '凤凰山', '凤凰山森林公园', '湖南 · 怀化 · 沅陵'),
  (39, '二酉山', '二酉山古藏书洞', '湖南 · 怀化 · 沅陵'),
  (40, '杭州', null, '浙江 · 杭州'),
  (41, '一半勾留', null, '浙江 · 杭州'),
  (42, '西湖十景', null, '浙江 · 杭州'),
  (43, '长白山', '长白山国家自然保护区', '吉林 · 白山 · 抚松'),
  (44, '布达拉宫', null, '西藏 · 拉萨'),
  (45, '莫高窟', null, '甘肃 · 敦煌');

select setval(pg_get_serial_sequence('public.places', 'id'), (select max(id) from public.places));

create temp table places_seed (
  id bigint, song_id bigint, title text, place_id bigint, relation text,
  anchor_index integer, anchor_time numeric, anchor_quote text, note text
) on commit drop;

insert into places_seed values
  (1, 22, '唱给你的歌', 2, 'venue', null, null, null, '2016 年心时纪河图现场，2018 年国风极乐夜河图现场'),
  (2, 186, '落笔生花', 1, 'setting', 11, 69.06, '我欲文风昌盛', null),
  (3, 186, '落笔生花', 1, 'setting', 12, 71.04, '诗词歌赋 水墨丹青 满庭芳华', null),
  (4, 225, '立心', 3, 'setting', 0, 23.71, '一双眼 风雪扑满', null),
  (5, 225, '立心', 3, 'setting', 1, 28.51, '紫禁朱门百年逝川', null),
  (6, 192, '从北国到南国', 9, 'setting', 10, 68.17, '黄浦江渔船来来往往', null),
  (7, 192, '从北国到南国', 9, 'setting', 11, 71.82, '大概是因为你爱的人也去了远方', null),
  (8, 24, '拉萨乱雪', 44, 'setting', 0, 63.77, '拉萨雪纷乱了几千年', null),
  (9, 24, '拉萨乱雪', 44, 'setting', 1, 67.34, '安静的堆积到红尘湮灭', null),
  (10, 24, '拉萨乱雪', 44, 'setting', 14, 153.12, '她坐在布达拉宫的身边', null),
  (11, 24, '拉萨乱雪', 44, 'setting', 15, 157.25, '想了半天', null),
  (12, 149, '离人醉杭州', 40, 'setting', 39, 221.25, '奈何西风怕', null),
  (13, 149, '离人醉杭州', 40, 'setting', 40, 224.12, '人言柳叶似离愁', null),
  (14, 334, '一半勾留', 41, 'setting', 16, 88.884, '但听凭轮回造物一半勾留一半掩埋', null),
  (15, 334, '一半勾留', 41, 'setting', 17, 92.848, '最兴之所至的青睐', null),
  (16, 305, '依山观澜', 42, 'setting', 18, 69.59, '抱剑观花西湖畔', '该歌曲融合全部西湖十景，不一一列举'),
  (17, 297, '不见长安', 8, 'setting', 8, 130.02, '我忽然开始疯狂想念 故事里的长安', null),
  (18, 52, '长安李白', 7, 'setting', 30, 103.32, '到了洛阳赏牡丹', null),
  (19, 52, '长安李白', 7, 'setting', 31, 106.28, '得知己千杯不停盏', null),
  (20, 332, '水调歌头·徐州中秋', 6, 'setting', 2, 19.35, '岂意彭城山下 同泛清河古汴 船上载凉州', null),
  (21, 53, '金陵·秦淮夜', 11, 'setting', 35, 102.65, '金陵城灯火萧瑟秋意', null),
  (22, 53, '金陵·秦淮夜', 11, 'setting', 36, 107.43, '青丝换霜雨', null),
  (23, 146, '画外', 45, 'setting', 8, 82.84, '山丘苍翠 眉边云鹤一抹', null),
  (24, 51, '荔枝春', 13, 'setting', 0, 31.42, '江阳城酒旗高悬风正暖', null),
  (25, 51, '荔枝春', 13, 'setting', 1, 33.83, '那一年 她折花小河畔', null),
  (26, 138, '宝塔镇河妖', 5, 'setting', 14, 66.4, '伶仃身 素衣袍', null),
  (27, 138, '宝塔镇河妖', 5, 'setting', 15, 69.42, '天上云逐飞鸟', null),
  (28, 138, '宝塔镇河妖', 5, 'setting', 16, 70.6, '我许过你暮暮与朝朝', null),
  (29, 81, '明珠山河歌', 10, 'setting', 0, 32.02, '一点滁州 四面山色', null),
  (30, 224, '江海余生', 12, 'setting', 4, 51.03, '歌且当歌 莫托遗响于悲风', null),
  (31, 162, '赤壁沧浪曲', 12, 'setting', 18, 95.59, '盛衰青史终有断 世人如蜉蝣', null),
  (32, 233, '人间入怀', 4, 'setting', 26, 121.96, '他们说神仙存在', null),
  (33, 233, '人间入怀', 4, 'setting', 27, 124.01, '已乘云去了千载', null),
  (34, 233, '人间入怀', 4, 'setting', 28, 126.09, '只留下这岛屿称作蓬莱', null),
  (35, 347, '浮生记·岁晏烟火帖', 15, 'setting', 0, 26.29, '晨钟声 敲开铜门环', null),
  (36, 347, '浮生记·岁晏烟火帖', 15, 'setting', 1, 28.59, '慈云塔早市 有晴风暖软', null),
  (37, 347, '浮生记·岁晏烟火帖', 14, 'setting', 22, 113.37, '平沙潮 推过八境滩', null),
  (38, 348, '郁孤行·八境长歌', 16, 'setting', 13, 150.13, '郁孤台前清江 浮桥影下寒浪', null),
  (39, 99, '山脉', 43, 'setting', 17, 66.15, '他是山脉隐于长白', null),
  (40, 330, '我从蘋岛来', 28, 'setting', 18, 211.272, '我从蘋岛来', null),
  (41, 330, '我从蘋岛来', 28, 'setting', 19, 216.132, '看尽人间的百态', null),
  (42, 92, '二酉藏书洞的传说', 39, 'setting', 18, 123.4, '而今山下人如海', null),
  (43, 92, '二酉藏书洞的传说', 39, 'setting', 19, 129.47, '学富五车书通二酉天下来', null),
  (44, 156, '沅水谣', 35, 'setting', 20, 128.81, '顺母桥人老桥未老', null),
  (45, 156, '沅水谣', 35, 'setting', 21, 135.68, '明月山月圆梦难圆', null),
  (46, 156, '沅水谣', 34, 'setting', 6, 47.49, '壶头映月江北冷', null),
  (47, 156, '沅水谣', 34, 'setting', 7, 51.28, '马革裹尸梦里还', null),
  (48, 156, '沅水谣', 33, 'setting', 4, 40.21, '吊脚楼醒窗前影', null),
  (49, 156, '沅水谣', 33, 'setting', 5, 43.64, '清浪滩现云上帆', null),
  (50, 156, '沅水谣', 38, 'setting', 12, 77.4, '凤凰山不见凤凰', null),
  (51, 156, '沅水谣', 38, 'setting', 13, 83.9, '龙兴讲寺谁留客', null),
  (52, 156, '沅水谣', 36, 'setting', 12, 77.4, '凤凰山不见凤凰', null),
  (53, 156, '沅水谣', 36, 'setting', 13, 83.9, '龙兴讲寺谁留客', null),
  (54, 293, '武陵桥觅得眼泪', 37, 'setting', 12, 58.13, '武陵桥觅得眼泪', null),
  (55, 293, '武陵桥觅得眼泪', 37, 'setting', 13, 60.15, '大雪纷飞', null),
  (56, 343, '清浪滩上', 32, 'setting', 4, 50.588, '瓮子洞前滩险 险滩望未了', null),
  (57, 343, '清浪滩上', 31, 'setting', 15, 148.87, '终见铁链百丈 锁住一江潮', null),
  (58, 343, '清浪滩上', 31, 'setting', 17, 161.239, '峰窝岩下路远 远路寻几遭', null),
  (59, 146, '画外', 17, 'setting', 7, 75.43, '千里飞渡 巫山云 洞庭波', null),
  (60, 337, '左公柳', 18, 'setting', 8, 57.928, '剑锋所指旌旗漫卷狂沙', null),
  (61, 337, '左公柳', 18, 'setting', 9, 61.168, '八千里征鞍碾过胡杨枝桠', null),
  (62, 264, '自渡·乔口', 19, 'setting', 10, 96.05, '三湘缈 乔口漂', null),
  (63, 264, '自渡·乔口', 19, 'setting', 11, 102.11, '春泥百草 我前路遥遥', null),
  (64, 246, '铜官寻梦', 20, 'setting', 9, 76.59, '可知我 寻你黄泉碧落人海间', null),
  (65, 246, '铜官寻梦', 20, 'setting', 10, 83.96, '你向我 挥手转身却消散尘烟', null),
  (66, 156, '沅水谣', 30, 'setting', 10, 69.21, '登楼凭栏望沅江', null),
  (67, 156, '沅水谣', 30, 'setting', 11, 73.67, '沅水犹浩荡', null),
  (68, 333, '赫曦台上', 21, 'setting', 16, 76.372, '岳麓巍巍 摘星作砚台', null),
  (69, 333, '赫曦台上', 21, 'setting', 17, 79.631, '湘江泼墨化云霭', null),
  (70, 259, '渔阳公主', 22, 'setting', 11, 97.21, '时光里走出渔阳公主', null),
  (71, 259, '渔阳公主', 22, 'setting', 12, 102.28, '不染风霜的眉目', null),
  (72, 234, '你好岳麓山', 23, 'setting', 11, 89.52, '千秋照我 人间声色', null),
  (73, 234, '你好岳麓山', 23, 'setting', 12, 93.27, '明月逐风千里万里行', null),
  (74, 333, '赫曦台上', 25, 'setting', 4, 31.605, '清荷摇曳披月白', null),
  (75, 333, '赫曦台上', 25, 'setting', 5, 34.868, '赫曦台上育英才', null),
  (76, 275, '自卑亭记', 27, 'setting', 14, 93.95, '青山可题跋', null),
  (77, 275, '自卑亭记', 27, 'setting', 15, 97, '四海可为家', null),
  (78, 275, '自卑亭记', 27, 'setting', 16, 100.38, '位卑亦敢忧天下', null),
  (79, 361, '过杜甫江阁', 24, 'setting', 8, 65.13, '谁倚阁楼边，坐看云霞起', null),
  (80, 361, '过杜甫江阁', 24, 'setting', 9, 69.03, '离别曲唱在相逢时', null),
  (81, 254, '定王台', 26, 'setting', 8, 82.25, '他也曾年少夕阳渐远登高台', null),
  (82, 254, '定王台', 26, 'setting', 9, 89.9, '少年思亲不语默默独徘徊', null),
  (83, 344, '如见', 29, 'setting', 8, 79.161, '祠堂泪 滴穿沉默的牌匾', null),
  (84, 344, '如见', 29, 'setting', 9, 85.625, '莲花愿 在淤泥中皎洁', null);

do $$
declare
  bad text;
begin
  if not exists (select 1 from public.songs) then
    return;
  end if;

  select string_agg(format('%s《%s》', p.song_id, p.title), '、') into bad
  from (select distinct song_id, title from places_seed) p
  left join public.published_songs s on s.id = p.song_id and s.title = p.title
  where s.id is null;
  if bad is not null then
    raise exception '这些歌不在线上或歌名对不上：%', bad;
  end if;

  select string_agg(format('《%s》%s', p.title, p.anchor_quote), '、') into bad
  from places_seed p
  join public.published_songs s on s.id = p.song_id
  where p.anchor_quote is not null and position(p.anchor_quote in s.lyrics) = 0;
  if bad is not null then
    raise exception '这些引文在线上歌词里找不到：%', bad;
  end if;
end $$;

alter table public.song_places disable trigger song_places_guard;
alter table public.song_places disable trigger song_places_audit;

insert into public.song_places (
  version_id, id, place_id, relation, anchor_index, anchor_time, anchor_quote, note, created_by
) overriding system value
select v.id, p.id, p.place_id, p.relation, p.anchor_index, p.anchor_time, p.anchor_quote, p.note, null
from places_seed p
join public.songs s on s.id = p.song_id
join public.song_versions v
  on v.song_id = s.id and (v.id = s.live_version_id or v.published_at is null);

alter table public.song_places enable trigger song_places_guard;
alter table public.song_places enable trigger song_places_audit;

select setval(pg_get_serial_sequence('public.song_places', 'id'), (select count(*) from places_seed));

do $$
declare
  n bigint;
begin
  if not exists (select 1 from public.songs) then
    return;
  end if;
  select count(*) into n from public.published_song_places;
  if n <> (select count(*) from places_seed) then
    raise exception '线上版本写进 % 行，应为 % 行', n, (select count(*) from places_seed);
  end if;
end $$;
