export async function uploadScanImage(
  userId: string,
  file: File,
  index: number
): Promise<string> {
  const folder = `workia/${userId}/scans`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || "Error subiendo imagen");
  }

  return data.url;
}
