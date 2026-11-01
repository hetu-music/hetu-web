# 缓存与 CDN

改动接口的缓存头、页面的 `revalidate`、`unstable_cache`、Service Worker 的缓存规则，或者 CDN 上的规则之前，先读这份文档。

## 一、各层缓存

| 层              | 管什么                                                                | 时长                                                         | 在哪里设                                           |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| Next 的 ISR     | 公开页面：首页、详情页、意象页、母题页、寻曲页、故事页、`sitemap.xml` | 全站统一 6 小时（`revalidate = 21600`）                      | 各页面的 `export const revalidate`，必须直接写数字 |
| Next 的数据缓存 | 意象索引、寻曲候选池、登录页的摘句池                                  | 6 小时，另按标签失效                                         | `unstable_cache` 的 `revalidate`                   |
|                 | 曲库页搜歌词的数据（`lyrics-lines`）                                  | 不按时间过期，只按标签失效                                   | `service-lyrics-lines.ts`                          |
| CDN             | 页面和几个公开只读接口                                                | 看源站的 `Cache-Control`，CDN 上不另设时长                   | 页面由 Next 按 `revalidate` 生成；接口见下面「二」 |
| 浏览器          | 只有 `lyrics-lines`                                                   | 6 小时（`max-age`）                                          | `BROWSER_CACHED_API_CACHE`                         |
| Service Worker  | 白名单里的公开只读接口，只用来离线兜底                                | `NetworkFirst`，网络超过 5 秒或离线时返回最多 5 分钟前的副本 | `src/sw.ts` 的 `PUBLIC_CACHEABLE_API`              |

数据变了，一律经 `src/lib/server/server-revalidate.ts` 失效：它同时失效 Next 的 ISR 条目、数据缓存的标签，并按地址清各家 CDN。不在别处直接调 `revalidatePath`。

## 二、接口

`/api` 下默认全部 `private, no-store`：`next.config.ts` 按 `API_NO_STORE_SOURCE` 统一加。只有 `API_PATHS_WITH_OWN_CACHE`（`src/lib/server/cache-headers.ts`）列出的接口自己设缓存头：

| 接口                                                           | 缓存头                 | 数据变了怎么更新                                                                |
| -------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| `/api/public/songs/[id]/lyrics`（详情页、播放器的歌词）        | CDN 6 小时             | `refreshSongs` 清这首歌的地址                                                   |
| `/api/imagery/motifs/[id]`（意象页的母题面板）                 | CDN 6 小时             | `refreshImagery` 清被改的母题，简繁各一个地址；其余受牵连的等到期               |
| `/api/public/contributors`（「关于」里的维护团队）             | CDN 6 小时             | 后台改用户、管理员改自己的资料时 `refreshContributors` 清；普通用户改资料不清   |
| `/api/public/songs/lyrics-lines?locale=`（曲库页搜歌词的数据） | 浏览器和 CDN 都 6 小时 | `refreshSongs`、`refreshPublicPages` 清简繁两个地址并失效标签；浏览器里的等到期 |

这几个接口出错时（400、404、500）也返回 `no-store`，错误响应不进任何缓存。

几条规矩：

- **为什么要明确写 no-store**：Cloudflare 的规则（见「三」）让公开接口按源站头进缓存，不带 `Cache-Control` 的响应会按 Cloudflare 的默认时长缓存。
- **新增一个要缓存的接口，必须加进 `API_PATHS_WITH_OWN_CACHE`**。Next 发送接口响应时，`next.config.ts` 已经设过的头，不会被接口自己的同名头覆盖（`next/dist/server/send-response.js`），不加进去就会被 no-store 盖住。`cache-headers.test.ts` 用 Next 自己的路径匹配函数检查这份名单。
- **要缓存的接口，源站也要扛得住绕过 CDN 的请求**。在地址后面随便加个参数，CDN 就认不出来，会回源。重的计算放进数据缓存（如 `lyrics-lines`、意象索引）；路径里的 id 用 `parseRouteId`（`src/lib/server/route-params.ts`）只认规范写法，`012`、`12abc` 返回 400，不让同一份数据有好几个缓存地址。
- **清 CDN 的地址要和客户端请求的一字不差**。比如 `lyrics-lines` 的简体也明确带 `?locale=zh-CN`；母题面板的简体不带参数、繁体带 `?locale=zh-TW`。
- **任何登录用户都能触发的写操作，不要去清 CDN**：有账号的人反复调用，就能刷爆清缓存的配额，管理员真正要清的时候反而失败。
- **按身份返回不同内容的接口一律 no-store**，比如批注（登录后另含自己的私批）。

## 三、Cloudflare 的规则

### 现有

1. **页面和公开接口按源站头进缓存**：
   ```
   (http.host eq "www.hetu-music.com"
    and not starts_with(http.request.uri.path, "/api/admin")
    and not starts_with(http.request.uri.path, "/api/auth"))
   ```
   Eligible for cache，时长看源站的 `Cache-Control`。Cloudflare 默认不缓存 HTML 和 JSON，没有这条，页面和接口都不会进 CDN。
2. **站内跳转请求绕过缓存**：带 `?_rsc=` 或请求头 `rsc: 1` 的请求不缓存。

### 待加：缓存键忽略多余的参数

**问题**：CDN 默认用完整地址（含查询串）当缓存键。`/api/imagery/motifs/9?locale=zh-TW&x=1` 和不带 `x=1` 的是两份缓存，前者从没被请求过，就会回源。在地址后面随便加个参数，就能让每个请求都绕过 CDN。

源站现在扛得住（这几个接口的数据都在服务端缓存里，回源也只要几毫秒），加这两条是为了 CDN 命中率更高、访问更快。

新建两条规则，放在上面那条「按源站头进缓存」之后（Cache Rules 按顺序生效，后面的只覆盖自己设的项）。Cache eligibility 和 Edge TTL 照抄现有那条，只多设缓存键：

**规则一：按语言区分的接口，只认 `locale`**

```
(http.host eq "www.hetu-music.com"
 and (http.request.uri.path eq "/api/public/songs/lyrics-lines"
      or starts_with(http.request.uri.path, "/api/imagery/motifs/")))
```

Cache key → Query string → Include specified query string parameters：`locale`

**规则二：不需要参数的接口，查询串全部忽略**

```
(http.host eq "www.hetu-music.com"
 and (http.request.uri.path eq "/api/public/contributors"
      or (starts_with(http.request.uri.path, "/api/public/songs/")
          and ends_with(http.request.uri.path, "/lyrics"))))
```

Cache key → Query string → Exclude all query string parameters

注意：

- **不能直接改现有那条，给全站设「只认 `locale`」**。那条覆盖整个站点：封面走 Next 的图片优化（`/_next/image?url=…&w=…&q=…`），靠查询串区分是哪张图、什么尺寸。只认 `locale` 的话，所有图片都成了同一个缓存键，第一张被缓存的图会发给所有人。以后新加的、按查询参数返回不同内容的接口，也会被悄悄合并。
- **清缓存照常有效**：代码里清的是标准写法的地址，Cloudflare 清的时候按同样的规则算缓存键，能对上。
- **新增一个要缓存的接口时**，看它用不用查询参数，加进上面对应的那条规则。
- 缓存键里查询串这一项，不确定免费套餐能不能用；界面上那一项是灰的就是当前套餐不支持。

### 其他 CDN

`server-revalidate.ts` 里还接了 EdgeOne 和 CloudFront。如果在用，缓存键要各设一遍：CloudFront 在缓存策略（Cache policy）的查询字符串里只放行 `locale`；EdgeOne 在节点缓存键的「查询字符串」规则里设。

### 建议：限速

不缓存、又不用登录就能调的接口，比如批注（`/api/public/songs/*/comments`）和 `/api/auth/*`，可以在 Cloudflare 上按 IP 限速。登录、注册、发验证码已有 Turnstile；校验验证码、重置密码是这些流程的第二步，第一步已经过了 Turnstile，这两步靠 Supabase 自带的频率限制。
