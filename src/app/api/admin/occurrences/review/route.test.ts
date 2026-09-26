import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let mockCsrfValid = true;

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "test-token" } },
      })),
      getUser: vi.fn(async () => ({
        data: { user: { id: "admin-1", app_metadata: { is_admin: true } } },
      })),
    },
  })),
}));

vi.mock("@/lib/server/server-utils", () => ({
  verifyCSRFToken: vi.fn(async () => mockCsrfValid),
}));

vi.mock("@/lib/server/service-imagery-suggest", () => ({
  reviewImagerySuggestions: vi.fn(),
}));

import { LlmError } from "@/lib/server/llm";
import { reviewImagerySuggestions } from "@/lib/server/service-imagery-suggest";
import { POST } from "./route";

function post(body: unknown) {
  return new NextRequest("http://localhost/api/admin/occurrences/review", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const body = {
  song_id: 5,
  candidates: [{ imageryId: 1, name: "明月", rate: 0.5 }],
};

beforeEach(() => {
  mockCsrfValid = true;
  vi.mocked(reviewImagerySuggestions).mockReset();
});

describe("POST /api/admin/occurrences/review", () => {
  it("返回校验结果", async () => {
    const result = { verdicts: [], additions: [] };
    vi.mocked(reviewImagerySuggestions).mockResolvedValue(result);
    const res = await POST(post(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);
    expect(reviewImagerySuggestions).toHaveBeenCalledWith(
      5,
      body.candidates,
      "test-token",
    );
  });

  it("参数不合法时返回 400", async () => {
    const res = await POST(
      post({ song_id: 5, candidates: [{ imageryId: 1, name: "", rate: 2 }] }),
    );
    expect(res.status).toBe(400);
  });

  it("歌曲不存在时返回 404", async () => {
    vi.mocked(reviewImagerySuggestions).mockResolvedValue(null);
    expect((await POST(post(body))).status).toBe(404);
  });

  it.each([
    ["NOT_CONFIGURED", 503],
    ["HTTP", 502],
    ["BAD_RESPONSE", 502],
  ] as const)("LlmError %s 映射为 %i 并带上可读信息", async (code, status) => {
    vi.mocked(reviewImagerySuggestions).mockRejectedValue(
      new LlmError("说明", code),
    );
    const res = await POST(post(body));
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe("说明");
  });

  it("CSRF 校验失败时拒绝，不调用模型", async () => {
    mockCsrfValid = false;
    expect((await POST(post(body))).status).toBe(403);
    expect(reviewImagerySuggestions).not.toHaveBeenCalled();
  });
});
