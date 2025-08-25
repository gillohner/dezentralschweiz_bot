// utils/blossomUpload.js
import { BlossomClient } from "blossom-client-sdk";
import { getEventHash, finalizeEvent } from "nostr-tools";
import { getPublicKey } from "nostr-tools";
import config from "../bot/config.js";

// Signer using the bot’s private key
const botSigner = async (draft) => {
  const privkey = config.BOT_NSEC;
  if (!privkey) {
    throw new Error("BOT_NSEC is not set in config");
  }
  const event = {
    ...draft,
    pubkey: getPublicKey(privkey),
    created_at: Math.floor(Date.now() / 1000),
  };
  // finalizeEvent returns { id, sig, ...event }
  return finalizeEvent(event, privkey);
};

// Inspect first bytes of the buffer to detect common image MIME types
const detectMimeType = (buffer) => {
  if (!buffer || buffer.length < 4) return null;
  // JPEG: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 0x89 0x50 0x4E 0x47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  // GIF: "GIF"
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "image/gif";
  }
  // WebP: bytes 8–11 == "WEBP"
  if (
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
};

// Map MIME to file extension
const extensionForMime = (mime) => {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
};

export const uploadImageToBlossom = async (
  imageBuffer,
  mimeType = "image/jpeg"
) => {
  // Determine actual MIME
  const actualMime = detectMimeType(imageBuffer) || mimeType;
  const ext = extensionForMime(actualMime);
  const filename = `upload.${ext}`;

  // Create the Blossom client
  const server = config.BLOSSOM_SERVER_URL || "https://blossom.nostr.build";
  const client = new BlossomClient(server, botSigner);

  // Construct a File-like object
  // Note: Node.js v18+ has global File; for older versions you can
  // import `File` from `fetch-blob` or `node-fetch`.
  const file = new File([imageBuffer], filename, {
    type: actualMime,
    lastModified: Date.now(),
  });

  // Obtain upload authorization
  const uploadAuth = await client.createUploadAuth(file, {
    message: actualMime,
  });

  // Upload and return URL
  const { url } = await client.uploadBlob(file, { auth: uploadAuth });
  return url;
};
