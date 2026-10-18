// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/zh-CN";
import OtpStep from "./OtpStep";

vi.mock("@/lib/api/csrf", () => ({
  getCsrfToken: () => Promise.resolve("token"),
}));

const fetchMock = vi.fn();

function renderOtp(onVerified = vi.fn()) {
  render(
    <NextIntlClientProvider locale="zh-CN" messages={messages}>
      <OtpStep email="a@b.c" onVerified={onVerified} onRestart={vi.fn()} />
    </NextIntlClientProvider>,
  );
  return { onVerified, inputs: screen.getAllByRole("textbox") };
}

/** 逐格输入，与键盘一位一位敲的效果一样 */
function typeCode(inputs: HTMLElement[], code: string) {
  code.split("").forEach((digit, i) => {
    fireEvent.change(inputs[i], { target: { value: digit } });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OtpStep", () => {
  it("六位填满自动提交，验证通过后回调", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const { onVerified, inputs } = renderOtp();
    expect(inputs).toHaveLength(6);

    typeCode(inputs, "123456");

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ email: "a@b.c", otp: "123456" });
  });

  it("验证码错了显示错误，同一组数字不再自动提交", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "验证码错误" }), { status: 400 }),
    );
    const { onVerified, inputs } = renderOtp();

    typeCode(inputs, "111111");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "验证码错误",
    );

    // 删掉最后一位再填回同一个数字：还是那组错码，不重复请求
    fireEvent.change(inputs[5], { target: { value: "" } });
    fireEvent.change(inputs[5], { target: { value: "1" } });
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("只收数字", () => {
    const { inputs } = renderOtp();
    fireEvent.change(inputs[0], { target: { value: "a" } });
    expect((inputs[0] as HTMLInputElement).value).toBe("");
  });
});
