/**
 * Fabric-mode wiring: build the Rayfin client from the env Rayfin writes (`rayfin env --framework vite`) and the
 * runtime config Fabric hosting serves, then sign in with Fabric SSO. Follows the 2.x todoapp template:
 * `RayfinClient.create` + `browserSession`, `initEmbeddedAuth` on load, `ensureSignedInWithFabric` on click.
 */
import type { Viewer } from '../identity';

export interface FabricClientOptions {
  /** Register the data service (false for connector-only apps). Default true. */
  data?: boolean;
  /** Extra services for `RayfinClient.create`, for example `{ connectors: connectorsService(...) }`. */
  extraServices?: () => Record<string, unknown>;
}

export interface FabricSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  /** Resolves the viewer if a session already exists (embedded in Fabric or restored from storage). */
  restore(): Promise<Viewer | null>;
  /** Interactive Fabric sign-in. Must run from a click handler. */
  signIn(): Promise<Viewer>;
  signOut(): Promise<void>;
}

function toViewer(user: { id: string; email?: string | null; name?: string | null }): Viewer {
  return {
    sub: user.id,
    email: user.email ?? null,
    name: user.name || (user.email ? user.email.split('@')[0] : 'Signed-in user'),
  };
}

export async function createFabricSession(opts: FabricClientOptions = {}): Promise<FabricSession> {
  const [{ browserSession }, { RayfinClient, resolveRayfinConfig }, { dataService }, fabricAuth] = await Promise.all([
    import('@microsoft/rayfin-auth'),
    import('@microsoft/rayfin-client'),
    import('@microsoft/rayfin-data'),
    import('@microsoft/rayfin-auth-provider-fabric'),
  ]);

  const apiUrl = import.meta.env.VITE_RAYFIN_API_URL as string | undefined;
  const publishableKey = import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY as string | undefined;
  if (!apiUrl || !publishableKey) {
    throw new Error('This build has no Rayfin backend settings. Deploy with `npx rayfin up` or run `npm run dev` for the offline demo.');
  }
  const resolved = await resolveRayfinConfig({
    apiUrl: apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`,
    publishableKey,
    workspaceId: import.meta.env.VITE_FABRIC_WORKSPACE_ID,
    itemId: import.meta.env.VITE_FABRIC_ITEM_ID,
    portalUrl: import.meta.env.VITE_FABRIC_PORTAL_URL,
  });

  const services: Record<string, unknown> = { ...(opts.extraServices?.() ?? {}) };
  if (opts.data !== false) services.data = dataService();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = RayfinClient.create({
    baseUrl: resolved.baseUrl!,
    publishableKey: resolved.publishableKey!,
    runtimeConfig: resolved.runtimeConfig,
    auth: browserSession({ storage: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    services: services as any,
  });

  const rc = client.runtimeConfig ?? {};
  if (!rc.workspaceId || !rc.itemId || !rc.portalUrl) {
    throw new Error('Missing Fabric runtime config (workspace, item or portal URL). Redeploy with `npx rayfin up`.');
  }
  const fabricOptions = {
    workspaceId: rc.workspaceId,
    projectId: rc.itemId,
    fabricPortalUrl: rc.portalUrl,
    tenantId: rc.tenantId,
    returnOrigin: window.location.origin,
  };

  const current = (): Viewer | null => {
    const s = client.auth.getSession();
    return s?.isAuthenticated && s.user ? toViewer(s.user) : null;
  };

  return {
    client,
    async restore() {
      // Best effort: resolves null outside a Fabric iframe; never rejects by contract, but guard anyway.
      try {
        const embedded = await fabricAuth.initEmbeddedAuth(client.auth, fabricOptions);
        if (embedded?.isAuthenticated && embedded.user) return toViewer(embedded.user);
      } catch {
        /* fall through to a stored session */
      }
      return current();
    },
    async signIn() {
      const session = await fabricAuth.ensureSignedInWithFabric(client.auth, fabricOptions);
      if (!session.isAuthenticated || !session.user) {
        throw new Error('Fabric sign-in finished but no session was established.');
      }
      return toViewer(session.user);
    },
    async signOut() {
      await client.auth.signOut();
    },
  };
}
