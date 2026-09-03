import { Client } from "stoat.js";
import { completeOnboarding, login, type InstanceConfig, type LoginResponse } from "@radio/core";

export class StoatSession {
  readonly client: Client;
  readonly instance: InstanceConfig;
  readonly token: string;
  readonly sessionId: string;
  readonly userId: string;

  private constructor(instance: InstanceConfig, auth: LoginResponse, client: Client) {
    this.instance = instance;
    this.token = auth.token;
    this.sessionId = auth._id;
    this.userId = auth.user_id;
    this.client = client;
  }

  static async open(instance: InstanceConfig, email: string, password: string, signal?: AbortSignal): Promise<StoatSession> {
    const auth = await login(instance.endpoints, email, password, signal);
    return StoatSession.fromAuth(instance, auth, signal);
  }

  static async resume(instance: InstanceConfig, auth: LoginResponse, signal?: AbortSignal): Promise<StoatSession> {
    return StoatSession.fromAuth(instance, auth, signal);
  }

  private static async fromAuth(instance: InstanceConfig, auth: LoginResponse, signal?: AbortSignal): Promise<StoatSession> {
    const client = new Client({ baseURL: instance.endpoints.api, autoReconnect: true });
    const rawConfig = await client.api.get("/");
    client.configuration = { ...(rawConfig as any), ws: instance.endpoints.ws } as any;
    client.useExistingSession(auth);
    // 永久挂载基础错误捕获，彻底杜绝 EventEmitter 在 Release 模式下的 Unhandled 'error' event 崩溃
    client.on("error", (error) => {
      console.warn("[stoat sdk client error]", error);
    });
    const rawEvents = (client as any).events;
    if (rawEvents) {
      rawEvents.on("error", (error: unknown) => {
        console.warn("[stoat sdk events error]", error);
      });
      // 安全劫持 client.events.send，防止锁屏/网络断开时 heartbeat setInterval 抛出 "Socket closed, trying to send." 未捕获异常崩溃
      if (typeof rawEvents.send === "function") {
        const originalSend = rawEvents.send.bind(rawEvents);
        rawEvents.send = (event: any) => {
          try {
            originalSend(event);
          } catch (err) {
            console.warn("[stoat sdk safe send intercepted]", err);
          }
        };
      }
    }
    const session = new StoatSession(instance, auth, client);
    await session.connect(signal);
    return session;
  }

  async completeOnboarding(username: string, signal?: AbortSignal): Promise<void> {
    await completeOnboarding(this.instance.endpoints, this.token, username, signal);
  }

  async connect(signal?: AbortSignal): Promise<void> {
    if (this.client.ready()) return;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.client.off("ready", onReady);
        this.client.off("error", onError);
        signal?.removeEventListener("abort", onAbort);
        error ? reject(error) : resolve();
      };
      const onReady = () => finish();
      const onError = (error: unknown) => finish(error);
      const onAbort = () => {
        this.client.events.disconnect();
        finish(new Error("连接已取消"));
      };
      const timer = setTimeout(() => finish(new Error("WebSocket 就绪超时（15 秒）")), 15_000);
      this.client.on("ready", onReady);
      this.client.on("error", onError);
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) return onAbort();
      this.client.connect();
    });
  }

  async close(): Promise<void> {
    try {
      await this.client.api.post("/auth/session/logout");
    } catch (err) {
      console.warn("[session logout warning]", err);
    } finally {
      this.disconnect();
    }
  }

  disconnect(): void {
    try {
      this.client.removeAllListeners();
      this.client.on("error", () => {});
      const rawEvents = (this.client as any).events;
      if (rawEvents) {
        rawEvents.removeAllListeners();
        rawEvents.on("error", () => {});
        rawEvents.disconnect();
      }
    } catch (err) {
      console.warn("[session disconnect error]", err);
    }
  }
}
