import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';

interface Step {
  name?: string;
  if?: string;
  run?: string;
  uses?: string;
}

const load = (file: string) =>
  parse(readFileSync(`.github/workflows/${file}`, 'utf8'));

const ci = load('ci.yml');
const runs = (job: string) =>
  (ci.jobs[job].steps as Step[]).map((s) => s.run ?? '').join('\n');

describe('CI workflow', () => {
  it('runs on pull requests and can be called by the deploy workflows', () => {
    expect(ci.on.pull_request.branches).toEqual(['main']);
    expect(ci.on).toHaveProperty('workflow_call');
  });

  it('has a separate job for each test layer', () => {
    expect(Object.keys(ci.jobs)).toEqual(['validate', 'integration', 'e2e']);
  });

  it('validates formatting, lint, types and unit tests', () => {
    const run = runs('validate');
    for (const command of [
      'npm run format:check',
      'npm run lint',
      'npm run check',
      'npm run test:unit:run',
    ]) {
      expect(run).toContain(command);
    }
  });

  it('runs the integration tests', () => {
    expect(runs('integration')).toContain('npm run test:integration');
  });

  it('builds the app, installs Chromium and runs the end-to-end tests', () => {
    const run = runs('e2e');
    expect(run).toContain('npm run build');
    expect(run).toContain('npx playwright install --with-deps chromium');
    expect(run).toContain('npm run test:e2e');
  });

  it('keeps the Playwright report when the end-to-end tests fail', () => {
    const upload = (ci.jobs.e2e.steps as Step[]).find((s) =>
      s.uses?.startsWith('actions/upload-artifact'),
    );
    expect(upload?.if).toBe('failure()');
  });
});

describe('container deploy', () => {
  const workflow = load('container.yml');
  const deploy = workflow.jobs.deploy;
  const run = () => (deploy.steps as Step[]).map((s) => s.run ?? '').join('\n');

  it('runs only on main, after the image has been pushed', () => {
    expect(deploy.needs).toBe('image');
    expect(deploy.if).toContain("github.event_name == 'push'");
    expect(deploy.if).toContain("needs.image.result == 'success'");
  });

  it('never runs two deploys at the same time', () => {
    expect(deploy.concurrency.group).toBe('deploy-service');
    expect(deploy.concurrency['cancel-in-progress']).toBe(false);
  });

  it('deploys the image tagged with this commit, not latest', () => {
    expect(run()).toContain(
      'npx cdk deploy ServiceStack -c imageTag="${GITHUB_SHA::7}"',
    );
  });

  it('smoke tests the health endpoint of the deployed service', () => {
    expect(run()).toMatch(/curl -fsS .*\$URL\/api\/health/);
  });

  // GitHub then links the live URL from the repo page and the workflow run
  it('deploys to the production environment with the service URL', () => {
    const urlStep = (deploy.steps as (Step & { id?: string })[]).find(
      (s) => s.id === 'service',
    );
    expect(urlStep?.run).toContain('echo "url=$URL" >> "$GITHUB_OUTPUT"');
    expect(deploy.environment).toEqual({
      name: 'production',
      url: '${{ steps.service.outputs.url }}',
    });
  });

  // The address stays out of the public repo; an empty secret means no email
  it('passes the alarm email from a secret to the deploy', () => {
    const deployStep = (
      deploy.steps as (Step & { env?: Record<string, string> })[]
    ).find((s) => s.name === 'Deploy the service');
    expect(deployStep?.env?.ALARM_EMAIL).toBe('${{ secrets.ALARM_EMAIL }}');
    expect(deployStep?.run).toContain('-c alarmEmail="$ALARM_EMAIL"');
  });

  it('writes the URL and image tag to the job summary', () => {
    const summary = run()
      .split('\n')
      .filter((line) => line.includes('$GITHUB_STEP_SUMMARY'))
      .join('\n');
    expect(summary).toContain('$URL');
    expect(summary).toContain('${GITHUB_SHA::7}');
  });
});

describe('deploys wait for CI', () => {
  const gated = [
    ['static site deploy', 'deploy-static.yml', 'deploy'],
    ['container image push', 'container.yml', 'image'],
  ] as const;

  for (const [name, file, job] of gated) {
    it(`${name} starts only after CI has passed on main`, () => {
      const workflow = load(file);

      expect(workflow.jobs.test.uses).toBe('./.github/workflows/ci.yml');
      expect(workflow.jobs.test.if).toBe("github.event_name == 'push'");
      expect(workflow.jobs[job].needs).toBe('test');
      expect(workflow.jobs[job].if).toContain("needs.test.result == 'success'");
      // Pull requests skip the test job, and must still reach the dry run
      expect(workflow.jobs[job].if).toContain("needs.test.result == 'skipped'");
    });
  }
});

// GitHub lists the static site under Deployments next to the service
describe('static deploy', () => {
  const deploy = load('deploy-static.yml').jobs.deploy;

  // The same job runs a dry run on pull requests, which is no deploy
  it('records a deployment of the static site only on main', () => {
    expect(deploy.environment.name).toBe(
      "${{ github.event_name == 'push' && 'production - static' || '' }}",
    );
  });

  it('links the deployment to the site URL', () => {
    const site = (deploy.steps as (Step & { id?: string })[]).find(
      (s) => s.id === 'site',
    );
    expect(site?.run).toContain('echo "url=$URL" >> "$GITHUB_OUTPUT"');
    expect(deploy.environment.url).toBe('${{ steps.site.outputs.url }}');
  });
});
