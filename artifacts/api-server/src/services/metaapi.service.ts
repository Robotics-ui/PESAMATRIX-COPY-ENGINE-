const PROVISIONING_API = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

export type MetaApiAccountState =
  | "CREATED"
  | "DEPLOYING"
  | "DEPLOYED"
  | "UNDEPLOYING"
  | "UNDEPLOYED"
  | "ERROR";

export type MetaApiConnectionStatus = "CONNECTED" | "DISCONNECTED" | "DISCONNECTED_FROM_BROKER";

export interface MetaApiAccount {
  id: string;
  name: string;
  type: string;
  login: string;
  server: string;
  platform: string;
  state: MetaApiAccountState;
  connectionStatus: MetaApiConnectionStatus;
  region: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountParams {
  login: string;
  password: string;
  name: string;
  server: string;
  broker?: string;
  region?: string;
  platform?: "mt5" | "mt4";
}

function getToken(): string {
  const token = process.env.METAAPI_TOKEN;
  if (!token) throw new Error("METAAPI_TOKEN is not configured");
  return token;
}

function authHeaders() {
  return {
    "auth-token": getToken(),
    "Content-Type": "application/json",
  };
}

async function handleResponse<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch {}
    throw new Error(`MetaApi [${label}] ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export class MetaApiService {
  async createAccount(params: CreateAccountParams): Promise<MetaApiAccount> {
    const res = await fetch(`${PROVISIONING_API}/users/current/accounts`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        login: params.login,
        password: params.password,
        name: params.name,
        server: params.server,
        platform: params.platform ?? "mt5",
        magic: 0,
        region: params.region ?? "london",
        type: "cloud",
        tags: params.broker ? [params.broker] : [],
      }),
    });
    return handleResponse<MetaApiAccount>(res, "createAccount");
  }

  async getAccount(metaApiAccountId: string): Promise<MetaApiAccount> {
    const res = await fetch(
      `${PROVISIONING_API}/users/current/accounts/${metaApiAccountId}`,
      { headers: authHeaders() },
    );
    return handleResponse<MetaApiAccount>(res, "getAccount");
  }

  async deployAccount(metaApiAccountId: string): Promise<void> {
    const res = await fetch(
      `${PROVISIONING_API}/users/current/accounts/${metaApiAccountId}/deploy`,
      { method: "POST", headers: authHeaders() },
    );
    await handleResponse<void>(res, "deployAccount");
  }

  async undeployAccount(metaApiAccountId: string): Promise<void> {
    const res = await fetch(
      `${PROVISIONING_API}/users/current/accounts/${metaApiAccountId}/undeploy`,
      { method: "POST", headers: authHeaders() },
    );
    await handleResponse<void>(res, "undeployAccount");
  }

  async redeployAccount(metaApiAccountId: string): Promise<void> {
    const res = await fetch(
      `${PROVISIONING_API}/users/current/accounts/${metaApiAccountId}/redeploy`,
      { method: "POST", headers: authHeaders() },
    );
    await handleResponse<void>(res, "redeployAccount");
  }

  async deleteAccount(metaApiAccountId: string): Promise<void> {
    const res = await fetch(
      `${PROVISIONING_API}/users/current/accounts/${metaApiAccountId}`,
      { method: "DELETE", headers: authHeaders() },
    );
    await handleResponse<void>(res, "deleteAccount");
  }

  isSynchronized(account: MetaApiAccount): boolean {
    return (
      account.state === "DEPLOYED" &&
      account.connectionStatus === "CONNECTED"
    );
  }
}

export const metaApiService = new MetaApiService();
