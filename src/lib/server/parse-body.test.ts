import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "./parse-body";

function request(body?: string) {
  return new NextRequest("http://localhost/api/x", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({
  name: z.string().max(3),
  note: z.string().optional(),
});

describe("parseJsonBody", () => {
  it("合法请求体返回校验后的数据", async () => {
    const { data, response } = await parseJsonBody(
      request('{"name":"abc"}'),
      schema,
    );
    expect(response).toBeUndefined();
    expect(data).toEqual({ name: "abc" });
  });

  it("坏 JSON 回 400，不抛错", async () => {
    const { response } = await parseJsonBody(request("{oops"), schema);
    expect(response?.status).toBe(400);
    expect(await response?.json()).toEqual({ error: "请求体格式无效" });
  });

  it("空请求体按 {} 校验", async () => {
    const optional = z.object({ scope: z.enum(["others"]).optional() });
    const { data } = await parseJsonBody(request(), optional);
    expect(data).toEqual({});
  });

  it("校验不过回 400 与第一条提示；schema 没写提示的规则也是中文", async () => {
    const { response } = await parseJsonBody(
      request('{"name":"abcd"}'),
      schema,
    );
    expect(response?.status).toBe(400);
    const body = await response?.json();
    expect(body?.error).toMatch(/[一-鿿]/);
  });

  it("schema 里写了的提示原样给出", async () => {
    const custom = z.object({ name: z.string().min(1, "名字不能为空") });
    const { response } = await parseJsonBody(request('{"name":""}'), custom);
    expect((await response?.json())?.error).toBe("名字不能为空");
  });
});
