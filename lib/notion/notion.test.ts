import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainingBlock } from "@/db/schema";
vi.mock("@/db/client", () => ({ db: {} }));
import { planTasks, richText, sessionDate } from "./format";
import { decrypt, encrypt, sameOrigin, validState } from "./security";
import { exportTask } from "./export";
import { NotionError, type NotionClient } from "./api";

const block = {
  weeks: { focus: "Opbouw", weeks: [{ week: 1, startDate: "2026-09-07", theme: "Rustig", note: "Neem rust", sessions: [
    { id: "block:1:0", day: "zo", type: "gym", title: "Kracht", duration: "45 min", detail: "Rustig uitvoeren", exercises: [{ name: "Squat", prescription: "3×8" }] },
  ] }] },
} as TrainingBlock;

beforeEach(() => vi.stubEnv("NOTION_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64")));
afterEach(() => vi.unstubAllEnvs());

describe("Notion credentials and OAuth state", () => {
  it("encrypts with a fresh nonce and binds credentials to the correct member", () => {
    const value = encrypt("secret-token", "member-a");
    expect(value).not.toContain("secret-token");
    expect(encrypt("secret-token", "member-a")).not.toBe(value);
    expect(decrypt(value, "member-a")).toBe("secret-token");
    expect(() => decrypt(value, "member-b")).toThrow();
    const parts = value.split(".");
    const nonce = Buffer.from(parts[0], "base64url");
    nonce[0] ^= 1;
    parts[0] = nonce.toString("base64url");
    expect(() => decrypt(parts.join("."), "member-a")).toThrow();
  });
  it("rejects expired, tampered, cross-member and missing OAuth states", () => {
    const cookie = encrypt(JSON.stringify({ state: "random-state", expires: Date.now() + 60000 }), "member-a");
    expect(validState(cookie, "random-state", "member-a")).toBe(true);
    expect(validState(cookie, "random-state", "member-b")).toBe(false);
    expect(validState(cookie, "different", "member-a")).toBe(false);
    expect(validState(undefined, "random-state", "member-a")).toBe(false);
    expect(validState(encrypt(JSON.stringify({ state: "random-state", expires: 0 }), "member-a"), "random-state", "member-a")).toBe(false);
  });
  it("requires the request origin for mutations", () => {
    expect(sameOrigin(new Request("https://app.example/api/notion", { headers: { origin: "https://app.example" } }))).toBe(true);
    expect(sameOrigin(new Request("https://app.example/api/notion", { headers: { origin: "https://evil.example" } }))).toBe(false);
    expect(sameOrigin(new Request("https://app.example/api/notion"))).toBe(false);
  });
});

describe("Notion plan formatting", () => {
  it("exports date, instructions and exercise prescriptions without overwriting Notion checkmarks", () => {
    const [task, stale] = planTasks([block], ["block:1:0"], ["old-session"]);
    expect(task.done).toBe(true);
    expect(task.properties.Datum).toEqual({ date: { start: "2026-09-13" } });
    expect(task.properties.Oefeningen).toEqual({ rich_text: richText("Squat: 3×8") });
    expect(task.properties).not.toHaveProperty("Klaar");
    expect(stale).toMatchObject({ sessionId: "old-session", stale: true, properties: { Actueel: { checkbox: false } } });
  });
  it("splits long instructions at the API limit without dropping text", () => {
    const text = "x".repeat(6500);
    const parts = richText(text);
    expect(parts.every((part) => part.text.content.length <= 2000)).toBe(true);
    expect(parts.map((part) => part.text.content).join("")).toBe(text);
  });
  it("rejects unknown weekdays and handles a week across a year boundary", () => {
    expect(sessionDate("2026-12-28", "zo")).toBe("2027-01-03");
    expect(() => sessionDate("2026-12-28", "nonsense")).toThrow();
  });
});

describe("repeatable Notion export", () => {
  it("creates a new row with its initial completion state", async () => {
    const request = vi.fn().mockResolvedValueOnce({ results: [] }).mockResolvedValueOnce({ id: "new-page" });
    const [task] = planTasks([block], ["block:1:0"], []);
    expect(await exportTask(request as NotionClient, "source", task)).toBe("new-page");
    expect(request.mock.calls[1]).toEqual(["/pages", "POST", {
      parent: { type: "data_source_id", data_source_id: "source" }, properties: { ...task.properties, Klaar: { checkbox: true } },
    }]);
  });
  it("recovers a created page after an interrupted local checkpoint", async () => {
    const request = vi.fn().mockResolvedValueOnce({ results: [{ id: "existing-page" }] }).mockResolvedValueOnce({});
    const [task] = planTasks([block], [], []);
    expect(await exportTask(request as NotionClient, "source", task)).toBe("existing-page");
    expect(request.mock.calls[1]).toEqual(["/pages/existing-page", "PATCH", { properties: task.properties }]);
    expect(request.mock.calls.some(([path]) => path === "/pages")).toBe(false);
  });
  it("updates known rows and preserves their Notion completion and page body", async () => {
    const request = vi.fn().mockResolvedValue({});
    const [task] = planTasks([block], [], []);
    await exportTask(request as NotionClient, "source", task, "existing-page");
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("/pages/existing-page", "PATCH", { properties: task.properties });
    expect(task.properties).not.toHaveProperty("Klaar");
  });
  it("does not create duplicates when an existing row becomes inaccessible", async () => {
    const request = vi.fn().mockRejectedValue(new NotionError(404, "No access"));
    const [task] = planTasks([block], [], []);
    await expect(exportTask(request as NotionClient, "source", task, "existing-page")).rejects.toThrow("No access");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
