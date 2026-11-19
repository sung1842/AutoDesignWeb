// 외부 네트워크 차단(09장 9.5.5 F09). NO_EXTERNAL_NETWORK=1이면 localhost 외 연결을 즉시 예외로 막는다.
// undici 패키지가 허용 목록에 없어 디스패처 대신 fetch 래퍼 + net.Socket.connect 가드로 구현한다(AD-026).
import net from "node:net";

export const E_EXTERNAL_NETWORK = "E_EXTERNAL_NETWORK";

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "0.0.0.0",
  "host.docker.internal",
]);

export function isLocalHost(host: string): boolean {
  const h = host.toLowerCase();
  return LOCAL_HOSTS.has(h) || h.endsWith(".localhost") || /^127\.\d+\.\d+\.\d+$/.test(h);
}

export class ExternalNetworkError extends Error {
  readonly code = E_EXTERNAL_NETWORK;
  constructor(target: string) {
    super(`${E_EXTERNAL_NETWORK}: 외부 네트워크 차단(NO_EXTERNAL_NETWORK=1): ${target}`);
    this.name = "ExternalNetworkError";
  }
}

function hostOf(input: unknown): string | undefined {
  if (typeof input === "string") return new URL(input).hostname;
  if (input instanceof URL) return input.hostname;
  if (input instanceof Request) return new URL(input.url).hostname;
  return undefined;
}

type ConnectFn = (...args: unknown[]) => net.Socket;

/**
 * 가드를 설치하고 해제 함수를 돌려준다. env.NO_EXTERNAL_NETWORK가 "1"이 아니면 아무것도 하지 않는다.
 */
export function installNetworkGuard(
  env: Record<string, string | undefined> = process.env,
): () => void {
  if (env.NO_EXTERNAL_NETWORK !== "1") return () => undefined;
  const origFetch = globalThis.fetch;
  const proto = net.Socket.prototype as unknown as { connect: ConnectFn };
  const origConnect = proto.connect;

  globalThis.fetch = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const host = hostOf(input);
    if (host !== undefined && !isLocalHost(host))
      return Promise.reject(new ExternalNetworkError(host));
    return origFetch(input, init);
  };
  proto.connect = function guarded(this: net.Socket, ...args: unknown[]): net.Socket {
    const first = args[0];
    const host =
      typeof first === "object" && first !== null && "host" in first
        ? String((first as { host?: unknown }).host ?? "localhost")
        : typeof args[1] === "string"
          ? args[1]
          : undefined;
    const isPipe = typeof first === "object" && first !== null && "path" in first;
    if (!isPipe && host !== undefined && !isLocalHost(host)) throw new ExternalNetworkError(host);
    return origConnect.apply(this, args);
  };
  return () => {
    globalThis.fetch = origFetch;
    proto.connect = origConnect;
  };
}
