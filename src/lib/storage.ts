import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export async function uploadScanImage(
  userId: string,
  file: File,
  index: number
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `users/${userId}/scans/${Date.now()}_${index}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
