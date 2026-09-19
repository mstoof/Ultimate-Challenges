import { beforeEach, expect, it, vi } from "vitest";
import type { NotionConnection } from "@/db/schema";
const mocks = vi.hoisted(() => ({ update: vi.fn(), set: vi.fn(), where: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { update: mocks.update } }));
import { exportBatch } from "./export";
import type { NotionClient } from "./api";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: mocks.where });
  mocks.where.mockResolvedValue([]);
});

it("saves each completed row and resumes from that checkpoint", async () => {
  const connection = {
    userId: "member", dataSourceId: "source", pageMap: {}, lastExportedAt: null,
    exportJob: { cursor: 0, startedAt: "2026-09-12", tasks: [
      { sessionId: "a", properties: {} }, { sessionId: "b", properties: {} },
    ] },
  } as unknown as NotionConnection;
  const request = vi.fn().mockResolvedValueOnce({ results: [] }).mockResolvedValueOnce({ id: "page-a" })
    .mockResolvedValueOnce({ results: [] }).mockResolvedValueOnce({ id: "page-b" });
  expect(await exportBatch(connection, request as NotionClient)).toEqual({ completed: 2, total: 2, finished: true });
  expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ pageMap: { a: "page-a", b: "page-b" }, exportJob: null }));
  expect(connection.pageMap).toEqual({ a: "page-a", b: "page-b" });
  expect(connection.exportJob).toBeNull();
  expect(connection.lastExportedAt).toBeInstanceOf(Date);
});

it("leaves progress unchanged when the provider call fails", async () => {
  const connection = {
    userId: "member", dataSourceId: "source", pageMap: {}, exportJob: { cursor: 0, tasks: [{ sessionId: "a", properties: {} }] },
  } as unknown as NotionConnection;
  const request = vi.fn().mockRejectedValue(new Error("offline"));
  await expect(exportBatch(connection, request as NotionClient)).rejects.toThrow("offline");
  expect(connection.exportJob?.cursor).toBe(0);
  expect(mocks.update).not.toHaveBeenCalled();
});
