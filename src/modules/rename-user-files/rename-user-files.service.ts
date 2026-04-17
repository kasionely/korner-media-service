import { renameUserFilesInAllBuckets, RenameResult } from "../../utils/renameUserFiles";

export async function renameUserFiles(
  oldUsername: string,
  newUsername: string
): Promise<RenameResult> {
  return renameUserFilesInAllBuckets(oldUsername, newUsername);
}
