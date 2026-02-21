import { AwsClient } from "aws4fetch";
import { ORPCError } from "@orpc/server";
import { settings } from "../config";

export class StorageService {
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    contentLength: number,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    if (
      !settings.S3_ENDPOINT ||
      !settings.S3_ACCESS_KEY_ID ||
      !settings.S3_SECRET_ACCESS_KEY ||
      !settings.S3_BUCKET_NAME ||
      !settings.S3_PUBLIC_URL_PREFIX
    ) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Storage is not configured",
      });
    }

    const client = new AwsClient({
      accessKeyId: settings.S3_ACCESS_KEY_ID,
      secretAccessKey: settings.S3_SECRET_ACCESS_KEY,
      region: settings.S3_REGION ?? "auto",
      service: "s3",
    });

    const url = `${settings.S3_ENDPOINT}/${settings.S3_BUCKET_NAME}/${key}`;
    const signed = await client.sign(
      new Request(url, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(contentLength),
        },
      }),
      { aws: { signQuery: true, allHeaders: true } },
    );
    return {
      uploadUrl: signed.url,
      publicUrl: `${settings.S3_PUBLIC_URL_PREFIX}/${key}`,
    };
  }
}
