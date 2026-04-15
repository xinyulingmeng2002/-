const BOUNDARY = "----ma-test-boundary";

export const multipartHeaders = {
  "content-type": `multipart/form-data; boundary=${BOUNDARY}`
};

export function makeMultipartFile(filename: string, contentType: string, content: Buffer): Buffer {
  const preamble =
    `--${BOUNDARY}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const epilogue = `\r\n--${BOUNDARY}--\r\n`;

  return Buffer.concat([Buffer.from(preamble, "utf8"), content, Buffer.from(epilogue, "utf8")]);
}
