// Resize camera originals before transport; the server independently decodes and validates them.
export async function preparePhoto(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 10 MB.");
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be opened. Choose another photo.");
  }
  const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const encoded = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  if (encoded.length > (2 * 1024 * 1024 * 4) / 3)
    throw new Error("This photo is too large. Choose a smaller image.");
  return encoded;
}
