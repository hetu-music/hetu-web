import { fetchWithTimeout } from "@/lib/utils/utils-common";

/**
 * Magic Number 定义 - 用于验证文件的真实类型
 * 通过读取文件的前几个字节来判断文件的真实格式
 */
const MAGIC_NUMBERS: Record<string, number[][]> = {
  // JPEG 的 SOI 标记就是 FF D8，紧跟的 FF 是下一个段的起始。
  // 只校验这三个字节即可：第四字节随段类型变化（E0=JFIF、E1=Exif、
  // DB=无 APPn 段、EE=Adobe 等），逐一枚举会把合法图片当成伪造文件拒掉。
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]], // PNG
  "image/webp": [
    [0x52, 0x49, 0x46, 0x46], // RIFF (需要进一步检查 WEBP 标识)
  ],
};

/**
 * 验证 Buffer 的 Magic Number 是否匹配指定的文件类型
 */
function verifyMagicNumber(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_NUMBERS[mimeType];
  if (!signatures) {
    console.warn(`No magic number signature defined for ${mimeType}`);
    return false;
  }

  // 检查是否匹配任何一个签名
  return signatures.some((signature) => {
    // 确保 buffer 足够长
    if (buffer.length < signature.length) {
      return false;
    }

    // 检查每个字节是否匹配
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }

    // 对于 WEBP，需要额外验证 WEBP 标识（偏移 8-11 字节）
    if (mimeType === "image/webp") {
      if (buffer.length < 12) return false;
      const webpSignature = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
      for (let i = 0; i < webpSignature.length; i++) {
        if (buffer[8 + i] !== webpSignature[i]) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * 清理和验证文件名，防止路径遍历和其他安全问题
 */
function sanitizeFileName(fileName: string): string {
  // 1. 移除所有路径分隔符和特殊字符
  let sanitized = fileName
    .replace(/[/\\]/g, "") // 移除路径分隔符
    .replace(/\.\./g, "") // 移除上级目录引用
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"|?*\u0000-\u001f]/g, "") // 移除非法字符（包括控制字符）
    .trim();

  // 2. 限制长度（保留扩展名）
  const maxLength = 100;
  if (sanitized.length > maxLength) {
    const lastDotIndex = sanitized.lastIndexOf(".");
    if (lastDotIndex > 0) {
      const ext = sanitized.substring(lastDotIndex);
      sanitized = sanitized.substring(0, maxLength - ext.length) + ext;
    } else {
      sanitized = sanitized.substring(0, maxLength);
    }
  }

  // 3. 如果清理后为空，使用默认名称
  if (!sanitized || sanitized === ".") {
    sanitized = "unnamed_file";
  }

  return sanitized;
}

/**
 * 验证文件内容（基于 Magic Number）
 */
export async function validateFileContent(
  buffer: Buffer,
  expectedMimeType: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    // 检查 buffer 是否为空
    if (!buffer || buffer.length === 0) {
      return {
        valid: false,
        error: "文件内容为空",
      };
    }

    // 验证 Magic Number
    const isValidType = verifyMagicNumber(buffer, expectedMimeType);
    if (!isValidType) {
      return {
        valid: false,
        error: "文件类型不匹配，可能是伪造的文件扩展名",
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("File content validation error:", error);
    return {
      valid: false,
      error: "文件内容验证失败",
    };
  }
}

export interface UploadConfig {
  maxFileSize: number; // 最大文件大小（字节）
  allowedTypes: string[]; // 允许的文件类型
  baseUrl: string; // 基础URL
}

// 要把整个文件体传完，比其他对外请求宽松得多
const UPLOAD_TIMEOUT_MS = 30000;

export const coverUploadConfig: UploadConfig = {
  maxFileSize: 100 * 1024 * 1024,
  allowedTypes: ["image/jpeg", "image/jpg"],
  baseUrl: "https://cover.hetu-music.com/cover",
};

export const scoreUploadConfig: UploadConfig = {
  maxFileSize: 100 * 1024 * 1024,
  allowedTypes: ["image/png"],
  baseUrl: "https://cover.hetu-music.com/nmn",
};

export async function uploadCoverFile(
  buffer: Buffer,
  songId: string,
  config: UploadConfig = coverUploadConfig,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 验证文件内容（Magic Number）
    const contentValidation = await validateFileContent(buffer, "image/jpeg");
    if (!contentValidation.valid) {
      return {
        success: false,
        error: contentValidation.error || "文件类型验证失败",
      };
    }

    // 2. 清理文件名（防止路径遍历）
    const sanitizedSongId = sanitizeFileName(songId);
    const fileName = `${sanitizedSongId}.jpg`;
    const uploadUrl = `${config.baseUrl}/${fileName}`;

    // 直接上传到R2存储
    const response = await fetchWithTimeout(
      uploadUrl,
      {
        method: "PUT",
        headers: {
          "Content-Type": "image/jpeg",
        },
        body: new Uint8Array(buffer),
      },
      UPLOAD_TIMEOUT_MS,
    );

    if (!response.ok) {
      // 尝试解析错误响应
      let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // 如果无法解析JSON，使用默认错误消息
      }
      throw new Error(errorMessage);
    }

    // 解析成功响应（验证上传成功）
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Upload failed");
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

export async function uploadScoreFile(
  buffer: Buffer,
  songId: string,
  config: UploadConfig = scoreUploadConfig,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 验证文件内容（Magic Number）
    const contentValidation = await validateFileContent(buffer, "image/png");
    if (!contentValidation.valid) {
      return {
        success: false,
        error: contentValidation.error || "文件类型验证失败",
      };
    }

    // 2. 清理文件名（防止路径遍历）
    const sanitizedSongId = sanitizeFileName(songId);
    const fileName = `${sanitizedSongId}.png`;
    const uploadUrl = `${config.baseUrl}/${fileName}`;

    // 直接上传到R2存储
    const response = await fetchWithTimeout(
      uploadUrl,
      {
        method: "PUT",
        headers: {
          "Content-Type": "image/png",
        },
        body: new Uint8Array(buffer),
      },
      UPLOAD_TIMEOUT_MS,
    );

    if (!response.ok) {
      // 尝试解析错误响应
      let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // 如果无法解析JSON，使用默认错误消息
      }
      throw new Error(errorMessage);
    }

    // 解析成功响应（验证上传成功）
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Upload failed");
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Upload score error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

export function validateFile(
  file: File,
  config: UploadConfig = coverUploadConfig,
): { valid: boolean; error?: string } {
  // 检查文件类型
  if (
    !config.allowedTypes.some((type) => file.type.includes(type.split("/")[1]))
  ) {
    return {
      valid: false,
      error: `只允许上传 ${config.allowedTypes.map((t) => t.split("/")[1].toUpperCase()).join(", ")} 格式的文件`,
    };
  }

  // 检查文件大小
  if (file.size > config.maxFileSize) {
    const maxSizeMB = Math.round(config.maxFileSize / (1024 * 1024));
    return {
      valid: false,
      error: `文件大小不能超过 ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

export function validateScoreFile(
  file: File,
  config: UploadConfig = scoreUploadConfig,
): { valid: boolean; error?: string } {
  return validateFile(file, config);
}
