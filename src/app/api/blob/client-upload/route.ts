import { auth } from "@/auth";
import {
  assertPathnameMatchesPayload,
  authorizeBlobClientPayload,
  parseClientPayloadJsonString,
} from "@/lib/blob-upload-auth";
import {
  getBlobReadWriteToken,
  isBlobStorageEnabled,
  vercelUploadsNotReadyResponse,
} from "@/lib/file-storage";
import { maxClientBlobUploadBytes } from "@/lib/issue-files";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export type { BlobClientUploadPayload } from "@/lib/blob-upload-auth";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = vercelUploadsNotReadyResponse();
  if (blocked) return blocked;
  if (!isBlobStorageEnabled()) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  }

  const rw = getBlobReadWriteToken();
  if (!rw) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      request,
      body,
      token: rw,
      onBeforeGenerateToken: async (pathname, clientPayloadRaw) => {
        const parsed = parseClientPayloadJsonString(clientPayloadRaw);
        if ("error" in parsed) {
          throw new Error(parsed.error);
        }
        const authz = await authorizeBlobClientPayload(parsed, session.user.id);
        if ("error" in authz) {
          throw new Error(authz.error);
        }
        assertPathnameMatchesPayload(pathname, parsed, session.user.id);

        const maxB = maxClientBlobUploadBytes();

        return {
          addRandomSuffix: false,
          maximumSizeInBytes: maxB,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
