const COPYFACTORY_API = "https://copyfactory-api-v1.agiliumtrade.agiliumtrade.ai";

export interface CopyFactoryStrategy {
  _id: string;
  name: string;
  description?: string;
  positionLifecycle: string;
  connectionId: string;
  status: string;
}

export interface CopyFactorySubscriber {
  _id: string;
  subscriptions?: Array<{
    strategyId: string;
    multiplier: number;
  }>;
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
    throw new Error(`CopyFactory [${label}] ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export class CopyFactoryService {
  async createStrategy(
    strategyId: string,
    metaApiAccountId: string,
    name: string,
    description?: string,
  ): Promise<CopyFactoryStrategy> {
    const res = await fetch(
      `${COPYFACTORY_API}/users/current/configuration/strategies/${strategyId}`,
      {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          name,
          description: description ?? "PesaMatrix master copy trading strategy",
          positionLifecycle: "hedging",
          connectionId: metaApiAccountId,
          timeSettings: { lifetimeInHours: 876000, openingIntervalInMinutes: 5 },
          riskLimits: [],
          maxTradeRisk: 0.1,
        }),
      },
    );
    return handleResponse<CopyFactoryStrategy>(res, "createStrategy");
  }

  async getStrategy(strategyId: string): Promise<CopyFactoryStrategy> {
    const res = await fetch(
      `${COPYFACTORY_API}/users/current/configuration/strategies/${strategyId}`,
      { headers: authHeaders() },
    );
    return handleResponse<CopyFactoryStrategy>(res, "getStrategy");
  }

  async listStrategies(): Promise<CopyFactoryStrategy[]> {
    const res = await fetch(
      `${COPYFACTORY_API}/users/current/configuration/strategies`,
      { headers: authHeaders() },
    );
    return handleResponse<CopyFactoryStrategy[]>(res, "listStrategies");
  }

  async addSubscriber(
    subscriberAccountId: string,
    strategyId: string,
    multiplier = 1.0,
  ): Promise<void> {
    const current = await this.getSubscriber(subscriberAccountId).catch(() => null);
    const existingSubs = current?.subscriptions ?? [];
    const updatedSubs = [
      ...existingSubs.filter((s) => s.strategyId !== strategyId),
      { strategyId, multiplier },
    ];

    const res = await fetch(
      `${COPYFACTORY_API}/users/current/configuration/subscribers/${subscriberAccountId}`,
      {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ subscriptions: updatedSubs }),
      },
    );
    await handleResponse<void>(res, "addSubscriber");
  }

  async removeSubscriber(
    subscriberAccountId: string,
    strategyId: string,
  ): Promise<void> {
    const current = await this.getSubscriber(subscriberAccountId).catch(() => null);
    const updatedSubs = (current?.subscriptions ?? []).filter(
      (s) => s.strategyId !== strategyId,
    );

    const res = await fetch(
      `${COPYFACTORY_API}/users/current/configuration/subscribers/${subscriberAccountId}`,
      {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ subscriptions: updatedSubs }),
      },
    );
    await handleResponse<void>(res, "removeSubscriber");
  }

  async getSubscriber(subscriberAccountId: string): Promise<CopyFactorySubscriber> {
    const res = await fetch(
      `${COPYFACTORY_API}/users/current/configuration/subscribers/${subscriberAccountId}`,
      { headers: authHeaders() },
    );
    return handleResponse<CopyFactorySubscriber>(res, "getSubscriber");
  }
}

export const copyFactoryService = new CopyFactoryService();
