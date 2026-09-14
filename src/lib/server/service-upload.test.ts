import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateFileContent,
  validateFile,
  uploadCoverFile,
  uploadScoreFile,
} from "./service-upload";

// Magic number 字节序列，取自各格式规范
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
// RIFF....WEBP：RIFF 容器头 + WEBP 标识（偏移 8-11 字节）
const WEBP_HEADER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
// 同样以 RIFF 开头，但不是 WEBP（比如 WAV/AVI 也用 RIFF 容器）
const RIFF_NON_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
]);

function makeFile(content: string, type: string, size?: number): File {
  const file = new File([content], "test-file", { type });
  if (size !== undefined) {
    Object.defineProperty(file, "size", { value: size });
  }
  return file;
}

describe("validateFileContent（Magic Number 校验）", () => {
  it("真实 JPEG header 校验通过", async () => {
    const result = await validateFileContent(JPEG_HEADER, "image/jpeg");
    expect(result.valid).toBe(true);
  });

  it("真实 PNG header 校验通过", async () => {
    const result = await validateFileContent(PNG_HEADER, "image/png");
    expect(result.valid).toBe(true);
  });

  it("伪造扩展名（内容是文本却声称是 PNG）被拒绝", async () => {
    const fakeBuffer = Buffer.from("<script>alert(1)</script>", "utf8");
    const result = await validateFileContent(fakeBuffer, "image/png");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  // 第四字节随 JPEG 段类型变化，这些都是合法 JPEG，不应被当成伪造文件
  it.each([
    ["JFIF (E0)", 0xe0],
    ["Exif (E1)", 0xe1],
    ["无 APPn 段 (DB)", 0xdb],
    ["Adobe (EE)", 0xee],
    ["注释段 (FE)", 0xfe],
  ])("合法 JPEG 变体通过校验: %s", async (_label, fourth) => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, fourth]);
    const result = await validateFileContent(buf, "image/jpeg");
    expect(result.valid).toBe(true);
  });

  it("仅 FF D8 两字节（缺少第三字节）被拒绝", async () => {
    const result = await validateFileContent(
      Buffer.from([0xff, 0xd8]),
      "image/jpeg",
    );
    expect(result.valid).toBe(false);
  });

  it("PNG header 冒充 JPEG 被拒绝（跨类型伪造）", async () => {
    const result = await validateFileContent(PNG_HEADER, "image/jpeg");
    expect(result.valid).toBe(false);
  });

  it("空 buffer 被拒绝", async () => {
    const result = await validateFileContent(Buffer.alloc(0), "image/jpeg");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("文件内容为空");
  });

  it("未知 mimeType 没有签名定义时判定为无效", async () => {
    const result = await validateFileContent(JPEG_HEADER, "image/gif");
    expect(result.valid).toBe(false);
  });

  it("真实 WEBP header（RIFF + WEBP 标识）校验通过", async () => {
    const result = await validateFileContent(WEBP_HEADER, "image/webp");
    expect(result.valid).toBe(true);
  });

  it("RIFF 容器但不是 WEBP（如 WAV/AVI）时拒绝", async () => {
    const result = await validateFileContent(RIFF_NON_WEBP, "image/webp");
    expect(result.valid).toBe(false);
  });

  it("WEBP header 长度不足 12 字节（缺 WEBP 标识部分）时拒绝", async () => {
    const truncated = WEBP_HEADER.subarray(0, 8);
    const result = await validateFileContent(truncated, "image/webp");
    expect(result.valid).toBe(false);
  });
});

describe("validateFile（类型 / 大小校验，默认为封面配置）", () => {
  it("允许的类型且大小合规时通过", () => {
    const file = makeFile("x", "image/jpeg", 1024);
    expect(validateFile(file).valid).toBe(true);
  });

  it("类型不在允许列表内时拒绝", () => {
    const file = makeFile("x", "image/gif", 1024);
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("JPEG");
  });

  it("超过最大文件大小时拒绝", () => {
    const file = makeFile("x", "image/jpeg", 200 * 1024 * 1024);
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("MB");
  });
});

describe("uploadScoreFile / uploadCoverFile（文件名清洗 + 上传）", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("songId 含路径遍历字符时被清洗，不会改变上传目标路径", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const result = await uploadScoreFile(PNG_HEADER, "../../123");

    expect(result.success).toBe(true);
    const [url] = vi.mocked(fetch).mock.calls[0];
    // "../../123" 清洗后应只剩 "123"，不能逃逸出 nmn/ 目录
    expect(url).toBe("https://cover.hetu-music.com/nmn/123.png");
  });

  it("songId 含非法字符（如引号、控制字符）时同样被清除", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await uploadCoverFile(JPEG_HEADER, '12"3<4>5');

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://cover.hetu-music.com/cover/12345.jpg");
  });

  it("内容不匹配声明的图片类型时拒绝，且不发起上传请求", async () => {
    const fakeBuffer = Buffer.from("not-a-real-png", "utf8");
    const result = await uploadScoreFile(fakeBuffer, "1");
    expect(result.success).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("远端返回非 2xx 时上报失败原因", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ error: "R2 上传失败" }),
    } as Response);

    const result = await uploadScoreFile(PNG_HEADER, "1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("R2 上传失败");
  });

  it("远端返回非 2xx 且响应体不是合法 JSON 时，降级为默认错误信息", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    const result = await uploadScoreFile(PNG_HEADER, "1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Upload failed: 502 Bad Gateway");
  });

  it("远端返回 2xx 但业务字段 success:false 时也判定为失败", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: "校验未通过" }),
    } as Response);

    const result = await uploadScoreFile(PNG_HEADER, "1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("校验未通过");
  });

  it("网络请求异常（fetch reject）时降级为失败而不抛出未捕获异常", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    const result = await uploadScoreFile(PNG_HEADER, "1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("network down");
  });

  it("songId 超过 100 字符时被截断（保留扩展名）", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const longId = "a".repeat(150);
    await uploadScoreFile(PNG_HEADER, longId);

    const [url] = vi.mocked(fetch).mock.calls[0];
    // 文件名部分（不含 .png 后缀）应被截断到 100 字符
    const parts = (url as string).split("/");
    const fileName = parts[parts.length - 1];
    expect(fileName.replace(/\.png$/, "")).toHaveLength(100);
  });

  it("songId 清洗后为空字符串时回退为 unnamed_file", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    // 全部由会被清洗掉的字符组成：路径分隔符 + 上级目录引用
    await uploadScoreFile(PNG_HEADER, "../\\/..");

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://cover.hetu-music.com/nmn/unnamed_file.png");
  });
});
