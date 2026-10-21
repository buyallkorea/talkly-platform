/** Accept only same-site paths, including when parsed by a browser's URL parser. */
export function getSafeNextPath(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  ) {
    return null;
  }

  const base = "https://talkly.invalid";
  try {
    return new URL(value, base).origin === base ? value : null;
  } catch {
    return null;
  }
}
