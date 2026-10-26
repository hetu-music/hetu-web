/**
 * 全库意象索引（imagery-index）及由它算出的寻曲候选池共用的缓存标签。
 * 两份缓存同进同退：索引变了，候选池必须跟着重算，所以只用一个标签。
 */
export const IMAGERY_INDEX_TAG = "imagery-index";
