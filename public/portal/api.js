export async function api(path, method = "GET", data) {
  const response = await fetch("/api/portal/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "fetch",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}
