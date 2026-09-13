export const MAX_ATTACHMENT_TEXT_CHARS = 9000;

export async function attachmentTextPreview(file: Blob): Promise<string> {
  const decoded = await file.slice(0, MAX_ATTACHMENT_TEXT_CHARS * 4).text();
  return decoded.slice(0, MAX_ATTACHMENT_TEXT_CHARS);
}
