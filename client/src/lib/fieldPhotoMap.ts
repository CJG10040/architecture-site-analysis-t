export type FieldPhotoMapSource = { id: number; attachmentType: string; mimeType: string; latitude: string | null; longitude: string | null };

export function getMappableFieldPhotos<T extends FieldPhotoMapSource>(attachments: T[]) {
  return attachments.flatMap(item => {
    if (item.latitude === null || item.longitude === null || !item.latitude.trim() || !item.longitude.trim()) return [];
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);
    if (item.attachmentType !== "photo" || !item.mimeType.startsWith("image/") || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
    return [{ ...item, latitude, longitude }];
  });
}
