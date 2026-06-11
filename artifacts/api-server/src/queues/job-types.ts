// ─── AccountDeploymentQueue ────────────────────────────────────────────────────

export type DeploySubscriberJob = {
  type: "deploy-subscriber";
  mt5AccountDbId: string;
  userId: string;
  login: string;
  password: string;
  server: string;
  broker: string;
  region?: string;
  multiplier?: number;
};

export type DeployMasterJob = {
  type: "deploy-master";
  mt5AccountDbId: string;
  userId: string;
  login: string;
  password: string;
  server: string;
  broker: string;
  region?: string;
};

export type RemoveAccountJob = {
  type: "remove-account";
  mt5AccountDbId: string;
  userId: string;
  login: string;
};

export type AccountDeploymentJobData =
  | DeploySubscriberJob
  | DeployMasterJob
  | RemoveAccountJob;

// ─── CopyFactoryQueue ─────────────────────────────────────────────────────────

export type RegisterSubscriberJob = {
  type: "register-subscriber";
  userId: string;
  metaApiAccountId: string;
  subscriptionId?: string;
  multiplier?: number;
};

export type RemoveSubscriberJob = {
  type: "remove-subscriber";
  userId: string;
  metaApiAccountId: string;
  reason?: "expired" | "cancelled" | "manual";
};

export type CopyFactoryJobData = RegisterSubscriberJob | RemoveSubscriberJob;

// ─── SubscriptionQueue ────────────────────────────────────────────────────────

export type ActivateSubscriptionJob = {
  type: "activate-subscription";
  subscriptionId: string;
  userId: string;
  paymentId?: string;
  mpesaRef?: string;
  paidAmount?: number;
};

export type ExpireSubscriptionJob = {
  type: "expire-subscription";
  subscriptionId: string;
  userId: string;
};

export type CancelSubscriptionJob = {
  type: "cancel-subscription";
  subscriptionId: string;
  userId: string;
  reason?: string;
};

export type SubscriptionJobData =
  | ActivateSubscriptionJob
  | ExpireSubscriptionJob
  | CancelSubscriptionJob;

// ─── PaymentQueue ─────────────────────────────────────────────────────────────

export type PollPaymentStatusJob = {
  type: "poll-payment-status";
  paymentId: string;
  checkoutRequestId: string;
  userId: string;
};

export type PaymentJobData = PollPaymentStatusJob;

// ─── NotificationQueue ────────────────────────────────────────────────────────

export type PaymentConfirmedNotification = {
  type: "payment-confirmed";
  userId: string;
  mpesaRef: string;
  amount: number;
  subscriptionId: string;
};

export type PaymentFailedNotification = {
  type: "payment-failed";
  userId: string;
  reason: string;
  paymentId: string;
};

export type SubscriptionActivatedNotification = {
  type: "subscription-activated";
  userId: string;
  subscriptionId: string;
  endDate: string;
};

export type SubscriptionExpiredNotification = {
  type: "subscription-expired";
  userId: string;
  subscriptionId: string;
};

export type DeploymentCompleteNotification = {
  type: "deployment-complete";
  userId: string;
  mt5AccountId: string;
  login: string;
};

export type DeploymentFailedNotification = {
  type: "deployment-failed";
  userId: string;
  mt5AccountId: string;
  login: string;
  error: string;
};

export type NotificationJobData =
  | PaymentConfirmedNotification
  | PaymentFailedNotification
  | SubscriptionActivatedNotification
  | SubscriptionExpiredNotification
  | DeploymentCompleteNotification
  | DeploymentFailedNotification;
