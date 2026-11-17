const INSECURE_SECRET_PLACEHOLDERS = new Set([
  "change-this-secret",
  "replace-with-a-long-random-secret",
  "field-visits-default-secret",
]);

const INSECURE_ADMIN_PASSWORDS = new Set([
  "Admin@123456",
  "SetAStrongUniquePasswordHere!",
  "password",
  "changeme",
]);

export const ENV = {
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "";
  },
  get cookieSecret() {
    return process.env.JWT_SECRET ?? "";
  },
  get ownerOpenId() {
    return process.env.OWNER_OPEN_ID ?? "";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get trustProxy() {
    return process.env.TRUST_PROXY === "1";
  },
  get appTimeZone() {
    return process.env.APP_TIMEZONE?.trim() || "Asia/Riyadh";
  },
};

export type InitialAdminCredentials = {
  openId: string;
  password: string;
  email: string;
};

export function resolveInitialAdminCredentials(
  env: NodeJS.ProcessEnv = process.env,
): InitialAdminCredentials {
  const isProd = env.NODE_ENV === "production";
  const openId = (env.INITIAL_ADMIN_OPENID ?? "").trim().toLowerCase();
  const password = env.INITIAL_ADMIN_PASSWORD ?? "";
  const email = (env.INITIAL_ADMIN_EMAIL || "admin@sindean.local").trim().toLowerCase();

  if (isProd) {
    if (!openId) {
      throw new Error("[Security] INITIAL_ADMIN_OPENID must be set explicitly in production.");
    }
    if (password.trim().length < 8 || INSECURE_ADMIN_PASSWORDS.has(password.trim())) {
      throw new Error(
        "[Security] INITIAL_ADMIN_PASSWORD must be a unique password of at least 8 characters in production.",
      );
    }
    return { openId, password, email };
  }

  return {
    openId: openId || "admin",
    password: password || "Admin@123456",
    email,
  };
}

export function getCookieSecret(env: NodeJS.ProcessEnv = process.env): string {
  const isProd = env.NODE_ENV === "production";
  const secret = (env.JWT_SECRET ?? "").trim();
  if (isProd) {
    if (!secret || secret.length < 32 || INSECURE_SECRET_PLACEHOLDERS.has(secret)) {
      throw new Error(
        "[Security] JWT_SECRET must be set to a random string of at least 32 characters in production.",
      );
    }
    return secret;
  }
  return secret || "dev-only-field-visits-secret-do-not-use-in-prod";
}

export function validateProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;

  if (!(env.DATABASE_URL ?? "").trim()) {
    throw new Error("[Config] DATABASE_URL is required in production.");
  }

  getCookieSecret(env);
  resolveInitialAdminCredentials(env);

  if (env.DEMO_MODE_ENABLED === "true") {
    throw new Error("[Security] DEMO_MODE_ENABLED=true is forbidden when NODE_ENV=production.");
  }
}
