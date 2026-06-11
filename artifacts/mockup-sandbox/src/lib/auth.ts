let _accessToken: string | null = null;

export function setToken(token: string | null): void {
  _accessToken = token;
}

export function getToken(): string | null {
  return _accessToken;
}
