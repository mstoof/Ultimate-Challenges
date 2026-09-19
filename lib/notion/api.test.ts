import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotionConnection } from "@/db/schema";
const mocks = vi.hoisted(() => ({ update: vi.fn(), set: vi.fn(), where: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { update: mocks.update } }));
import { notionClient, oauthRequest } from "./api";
import { decrypt, encrypt } from "./security";

beforeEach(() => {
  vi.stubEnv("NOTION_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 4).toString("base64"));
  vi.stubEnv("NOTION_CLIENT_ID", "client-id");
  vi.stubEnv("NOTION_CLIENT_SECRET", "client-secret");
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: mocks.where });
  mocks.where.mockResolvedValue([]);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

const connection = () => ({ userId: "member", accessToken: encrypt("access", "member"), refreshToken: encrypt("refresh", "member") }) as NotionConnection;

describe("Notion API authentication and errors", () => {
  it("uses Basic authentication and an explicit version when revoking tokens", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ request_id: "request" }));
    vi.stubGlobal("fetch", fetch);
    await oauthRequest("revoke", { token: "token" });
    expect(fetch).toHaveBeenCalledWith("https://api.notion.com/v1/oauth/revoke", expect.objectContaining({
      headers: expect.objectContaining({ "Notion-Version": "2025-09-03", Authorization: `Basic ${Buffer.from("client-id:client-secret").toString("base64")}` }),
      body: JSON.stringify({ token: "token" }),
    }));
  });
  it("rotates expired credentials, stores encrypted replacements and retries with the new access token", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ access_token: "new-access", refresh_token: "new-refresh" }))
      .mockResolvedValueOnce(Response.json({ results: [] }));
    vi.stubGlobal("fetch", fetch);
    await notionClient(connection())("/search", "POST", {});
    const saved = mocks.set.mock.calls[0][0];
    expect(decrypt(saved.accessToken, "member")).toBe("new-access");
    expect(decrypt(saved.refreshToken, "member")).toBe("new-refresh");
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe("Bearer new-access");
  });
  it("does not blindly retry a failed create, and hides provider response details", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ message: "provider-secret-details" }, { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    await expect(notionClient(connection())("/pages", "POST", {})).rejects.toThrow("Notion is tijdelijk niet bereikbaar");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("returns a resumable error for long rate-limit delays", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}, { status: 429, headers: { "Retry-After": "60" } })));
    await expect(notionClient(connection())("/search", "POST", {})).rejects.toThrow("hervatten");
  });
});
