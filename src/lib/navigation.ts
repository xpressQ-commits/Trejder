const allowedReturnPath = /^\/(?:app(?:\/.*)?|inbjudan\/[A-Za-z0-9_-]{32,200})$/;

export function safeReturnTo(value: string | undefined): string {
  if (!value || value.includes("\\") || /[\u0000-\u001F\u007F]/.test(value) || !allowedReturnPath.test(value)) return "/app";
  return value;
}
