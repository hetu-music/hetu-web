// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/zh-CN";
import OtpStep from "./OtpStep";

const addToastMock = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  addToast: (...args: unknown[]) => addToastMock(...args),
}));

type Submit = (code: string) => Promise<string | null | undefined>;
type Resend = (token?: string) => Promise<string | null | undefined>;

function renderOtp({
  onSubmit = vi.fn<Submit>(async () => null),
  onResend,
}: { onSubmit?: ReturnType<typeof vi.fn<Submit>>; onResend?: Resend } = {}) {
  render(
    <NextIntlClientProvider locale="zh-CN" messages={messages}>
      <OtpStep onSubmit={onSubmit} submitLabel="验证" onResend={onResend} />
    </NextIntlClientProvider>,
  );
  return { onSubmit, inputs: screen.getAllByRole("textbox") };
}

/** 逐格输入，与键盘一位一位敲的效果一样 */
function typeCode(inputs: HTMLElement[], code: string) {
  code.split("").forEach((digit, i) => {
    fireEvent.change(inputs[i], { target: { value: digit } });
  });
}

afterEach(() => {
  cleanup();
  addToastMock.mockClear();
  vi.useRealTimers();
});

describe("OtpStep", () => {
  it("给了 onRestart 才有「重新填写」，点了回调", () => {
    const onRestart = vi.fn();
    render(
      <NextIntlClientProvider locale="zh-CN" messages={messages}>
        <OtpStep
          onSubmit={async () => null}
          submitLabel="验证"
          onRestart={onRestart}
        />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "重新填写" }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("六位填满自动提交，把整串验证码交给 onSubmit", async () => {
    const { onSubmit, inputs } = renderOtp();
    expect(inputs).toHaveLength(6);

    typeCode(inputs, "123456");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith("123456");
  });

  it("onSubmit 返回错误时显示出来，同一组数字不再自动提交", async () => {
    const onSubmit = vi.fn<Submit>(async () => "验证码错误");
    const { inputs } = renderOtp({ onSubmit });

    typeCode(inputs, "111111");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "验证码错误",
    );

    // 删掉最后一位再填回同一个数字：还是那组错码，不重复提交
    fireEvent.change(inputs[5], { target: { value: "" } });
    fireEvent.change(inputs[5], { target: { value: "1" } });
    await new Promise((r) => setTimeout(r, 50));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("只收数字", () => {
    const { inputs } = renderOtp();
    fireEvent.change(inputs[0], { target: { value: "a" } });
    expect((inputs[0] as HTMLInputElement).value).toBe("");
  });

  it("重新发送先倒数一分钟，到时才能点；发出后重新倒数", async () => {
    vi.useFakeTimers();
    const onResend = vi.fn<Resend>(async () => null);
    renderOtp({ onResend });

    const button = screen.getByRole("button", { name: /秒后可重新发送/ });
    expect(button).toHaveProperty("disabled", true);

    for (let i = 0; i < 60; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }
    const ready = screen.getByRole("button", { name: "重新发送" });
    expect(ready).toHaveProperty("disabled", false);

    await act(async () => {
      fireEvent.click(ready);
    });
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(addToastMock).toHaveBeenCalledWith("success", "已重新发送");
    expect(
      screen.getByRole("button", { name: /秒后可重新发送/ }),
    ).toHaveProperty("disabled", true);
  });

  it("重发失败时显示错误，不重新倒数", async () => {
    vi.useFakeTimers();
    const onResend = vi.fn<Resend>(async () => "邮件发送太频繁，请稍后再试");
    renderOtp({ onResend });

    for (let i = 0; i < 60; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重新发送" }));
    });
    expect(addToastMock).toHaveBeenCalledWith(
      "error",
      "邮件发送太频繁，请稍后再试",
    );
    expect(screen.getByRole("button", { name: "重新发送" })).toHaveProperty(
      "disabled",
      false,
    );
  });
});
