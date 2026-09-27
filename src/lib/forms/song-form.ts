import { z } from "zod";
import type { SongDetail } from "@/lib/types";

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value : value == null ? "" : String(value);

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : String(item)))
    : [];

const normalizeNullableNumber = (value: unknown) => {
  if (value === "" || value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value;
};

const normalizeNullableBoolean = (value: unknown) =>
  typeof value === "boolean" ? value : value == null ? null : value;

const makeOptionalTextSchema = (label: string, maxLength: number) =>
  z.preprocess(
    normalizeString,
    z.string().max(maxLength, `${label}不能超过${maxLength}个字符`),
  );

const makeOptionalArraySchema = (label: string, maxLength: number) =>
  z.preprocess(
    normalizeStringArray,
    z.array(
      z
        .string()
        .trim()
        .max(maxLength, `${label}单项不能超过${maxLength}个字符`),
    ),
  );

const makeOptionalIntegerSchema = (label: string, min: number) =>
  z.preprocess(
    normalizeNullableNumber,
    z
      .number({ error: `${label}必须为数字` })
      .int(`${label}必须为整数`)
      .min(min, `${label}不能小于${min}`)
      .nullable(),
  );

const makeArrayFieldItemSchema = (label: string, maxLength: number) =>
  z.object({
    value: z.preprocess(
      normalizeString,
      z
        .string()
        .trim()
        .max(maxLength, `${label}单项不能超过${maxLength}个字符`),
    ),
  });

const makeOptionalUrlSchema = (label: string) =>
  z.preprocess(
    normalizeString,
    z
      .string()
      .max(200, `${label}不能超过200个字符`)
      .refine(
        (value) => value === "" || z.url().safeParse(value).success,
        `${label}必须为正确的URL`,
      ),
  );

/** 歌词起点：LRC 时间标签，如 00:23.97；留空则自动识别 */
const lyricsStartSchema = z.preprocess(
  normalizeString,
  z
    .string()
    .trim()
    .regex(
      /^$|^\d{1,2}:\d{2}(?:\.\d{2,3})?$/,
      "歌词起点须为时间标签，如 00:23.97",
    ),
);

export const songFormSchema = z.object({
  title: z.preprocess(
    normalizeString,
    z.string().trim().min(1, "标题为必填项").max(100, "标题不能超过100个字符"),
  ),
  album: makeOptionalTextSchema("专辑", 100),
  lyricist: makeOptionalArraySchema("作词", 30),
  composer: makeOptionalArraySchema("作曲", 30),
  arranger: makeOptionalArraySchema("编曲", 30),
  artist: makeOptionalArraySchema("演唱", 30),
  type: makeOptionalArraySchema("类型", 30),
  genre: makeOptionalArraySchema("流派", 30),
  length: makeOptionalIntegerSchema("时长(秒)", 1),
  hascover: z.preprocess(normalizeNullableBoolean, z.boolean().nullable()),
  date: makeOptionalTextSchema("日期", 30),
  albumartist: makeOptionalArraySchema("出品发行", 30),
  comment: makeOptionalTextSchema("备注", 10000),
  lyrics: makeOptionalTextSchema("LRC歌词", 10000),
  lyrics_start: lyricsStartSchema,
  nmn_status: z.preprocess(normalizeNullableBoolean, z.boolean().nullable()),
  track: makeOptionalIntegerSchema("曲号", 1),
  tracktotal: makeOptionalIntegerSchema("曲总数", 1),
  discnumber: makeOptionalIntegerSchema("碟号", 1),
  disctotal: makeOptionalIntegerSchema("碟总数", 1),
  kugolink: makeOptionalUrlSchema("酷狗链接"),
  nelink: makeOptionalUrlSchema("网易云链接"),
  qmlink: makeOptionalUrlSchema("QQ音乐链接"),
});

export const songFormStateSchema = z.object({
  title: z.preprocess(
    normalizeString,
    z.string().trim().min(1, "标题为必填项").max(100, "标题不能超过100个字符"),
  ),
  album: makeOptionalTextSchema("专辑", 100),
  lyricist: z.array(makeArrayFieldItemSchema("作词", 30)),
  composer: z.array(makeArrayFieldItemSchema("作曲", 30)),
  arranger: z.array(makeArrayFieldItemSchema("编曲", 30)),
  artist: z.array(makeArrayFieldItemSchema("演唱", 30)),
  type: makeOptionalArraySchema("类型", 30),
  genre: makeOptionalArraySchema("流派", 30),
  length: makeOptionalIntegerSchema("时长(秒)", 1),
  hascover: z.preprocess(normalizeNullableBoolean, z.boolean().nullable()),
  date: makeOptionalTextSchema("日期", 30),
  albumartist: z.array(makeArrayFieldItemSchema("出品发行", 30)),
  comment: makeOptionalTextSchema("备注", 10000),
  lyrics: makeOptionalTextSchema("LRC歌词", 10000),
  lyrics_start: lyricsStartSchema,
  nmn_status: z.preprocess(normalizeNullableBoolean, z.boolean().nullable()),
  track: makeOptionalIntegerSchema("曲号", 1),
  tracktotal: makeOptionalIntegerSchema("曲总数", 1),
  discnumber: makeOptionalIntegerSchema("碟号", 1),
  disctotal: makeOptionalIntegerSchema("碟总数", 1),
  kugolink: makeOptionalUrlSchema("酷狗链接"),
  nelink: makeOptionalUrlSchema("网易云链接"),
  qmlink: makeOptionalUrlSchema("QQ音乐链接"),
});

export type SongFormValues = z.infer<typeof songFormSchema>;
export type SongFormStateValues = z.infer<typeof songFormStateSchema>;
export type SongArrayFieldItem = SongFormStateValues["lyricist"][number];

export type SongFormErrors = Partial<
  Record<keyof z.infer<typeof songFormSchema>, string>
>;

export function createEmptySongForm(): SongFormValues {
  return {
    title: "",
    album: "",
    lyricist: [],
    composer: [],
    arranger: [],
    artist: [],
    type: [],
    genre: [],
    length: null,
    hascover: null,
    date: "",
    albumartist: [],
    comment: "",
    lyrics: "",
    lyrics_start: "",
    nmn_status: null,
    track: null,
    tracktotal: null,
    discnumber: null,
    disctotal: null,
    kugolink: "",
    nelink: "",
    qmlink: "",
  };
}

const toFieldArrayItems = (values: string[]) =>
  values.map((value) => ({ value }));

export function createEmptySongFormState(): SongFormStateValues {
  return {
    ...createEmptySongForm(),
    lyricist: [],
    composer: [],
    arranger: [],
    artist: [],
    albumartist: [],
  };
}

export function toSongFormValues(song: Partial<SongDetail>): SongFormValues {
  const empty = createEmptySongForm();

  return {
    ...empty,
    ...song,
    title: normalizeString(song.title),
    album: normalizeString(song.album),
    lyricist: normalizeStringArray(song.lyricist),
    composer: normalizeStringArray(song.composer),
    arranger: normalizeStringArray(song.arranger),
    artist: normalizeStringArray(song.artist),
    type: normalizeStringArray(song.type),
    genre: normalizeStringArray(song.genre),
    length:
      typeof song.length === "number" && Number.isFinite(song.length)
        ? song.length
        : null,
    hascover: typeof song.hascover === "boolean" ? song.hascover : null,
    date: normalizeString(song.date),
    albumartist: normalizeStringArray(song.albumartist),
    comment: normalizeString(song.comment),
    lyrics: normalizeString(song.lyrics),
    lyrics_start: normalizeString(song.lyrics_start),
    nmn_status: typeof song.nmn_status === "boolean" ? song.nmn_status : null,
    track:
      typeof song.track === "number" && Number.isFinite(song.track)
        ? song.track
        : null,
    tracktotal:
      typeof song.tracktotal === "number" && Number.isFinite(song.tracktotal)
        ? song.tracktotal
        : null,
    discnumber:
      typeof song.discnumber === "number" && Number.isFinite(song.discnumber)
        ? song.discnumber
        : null,
    disctotal:
      typeof song.disctotal === "number" && Number.isFinite(song.disctotal)
        ? song.disctotal
        : null,
    kugolink: normalizeString(song.kugolink),
    nelink: normalizeString(song.nelink),
    qmlink: normalizeString(song.qmlink),
  };
}

export function toSongFormState(
  song: Partial<SongDetail> | SongFormValues,
): SongFormStateValues {
  const values = toSongFormValues(song);

  return {
    ...values,
    lyricist: toFieldArrayItems(values.lyricist),
    composer: toFieldArrayItems(values.composer),
    arranger: toFieldArrayItems(values.arranger),
    artist: toFieldArrayItems(values.artist),
    albumartist: toFieldArrayItems(values.albumartist),
  };
}

export function toSongFormPayload(state: SongFormStateValues): SongFormValues {
  return {
    ...state,
    lyricist: state.lyricist.map((item) => item.value),
    composer: state.composer.map((item) => item.value),
    arranger: state.arranger.map((item) => item.value),
    artist: state.artist.map((item) => item.value),
    albumartist: state.albumartist.map((item) => item.value),
  };
}

export function validateSongForm(values: SongFormValues): {
  data: SongFormValues | null;
  errors: SongFormErrors;
} {
  const result = songFormSchema.safeParse(values);
  if (result.success) {
    return {
      data: { ...values, ...result.data },
      errors: {},
    };
  }

  const errors: SongFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as keyof SongFormErrors] = issue.message;
    }
  }

  return {
    data: null,
    errors,
  };
}
