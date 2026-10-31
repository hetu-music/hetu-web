/**
 * 登录、注册页封面墙的数据形状与尺寸，客户端组件只从这里引入。
 * 挑歌、挑摘句在 auth-gallery（server-only），别把它引进客户端。
 */

export interface GallerySong {
  id: number;
  title: string;
  /** 摘句：按空格分成若干短语，与歌曲页卷首的竖排摘句同一规则 */
  excerpt: string;
}

/** 墙上的封面数：宽屏四列、每列九张 */
export const GALLERY_SIZE = 36;
/** 轮换展示摘句的歌数 */
export const GALLERY_QUOTES = 8;
