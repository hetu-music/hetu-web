/**
 * 曲库页搜歌词用的数据的缓存标签（lyrics-lines，以及旧的 lyrics-index）：歌曲变动时由 server-revalidate 失效。
 * 单独放一个文件，server-revalidate 不必为了这个常量引入 service-lyrics-lines。
 */
export const LYRICS_LINES_TAG = "lyrics-lines";
