import { Card, PageHeader } from '@x10/shared/ui';

/** About panel: what the app is for, how it works, and any thresholds from config.ts. */
export function AboutPage() {
  return (
    <>
      <PageHeader title="About __TITLE__" subtitle="__TAGLINE__" />
      <Card>
        <p className="mt-0">Describe the app, its rules and its limits here.</p>
        <p className="mb-0 text-sm text-muted">Built by Datachain Consulting for AI @Work. Runs on Microsoft Fabric Apps (preview).</p>
      </Card>
    </>
  );
}
