'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, mkdtempSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const { parse } = require('yaml');

const { resolveTaskId, planEvent, transitionAllowed } = require('./clickup-status-sync.cjs');

const repo = {
  full_name: 'Thairun/fotobots-whitelabel',
  default_branch: 'main',
};

test('push resolves task from branch and moves work to in progress', () => {
  const payload = {
    ref: 'refs/heads/feat/DEV-4346-samsung-vod',
    after: 'abcdef1234567890',
    repository: repo,
  };
  assert.equal(resolveTaskId('push', payload), 'DEV-4346');
  assert.equal(planEvent('push', payload).status, 'in progress');
});

test('default branch push is ignored', () => {
  const plan = planEvent('push', {
    ref: 'refs/heads/main',
    after: 'abcdef',
    repository: repo,
  });
  assert.match(plan.skip, /Integration-branch pushes/);
});

test('open PR resolves task from branch before IDs mentioned in body', () => {
  const payload = {
    action: 'opened',
    repository: repo,
    pull_request: {
      number: 42,
      head: { ref: 'feat/DEV-4346-samsung-vod' },
      title: 'Fix Samsung playback',
      body: 'Depends on DEV-4000 and DEV-4001',
      html_url: 'https://github.com/Thairun/fotobots-whitelabel/pull/42',
      updated_at: '2026-09-01T00:00:00Z',
      draft: false,
    },
  };
  assert.equal(resolveTaskId('pull_request_target', payload), 'DEV-4346');
  assert.equal(planEvent('pull_request_target', payload).status, 'in review');
});

test('explicit marker overrides unrelated IDs', () => {
  const payload = {
    action: 'opened',
    repository: repo,
    pull_request: {
      head: { ref: 'feature/no-id' },
      title: 'Work related to DEV-4000',
      body: 'ClickUp-Task: DEV-4346\nDepends on DEV-4001',
    },
  };
  assert.equal(resolveTaskId('pull_request_target', payload), 'DEV-4346');
});

test('changes requested returns review to in progress', () => {
  const plan = planEvent('pull_request_review', {
    action: 'submitted',
    repository: repo,
    review: { id: 99, state: 'changes_requested' },
    pull_request: { number: 42 },
  });
  assert.equal(plan.kind, 'review-changes-requested');
  assert.equal(plan.status, 'in progress');
  assert.equal(transitionAllowed('in review', plan.status, plan.kind), true);
  assert.equal(transitionAllowed('testing', plan.status, plan.kind), false);
});

test('fork pull requests cannot mutate ClickUp', () => {
  const plan = planEvent('pull_request_target', {
    action: 'opened',
    repository: repo,
    pull_request: {
      head: { repo: { full_name: 'external/fork' }, ref: 'DEV-4346-fake' },
      title: 'Untrusted PR',
    },
  });
  assert.match(plan.skip, /Fork pull requests/);
});

test('merged PR moves to testing without regressing QA', () => {
  const plan = planEvent('pull_request_target', {
    action: 'closed',
    repository: repo,
    pull_request: {
      number: 42,
      merged: true,
      base: { ref: 'develop' },
      merge_commit_sha: 'deadbeef',
    },
  });
  assert.equal(plan.status, 'testing');
  assert.equal(transitionAllowed('in review', plan.status, plan.kind), true);
  assert.equal(transitionAllowed('qa test', plan.status, plan.kind), false);
});

test('RED-2: successful production deployment leaves completion to the lead', () => {
  const plan = planEvent(
    'deployment_status',
    {
      repository: repo,
      deployment: { environment: 'production', ref: 'DEV-4346' },
      deployment_status: { id: 7, state: 'success' },
    },
    {},
  );
  assert.equal(plan.status, undefined);
  assert.match(plan.skip, /manual|lead|tester/i);
});

test('RED-1: workflow default workspace and List match repository project routing', () => {
  const config = readFileSync(resolve(__dirname, '../../.clickup-workflow.toml'), 'utf8');
  const project = config.match(/^default_project\s*=\s*"([^"]+)"/m)[1];
  const selected = config.split(`[projects.${project}]`)[1].split('\n[')[0];
  const env = parse(readFileSync(resolve(__dirname, '../workflows/clickup-status-sync.yml'), 'utf8'))
    .jobs.sync.env;
  for (const [key, setting] of [['workspace_id', 'CLICKUP_WORKSPACE_ID'], ['list_id', 'CLICKUP_ALLOWED_LIST_IDS']]) {
    const expected = selected.match(new RegExp(`^${key}\\s*=\\s*"([0-9]+)"`, 'm'))[1];
    const fallback = env[setting].match(/\|\|\s*'([^']+)'/)[1];
    assert.equal(fallback, expected, `${setting} fallback must target the selected repository project`);
  }
});

test('successful staging deployment also preserves manual promotion authority', () => {
  const plan = planEvent('deployment_status', {
    repository: repo,
    deployment: { environment: 'staging', ref: 'DEV-4346' },
    deployment_status: { id: 8, state: 'success' },
  }, {});
  assert.equal(plan.status, undefined);
  assert.match(plan.skip, /manual|lead|tester/i);
});

test('manual completion requires evidence while an evidenced lead update remains available', () => {
  assert.throws(() => planEvent('workflow_dispatch', {
    repository: repo,
    inputs: { task_id: 'DEV-4346', status: 'done', note: '   ' },
  }), /evidence|note|reason/i);
  const plan = planEvent('workflow_dispatch', {
    repository: repo,
    inputs: { task_id: 'DEV-4346', status: 'done', note: 'Lead verified QA and production promotion.' },
  });
  assert.equal(plan.status, 'done');
  assert.equal(transitionAllowed('ready to release', plan.status, plan.kind), true);
});

// Exercise the existing CLI, replacing fetch before it loads. All requests are
// handled in process; this harness cannot send ClickUp API calls.
function runOfflineSync(allowedLists, fixture = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'clickup-sync-test-'));
  try {
    const eventPath = join(directory, 'event.json');
    const preloadPath = join(directory, 'offline-fetch.cjs');
    writeFileSync(eventPath, JSON.stringify({
      ref: 'refs/heads/feat/DEV-4346-sync',
      after: 'fixturecommit',
      repository: repo,
    }));
    writeFileSync(preloadPath, `
      const fixture = ${JSON.stringify(fixture)};
      global.fetch = async (url, options = {}) => {
        const method = options.method || 'GET';
        console.log('OFFLINE_REQUEST:' + JSON.stringify({ method, url }));
        const body = url.includes('/comment?')
          ? { comments: fixture.comments || [] }
          : { status: { status: fixture.status || 'ready' }, list: { id: fixture.listId || '123' } };
        return new Response(JSON.stringify(body));
      };
    `);
    return spawnSync(process.execPath, ['--require', preloadPath, resolve(__dirname, 'clickup-status-sync.cjs')], {
      encoding: 'utf8',
      env: {
        GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: repo.full_name,
        CLICKUP_WORKSPACE_ID: '999', CLICKUP_ALLOWED_LIST_IDS: allowedLists,
        CLICKUP_API_TOKEN: 'offline-test-token',
      },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('empty or whitespace-only allowlist fails closed without status or comment writes', () => {
  for (const allowed of ['', ' ,  ']) {
    const result = runOfflineSync(allowed);
    assert.equal(result.status, 1, `empty allowed List boundary must reject; ${result.stdout}`);
    assert.match(result.stderr, /CLICKUP_ALLOWED_LIST_IDS/);
    assert.doesNotMatch(result.stdout, /OFFLINE_REQUEST:/);
  }
});

test('foreign List remains rejected before comment or status writes', () => {
  const result = runOfflineSync('123', { listId: '456' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not in CLICKUP_ALLOWED_LIST_IDS/);
  assert.doesNotMatch(result.stdout, /"method":"(?:PUT|POST)"/);
});

test('matching List updates once and repeated evidence is idempotent', () => {
  const result = runOfflineSync('123');
  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout.match(/"method":"PUT"/g) || []).length, 1);
  assert.equal((result.stdout.match(/"method":"POST"/g) || []).length, 1);
  const duplicate = runOfflineSync('123', {
    comments: [{ comment_text: '[workflow-event:Thairun/fotobots-whitelabel:push-fixturecommit]' }],
  });
  assert.equal(duplicate.status, 0, duplicate.stderr);
  assert.match(duplicate.stdout, /duplicate-event-skipped/);
  assert.doesNotMatch(duplicate.stdout, /"method":"(?:PUT|POST)"/);
});

test('workflow keeps secret-bearing execution on trusted code with minimal permissions', () => {
  const workflow = parse(readFileSync(resolve(__dirname, '../workflows/clickup-status-sync.yml'), 'utf8'));
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const checkout = workflow.jobs.sync.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ github.event.repository.default_branch }}');
  assert.equal(checkout.with['persist-credentials'], false);
  assert.equal(workflow.jobs.sync.env.CLICKUP_API_TOKEN, '${{ secrets.CLICKUP_API_TOKEN }}');
});

test('manual dispatch accepts configured workflow statuses', () => {
  const payload = {
    repository: repo,
    inputs: { task_id: 'DEV-4346', status: 'qa test', note: 'QA started' },
  };
  assert.equal(resolveTaskId('workflow_dispatch', payload), 'DEV-4346');
  assert.equal(planEvent('workflow_dispatch', payload).status, 'qa test');
});

// Branch convention from the Worker Skill §3: feat/<TASK-ID>-<CLICKUP-ID>-<description>.
// Task Card IDs such as CONTRACT-PAGE-010 look like ClickUp IDs to the default pattern,
// so the repository sets CLICKUP_TASK_ID_PATTERN to the team's ClickUp prefix.
const teamPattern = 'DEV-[0-9]+';

test('card-style branch resolves the ClickUp ID with the team pattern', () => {
  const payload = {
    ref: 'refs/heads/feat/CONTRACT-PAGE-010-DEV-123-page-schemas',
    after: 'abcdef1234567890',
    repository: repo,
  };
  assert.equal(resolveTaskId('push', payload, teamPattern), 'DEV-123');
});

test('team pattern does not mistake a Task Card ID for a ClickUp task', () => {
  const payload = { ref: 'refs/heads/feat/CONTRACT-PAGE-010-page-schemas', repository: repo };
  assert.equal(resolveTaskId('push', payload, teamPattern), null);
});

test('push falls back to the ClickUp-Task commit trailer when the branch has no ID', () => {
  const payload = {
    ref: 'refs/heads/feat/CONTRACT-PAGE-010-page-schemas',
    repository: repo,
    head_commit: { message: 'test(CONTRACT-PAGE-010): add RED tests\n\nClickUp-Task: DEV-123' },
  };
  assert.equal(resolveTaskId('push', payload, teamPattern), 'DEV-123');
});

test('ClickUp-Task marker in the PR body wins over the card ID in branch and title', () => {
  const payload = {
    action: 'opened',
    repository: repo,
    pull_request: {
      number: 5,
      head: { ref: 'feat/CONTRACT-PAGE-010-page-schemas' },
      title: '[CONTRACT-PAGE-010] Define frozen Page & Component schemas',
      body: 'ClickUp-Task: DEV-123\n\n## Task\nCONTRACT-PAGE-010',
    },
  };
  assert.equal(resolveTaskId('pull_request_target', payload), 'DEV-123');
});

test('example IDs mentioned in a PR description never select a ClickUp task', () => {
  const payload = {
    action: 'opened',
    repository: repo,
    pull_request: {
      number: 6,
      head: { ref: 'chore/agent-workflow-clickup' },
      title: 'docs: align agent workflow with ClickUp sprint assignment',
      body: 'Branch example: feat/CONTRACT-PAGE-010-DEV-123-page-schemas\nPattern: [A-Z][A-Z0-9]+-[0-9]+',
    },
  };
  assert.equal(resolveTaskId('pull_request_target', payload), null);
  assert.equal(resolveTaskId('pull_request_target', payload, teamPattern), null);
});

test('IDs mentioned in commit messages without a ClickUp-Task trailer are ignored', () => {
  const payload = {
    ref: 'refs/heads/chore/agent-workflow-clickup',
    repository: repo,
    head_commit: { message: 'docs: explain branch names like feat/CONTRACT-PAGE-010-DEV-123-x' },
  };
  assert.equal(resolveTaskId('push', payload, teamPattern), null);
});

// Team flow: developers (read access) work from forks and open PRs into develop; only the
// team lead merges, and promotes develop -> staging -> main by hand.
const privateRepo = {
  full_name: 'Thairun/fotobots-whitelabel',
  default_branch: 'develop',
  private: true,
};

test('draft PR from a fork of a private repo moves the task to in progress', () => {
  const plan = planEvent('pull_request_target', {
    action: 'opened',
    repository: privateRepo,
    pull_request: {
      number: 10,
      draft: true,
      base: { ref: 'develop' },
      head: {
        repo: { full_name: 'palm-thairun/fotobots-whitelabel' },
        ref: 'feat/CONTRACT-PAGE-010-DEV-123-x',
      },
      body: 'ClickUp-Task: DEV-123',
    },
  });
  assert.equal(plan.kind, 'pr-draft');
  assert.equal(plan.status, 'in progress');
});

test('review on a fork PR of a private repo is synced', () => {
  const plan = planEvent('pull_request_review', {
    action: 'submitted',
    repository: privateRepo,
    review: { id: 5, state: 'changes_requested' },
    pull_request: {
      number: 10,
      base: { ref: 'develop' },
      head: { repo: { full_name: 'palm-thairun/fotobots-whitelabel' }, ref: 'feat/x' },
    },
  });
  assert.equal(plan.status, 'in progress');
});

for (const branch of ['develop', 'staging', 'main']) {
  test(`push to integration branch ${branch} is not a commit-start event`, () => {
    const plan = planEvent(
      'push',
      { ref: `refs/heads/${branch}`, after: 'abc', repository: privateRepo },
      {},
    );
    assert.match(plan.skip, /Integration-branch pushes/);
  });
}

test('merged promotion PR (develop -> staging) does not touch ClickUp', () => {
  const plan = planEvent(
    'pull_request_target',
    {
      action: 'closed',
      repository: privateRepo,
      pull_request: {
        number: 11,
        merged: true,
        base: { ref: 'staging' },
        head: { repo: { full_name: 'Thairun/fotobots-whitelabel' }, ref: 'develop' },
      },
    },
    {},
  );
  assert.match(plan.skip, /Promotion PR/);
});

test('feature PR merged into develop moves the task to testing', () => {
  const plan = planEvent(
    'pull_request_target',
    {
      action: 'closed',
      repository: privateRepo,
      pull_request: {
        number: 12,
        merged: true,
        base: { ref: 'develop' },
        head: {
          repo: { full_name: 'palm-thairun/fotobots-whitelabel' },
          ref: 'feat/CONTRACT-PAGE-010-DEV-123-x',
        },
      },
    },
    {},
  );
  assert.equal(plan.kind, 'pr-merged');
  assert.equal(plan.status, 'testing');
});

for (const base of ['staging', 'main', undefined]) {
  test(`feature merge into ${base || 'an unspecified branch'} cannot imply testing`, () => {
    const plan = planEvent('pull_request_target', {
      action: 'closed',
      repository: privateRepo,
      pull_request: {
        number: 13,
        merged: true,
        base: base ? { ref: base } : undefined,
        head: { ref: 'feat/CONTRACT-PAGE-010-DEV-123-x' },
      },
    }, {});
    assert.equal(plan.status, undefined);
    assert.match(plan.skip, /develop/);
  });
}

test('manual dispatch rejects canceled because the ClickUp list has no such status', () => {
  const payload = {
    repository: repo,
    inputs: { task_id: 'DEV-4346', status: 'canceled' },
  };
  assert.throws(
    () => planEvent('workflow_dispatch', payload),
    /Unsupported manual status: canceled/,
  );
});
