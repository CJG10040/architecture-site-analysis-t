import { describe, expect, it } from "vitest";
import { getMappableFieldPhotos } from "./fieldPhotoMap";

describe("getMappableFieldPhotos", () => {
  it("이미지형 현장 사진 중 유효한 좌표가 있는 항목만 지도 마커 후보로 반환한다", () => {
    const photos = getMappableFieldPhotos([
      { id: 1, attachmentType: "photo", mimeType: "image/jpeg", latitude: "35.1467", longitude: "126.9210" },
      { id: 2, attachmentType: "sketch", mimeType: "image/png", latitude: "35.1467", longitude: "126.9210" },
      { id: 3, attachmentType: "photo", mimeType: "image/png", latitude: null, longitude: "126.9210" },
      { id: 4, attachmentType: "photo", mimeType: "image/webp", latitude: "35.1470", longitude: "126.9220" },
    ]);
    expect(photos).toEqual([
      { id: 1, attachmentType: "photo", mimeType: "image/jpeg", latitude: 35.1467, longitude: 126.921 },
      { id: 4, attachmentType: "photo", mimeType: "image/webp", latitude: 35.147, longitude: 126.922 },
    ]);
  });
});
