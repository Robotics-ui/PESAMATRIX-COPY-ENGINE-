import { customFetch } from "@workspace/api-client-react";

export type ApiError = {
  message: string;
  status: number;
};

export type UserRole = "admin" | "subscriber";
export type DeploymentStatus = "pending" | "deploying" | "deployed" | "failed" | "undeployed";
export type SyncStatus = "connected" | "connecting" | "synchronizing" | "synchronized" | "disconnected" | "error";
export type SubscriptionStatus = "pending" | "active" | "expired" | "cancelled";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded" | "processing" | "cancelled";
export type CfRelationshipStatus = "pending" | "active" | "stopped" | "error";
export type MediaType = "image" | "video" | "youtube" | "external";
export type ResourceType = "pdf" | "document" | "guide" | "ebook" | "link";
export type NewsCategory = "article" | "market_update" | "economic_calendar";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Mt5Account {
  id: string;
  userId: string;
  login: string;
  broker: string;
  server: string;
  deploymentStatus: DeploymentStatus;
  synchronizationStatus: SyncStatus;
  isMaster: boolean;
  metaApiAccountId: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  numberOfDays: number;
  amountPaid: string;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, "id" | "email" | "firstName" | "lastName" | "phone">;
}

export interface ActiveSubscription extends Subscription {
  copyFactoryStatus?: CfRelationshipStatus | null;
  daysRemaining?: number | null;
  tradingDaysRemaining?: number | null;
}

export interface Payment {
  id: string;
  userId: string;
  subscriptionId: string | null;
  amount: string;
  phone: string;
  status: PaymentStatus;
  mpesaRef: string | null;
  stkPushRef: string | null;
  checkoutRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionSettings {
  subscriptionFeePerDay: string;
  minimumSubscriptionDays: number;
  maximumSubscriptionDays: number;
}

export interface SubscriptionPreview {
  days: number;
  pricePerDay: string;
  totalAmount: string;
  endDate?: string;
  startDate?: string;
  tradingDaysDescription?: string;
}

export interface AdminDashboard {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: string;
  totalMt5Accounts: number;
  recentPayments?: Payment[];
  recentSubscriptions?: Subscription[];
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  targetId: string | null;
  targetType: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user?: Pick<User, "id" | "email" | "firstName" | "lastName"> | null;
}

export interface QueueStats {
  queues: {
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }[];
}

export interface QueueHealth {
  status: "ok" | "degraded" | "error";
  redis: boolean;
  queues: { name: string; status: string }[];
}

export interface AdminUser extends User {
  subscriptionCount?: number;
  mt5AccountCount?: number;
  activeSubscription?: Subscription | null;
}

export interface CopyFactoryRelationship {
  id: string;
  subscriberUserId: string;
  subscriberMetaApiAccountId: string;
  masterMetaApiAccountId: string;
  subscriptionId: string;
  copyFactoryStrategyId: string;
  copyFactorySubscriberId: string;
  status: CfRelationshipStatus;
  isActive: boolean;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
}

export interface MasterAccount {
  id: string;
  login: string;
  broker: string;
  server: string;
  deploymentStatus: DeploymentStatus;
  synchronizationStatus: SyncStatus;
  metaApiAccountId: string | null;
}

export interface MediaItem {
  id: string;
  title: string;
  description: string | null;
  type: MediaType;
  url: string;
  thumbnailUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceItem {
  id: string;
  title: string;
  description: string | null;
  type: ResourceType;
  url: string;
  category: string;
  isActive: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  imageUrl: string | null;
  category: NewsCategory;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const r = <T>(url: string, opts?: RequestInit): Promise<T> =>
  customFetch<T>(url, opts);

export const api = {
  auth: {
    register: (body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    }) =>
      r<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    login: (body: { email: string; password: string }) =>
      r<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    logout: () =>
      r<{ message: string }>("/api/auth/logout", { method: "POST" }),

    refresh: () =>
      r<{ accessToken: string }>("/api/auth/refresh", { method: "POST" }),

    me: () => r<User>("/api/auth/me"),
  },

  mt5: {
    list: () => r<Mt5Account[]>("/api/mt5/accounts"),
    get: (id: string) => r<Mt5Account>(`/api/mt5/accounts/${id}`),
    register: (body: {
      login: string;
      password: string;
      broker: string;
      server: string;
    }) =>
      r<Mt5Account>("/api/mt5/accounts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    deploy: (id: string) =>
      r<{ jobId: string; message: string }>(`/api/mt5/accounts/${id}/deploy`, {
        method: "POST",
      }),
    getStatus: (id: string) => r<Mt5Account>(`/api/mt5/accounts/${id}/status`),
    enableCopyFactory: (id: string) =>
      r<{ message: string }>(`/api/mt5/accounts/${id}/copyfactory`, {
        method: "POST",
      }),
    remove: (id: string) =>
      r<{ message: string }>(`/api/mt5/accounts/${id}`, { method: "DELETE" }),
  },

  subscriptions: {
    settings: () =>
      r<SubscriptionSettings>("/api/subscriptions/settings"),
    preview: (days: number) =>
      r<SubscriptionPreview>(`/api/subscriptions/preview?days=${days}`),
    list: () => r<{ subscriptions: Subscription[] }>("/api/subscriptions/"),
    active: () => r<ActiveSubscription | null>("/api/subscriptions/active"),
    get: (id: string) => r<Subscription>(`/api/subscriptions/${id}`),
    cancel: (id: string) =>
      r<{ message: string }>(`/api/subscriptions/${id}/cancel`, {
        method: "POST",
      }),
    renew: (body: { planId: string; days: number; phone: string }) =>
      r<{ message: string; paymentId: string }>("/api/subscriptions/renew", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  payments: {
    initiate: (body: { days: number; phone: string }) =>
      r<{ paymentId: string; checkoutRequestId: string; message: string }>(
        "/api/payments/pay",
        { method: "POST", body: JSON.stringify(body) },
      ),
    list: () => r<Payment[]>("/api/payments/payments"),
    get: (id: string) => r<Payment>(`/api/payments/payments/${id}`),
    checkStatus: (body: { paymentId: string; checkoutRequestId?: string }) =>
      r<{ status: PaymentStatus; message: string }>("/api/payments/status", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  media: {
    list: () => r<{ media: MediaItem[] }>("/api/media"),
    get: (id: string) => r<{ media: MediaItem }>(`/api/media/${id}`),
    create: (body: {
      title: string;
      description?: string;
      type: MediaType;
      url: string;
      thumbnailUrl?: string;
    }) =>
      r<{ media: MediaItem }>("/api/media", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<{ title: string; description: string; type: MediaType; url: string; thumbnailUrl: string; isActive: boolean }>) =>
      r<{ media: MediaItem }>(`/api/media/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      r<{ message: string }>(`/api/media/${id}`, { method: "DELETE" }),
  },

  resources: {
    list: (params?: { category?: string; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.category) qs.set("category", params.category);
      if (params?.search) qs.set("search", params.search);
      return r<{ resources: ResourceItem[] }>(`/api/resources?${qs}`);
    },
    adminList: () => r<{ resources: ResourceItem[] }>("/api/resources/admin/all"),
    download: (id: string) =>
      r<{ url: string }>(`/api/resources/${id}/download`, { method: "POST" }),
    create: (body: {
      title: string;
      description?: string;
      type: ResourceType;
      url: string;
      category?: string;
    }) =>
      r<{ resource: ResourceItem }>("/api/resources", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<{ title: string; description: string; type: ResourceType; url: string; category: string; isActive: boolean }>) =>
      r<{ resource: ResourceItem }>(`/api/resources/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      r<{ message: string }>(`/api/resources/${id}`, { method: "DELETE" }),
  },

  news: {
    list: (params?: { category?: string; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.category) qs.set("category", params.category);
      if (params?.search) qs.set("search", params.search);
      return r<{ news: NewsItem[] }>(`/api/news?${qs}`);
    },
    adminList: () => r<{ news: NewsItem[] }>("/api/news/admin/all"),
    get: (id: string) => r<{ news: NewsItem }>(`/api/news/${id}`),
    create: (body: {
      title: string;
      content: string;
      excerpt?: string;
      imageUrl?: string;
      category: NewsCategory;
      isPublished?: boolean;
    }) =>
      r<{ news: NewsItem }>("/api/news", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<{ title: string; content: string; excerpt: string; imageUrl: string; category: NewsCategory; isPublished: boolean }>) =>
      r<{ news: NewsItem }>(`/api/news/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      r<{ message: string }>(`/api/news/${id}`, { method: "DELETE" }),
  },

  admin: {
    dashboard: () => r<AdminDashboard>("/api/admin/dashboard"),
    users: (params?: { page?: number; limit?: number; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.search) qs.set("search", params.search);
      return r<{ users: AdminUser[]; total: number }>(
        `/api/admin/users?${qs}`,
      );
    },
    user: (id: string) =>
      r<{ user: AdminUser; auditTrail: AuditLog[] }>(`/api/admin/users/${id}`),
    auditLogs: (params?: { page?: number; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      return r<{ logs: AuditLog[]; total: number }>(`/api/admin/audit-logs?${qs}`);
    },
    subscriptions: (params?: {
      status?: SubscriptionStatus;
      page?: number;
      limit?: number;
    }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      return r<{ subscriptions: Subscription[]; total: number }>(
        `/api/admin/subscriptions?${qs}`,
      );
    },
    subscriptionStats: () =>
      r<{
        total: number;
        active: number;
        expired: number;
        cancelled: number;
        pending: number;
        totalRevenue: string;
      }>("/api/admin/subscriptions/stats"),
    expireSubscription: (id: string) =>
      r<{ message: string }>(`/api/admin/subscriptions/${id}/expire`, {
        method: "POST",
      }),
    cancelSubscription: (id: string) =>
      r<{ message: string }>(`/api/admin/subscriptions/${id}/cancel`, {
        method: "POST",
      }),
    getSubscriptionSettings: () =>
      r<SubscriptionSettings>("/api/admin/subscription-settings"),
    updateSubscriptionSettings: (body: Partial<SubscriptionSettings>) =>
      r<SubscriptionSettings>("/api/admin/subscription-settings", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    masterAccount: () => r<MasterAccount>("/api/admin/master-account"),
    masterAccountStatus: () =>
      r<MasterAccount>("/api/admin/master-account/status"),
    copyFactorySubscribers: () =>
      r<{ subscribers: CopyFactoryRelationship[] }>(
        "/api/admin/copyfactory/subscribers",
      ),
    queueStats: () => r<QueueStats>("/api/admin/queue/stats"),
    queueHealth: () => r<QueueHealth>("/api/admin/queue/health"),
    payments: (params?: { page?: number; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      return r<{ payments: Payment[]; total: number }>(`/api/admin/payments?${qs}`);
    },
  },
};
