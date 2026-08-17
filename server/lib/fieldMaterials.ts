import { TRPCError } from "@trpc/server";

export const MAX_FIELD_MATERIAL_BYTES = 16 * 1024 * 1024;

export function decodeFieldMaterialPayload(dataUrl: string) {
  const matched = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!matched) throw new TRPCError({ code: "BAD_REQUEST", message: "파일 전송 형식이 올바르지 않습니다." });
  return { mimeType: matched[1], buffer: Buffer.from(matched[2], "base64") };
}

export function isAllowedFieldMaterialMimeType(attachmentType: "photo" | "sketch" | "drawing" | "document" | "audio" | "other", mimeType: string) {
  if (attachmentType === "audio") return /^audio\/(webm|mpeg|mp3|wav|wave|ogg|m4a|mp4)$/.test(mimeType);
  return /^(image\/(jpeg|png|webp)|application\/pdf|image\/svg\+xml)$/.test(mimeType);
}

export function sanitizeFieldMaterialName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "field-material";
}
