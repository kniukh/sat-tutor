import "server-only";

export function buildSessionBackedStudentPath(
  accessCode: string,
  suffix = "",
  query?: Record<string, string | null | undefined>
) {
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  const pathname = `/s/${accessCode}${suffix ? normalizedSuffix : ""}`;

  if (!query) {
    return pathname;
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.length > 0) {
      searchParams.set(key, value);
    }
  }

  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}
