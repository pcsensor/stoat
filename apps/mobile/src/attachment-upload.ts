import { File, UploadType } from "expo-file-system";
import type { InstanceConfig } from "@radio/core";

export interface UploadedAttachment {
  id: string;
  url: string;
}

export async function uploadAttachment(
  instance: InstanceConfig,
  sessionToken: string,
  uri: string,
  mimeType: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<UploadedAttachment> {
  const autumn = instance.endpoints.autumn;
  if (!autumn) throw new Error("该实例未提供附件上传服务");

  const file = new File(uri);
  const task = file.createUploadTask(`${autumn}/attachments`, {
    uploadType: UploadType.MULTIPART,
    fieldName: "file",
    mimeType,
    headers: { "X-Session-Token": sessionToken },
    signal,
    onProgress: ({ bytesSent, totalBytes }) => {
      if (totalBytes > 0) onProgress?.(bytesSent / totalBytes);
    },
  });

  try {
    const result = await task.uploadAsync();
    let body: unknown;
    try {
      body = result.body ? JSON.parse(result.body) : undefined;
    } catch {
      throw new Error("附件上传返回了无效 JSON");
    }
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`附件上传失败（${result.status}）`);
    }
    if (!body || typeof body !== "object" || typeof (body as { id?: unknown }).id !== "string") {
      throw new Error("附件上传响应缺少文件 ID");
    }
    const id = (body as { id: string }).id;
    return { id, url: `${autumn}/attachments/${encodeURIComponent(id)}` };
  } finally {
    task.release();
  }
}
