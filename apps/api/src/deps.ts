import { createArtifactAccess } from "@agent-artifacts/access";
import {
  ArtifactService,
  AuditService,
  DrizzleArtifactRepository,
  DrizzleArtifactRoleResolver,
  DrizzleProjectRepository,
  ProfileService,
  ProjectService,
  ShareLinkService
} from "@agent-artifacts/artifact";
import { createAuth, type BetterAuthHandle } from "@agent-artifacts/auth";
import { BillingService, DrizzleBillingRepository } from "@agent-artifacts/billing";
import { loadServerEnv } from "@agent-artifacts/config";
import { createDb, type Database } from "@agent-artifacts/db";
import { S3ArtifactStorage } from "@agent-artifacts/storage";
import type { Principal } from "@agent-artifacts/shared";
import DodoPayments from "dodopayments";
import { DodoBillingGateway, UnavailableBillingGateway } from "./billing/dodo-gateway.js";
import { logger } from "./logger.js";

export type AppVariables = {
  requestId: string;
  principal?: Principal;
};

// Intentionally parallel to apps/web/lib/server-auth.ts: each process (API, Next) owns
// one DB pool and one better-auth instance; no shared runtime package between them.
let authInstance: BetterAuthHandle | undefined;
let artifactServiceInstance: ArtifactService | undefined;
let projectServiceInstance: ProjectService | undefined;
let profileServiceInstance: ProfileService | undefined;
let shareLinkServiceInstance: ShareLinkService | undefined;
let auditServiceInstance: AuditService | undefined;
let billingServiceInstance: BillingService | undefined;
let dbInstance: Database | undefined;

export function getDb() {
  dbInstance ??= createDb({
    connectionString: loadServerEnv().DATABASE_URL
  });

  return dbInstance;
}

export function getAuth() {
  authInstance ??= (() => {
    const env = loadServerEnv();
    const db = getDb();

    return createAuth({
      database: db,
      secret: env.BETTER_AUTH_SECRET,
      baseUrl: env.BETTER_AUTH_URL,
      webOrigin: env.PUBLIC_APP_URL,
      trustedOrigins: [env.BETTER_AUTH_URL, env.PUBLIC_APP_URL],
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET
    });
  })();

  return authInstance;
}

export function getArtifactService() {
  artifactServiceInstance ??= (() => {
    const env = loadServerEnv();
    const db = getDb();
    const storage = new S3ArtifactStorage({
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY
    });

    const roleResolver = new DrizzleArtifactRoleResolver(db);
    return new ArtifactService(
      new DrizzleArtifactRepository(db, logger),
      storage,
      env.PUBLIC_APP_URL,
      createArtifactAccess(roleResolver),
      getBillingService()
    );
  })();

  return artifactServiceInstance;
}

export function getProjectService() {
  projectServiceInstance ??= (() => {
    const env = loadServerEnv();
    const db = getDb();
    const roleResolver = new DrizzleArtifactRoleResolver(db);
    return new ProjectService(new DrizzleProjectRepository(db), env.PUBLIC_APP_URL, createArtifactAccess(roleResolver), getBillingService());
  })();

  return projectServiceInstance;
}

export function getProfileService() {
  profileServiceInstance ??= new ProfileService(getDb());
  return profileServiceInstance;
}

export function getShareLinkService() {
  shareLinkServiceInstance ??= new ShareLinkService(getDb(), loadServerEnv().PUBLIC_APP_URL);
  return shareLinkServiceInstance;
}

export function getAuditService() {
  auditServiceInstance ??= new AuditService(getDb());
  return auditServiceInstance;
}

export function getBillingService() {
  billingServiceInstance ??= (() => {
    const env = loadServerEnv();
    const gateway = env.DODO_PAYMENTS_API_KEY
      ? new DodoBillingGateway(
          new DodoPayments({
            bearerToken: env.DODO_PAYMENTS_API_KEY,
            environment: env.DODO_PAYMENTS_ENVIRONMENT
          })
        )
      : new UnavailableBillingGateway();

    return new BillingService(new DrizzleBillingRepository(getDb()), gateway);
  })();

  return billingServiceInstance;
}
