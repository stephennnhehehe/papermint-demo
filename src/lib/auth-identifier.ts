const testAccountPattern = /^test-0[1-5]$/i;

export function authEmailForSignIn(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  return testAccountPattern.test(normalized)
    ? `${normalized}@papermint.test`
    : normalized;
}
