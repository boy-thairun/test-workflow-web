#!/usr/bin/env node

'use strict';

const fs = require('node:fs');

const DEFAULT_TASK_ID_PATTERN = '[A-Z][A-Z0-9]+-[0-9]+';
const MANUAL_STATUSES = new Set([
  'backlog',
  'ready',
  'in progress',
  'in review',
  'ready to merge',
  'testing',
  'qa test',
  'ready to release',
  'blocked',
  'done',
]);

function normalizeStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const DEFAULT_INTEGRATION_BRANCHES = 'develop,staging,stg,main';

// Branches code is promoted through (develop -> staging -> main). Pushes to them are merges or
// releases, not the start of work on a task.
function integrationBranches(payload, env = process.env) {
  return new Set(
    [
      payload.repository?.default_branch,
      ...String(env.CLICKUP_INTEGRATION_BRANCHES || DEFAULT_INTEGRATION_BRANCHES).split(','),
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  );
}

// Only people with access to a private repository can fork it, so fork PRs there come from the
// team. Forks of a public repository stay untrusted. The workflow never runs PR code either way.
function isUntrustedFork(payload, pullRequest) {
  const headRepository = pullRequest.head?.repo?.full_name;
  const baseRepository = payload.repository?.full_name;
  const isFork = Boolean(headRepository && baseRepository && headRepository !== baseRepository);
  return isFork && payload.repository?.private !== true;
}

function taskIdRegex(pattern = DEFAULT_TASK_ID_PATTERN) {
  return new RegExp(pattern, 'gi');
}

function idsFromText(value, pattern) {
  if (!value) return [];
  return unique(String(value).match(taskIdRegex(pattern)) || []).map((id) => id.toUpperCase());
}

function explicitIdsFromText(value, pattern) {
  if (!value) return [];
  const idSource = `(${pattern})`;
  const marker = new RegExp(`(?:ClickUp(?:-Task)?|Task-ID)\\s*:\\s*${idSource}`, 'gi');
  const ids = [];
  for (const match of String(value).matchAll(marker)) {
    ids.push(match[1].toUpperCase());
  }
  return unique(ids);
}

function selectSingleId(ids, source) {
  if (ids.length === 1) return ids[0];
  if (ids.length > 1) {
    throw new Error(
      `Multiple ClickUp task IDs found in ${source}: ${ids.join(', ')}. ` +
        'Add exactly one "ClickUp-Task: DEV-123" marker.',
    );
  }
  return null;
}

function resolveTaskId(eventName, payload, pattern = DEFAULT_TASK_ID_PATTERN) {
  const pullRequest = payload.pull_request || {};
  const review = payload.review || {};
  const deployment = payload.deployment || {};
  const inputs = payload.inputs || {};

  if (inputs.task_id) {
    const id = selectSingleId(idsFromText(inputs.task_id, pattern), 'manual task_id');
    if (!id) throw new Error(`Invalid manual task_id: ${inputs.task_id}`);
    return id;
  }

  const explicit = selectSingleId(
    unique([
      ...explicitIdsFromText(pullRequest.body, pattern),
      ...explicitIdsFromText(review.body, pattern),
      ...explicitIdsFromText(deployment.description, pattern),
    ]),
    'explicit marker',
  );
  if (explicit) return explicit;

  const preferredSources = [];
  if (eventName === 'push') {
    preferredSources.push(['branch', String(payload.ref || '').replace('refs/heads/', '')]);
  } else if (eventName.startsWith('pull_request')) {
    preferredSources.push(['PR branch', pullRequest.head?.ref]);
    preferredSources.push(['PR title', pullRequest.title]);
  } else if (eventName === 'deployment_status') {
    preferredSources.push(['deployment ref', deployment.ref]);
    preferredSources.push(['deployment description', deployment.description]);
  }

  for (const [source, value] of preferredSources) {
    const id = selectSingleId(idsFromText(value, pattern), source);
    if (id) return id;
  }

  // Free text (PR descriptions, reviews, commit messages) often mentions other task or card
  // IDs as examples, so only an explicit "ClickUp-Task:" trailer in a commit counts here.
  const fallbackIds = unique([
    ...explicitIdsFromText(payload.head_commit?.message, pattern),
    ...(payload.commits || []).flatMap((commit) => explicitIdsFromText(commit.message, pattern)),
  ]);
  return selectSingleId(fallbackIds, 'commit ClickUp-Task trailer');
}

function planEvent(eventName, payload, env = process.env) {
  const action = payload.action || '';
  const pullRequest = payload.pull_request || {};
  const review = payload.review || {};
  const inputs = payload.inputs || {};
  const repository = payload.repository?.full_name || env.GITHUB_REPOSITORY || 'unknown/repo';
  const server = env.GITHUB_SERVER_URL || 'https://github.com';

  if (eventName === 'push') {
    const ref = String(payload.ref || '');
    const branch = ref.replace('refs/heads/', '');
    if (!ref.startsWith('refs/heads/') || payload.deleted) {
      return { skip: 'Not a live branch push.' };
    }
    if (integrationBranches(payload, env).has(branch)) {
      return {
        skip: `Integration-branch pushes (${branch}) are merge/release evidence, not commit-start events.`,
      };
    }
    return {
      kind: 'commit',
      status: 'in progress',
      evidenceUrl: `${server}/${repository}/commit/${payload.after}`,
      note: `Commit pushed to ${branch}: ${String(payload.after || '').slice(0, 12)}`,
      deliveryKey: `push-${payload.after}`,
    };
  }

  if (eventName === 'pull_request_target' || eventName === 'pull_request') {
    const prUrl = pullRequest.html_url;
    const prNumber = pullRequest.number || payload.number;
    if (isUntrustedFork(payload, pullRequest)) {
      return { skip: 'Fork pull requests cannot mutate ClickUp.' };
    }
    if (integrationBranches(payload, env).has(pullRequest.head?.ref)) {
      return { skip: 'Promotion PRs (develop -> staging -> main) are updated in ClickUp by hand.' };
    }
    if (['opened', 'reopened', 'ready_for_review', 'synchronize'].includes(action)) {
      if (pullRequest.draft) {
        return {
          kind: 'pr-draft',
          status: 'in progress',
          evidenceUrl: prUrl,
          note: `PR #${prNumber} is draft; implementation remains in progress.`,
          deliveryKey: `pr-${prNumber}-${action}-${pullRequest.updated_at || payload.after || ''}`,
        };
      }
      return {
        kind: 'pr-open',
        status: 'in review',
        evidenceUrl: prUrl,
        note: `PR #${prNumber} is open and ready for review.`,
        deliveryKey: `pr-${prNumber}-${action}-${pullRequest.updated_at || ''}`,
      };
    }
    if (action === 'converted_to_draft') {
      return {
        kind: 'pr-draft',
        status: 'in progress',
        evidenceUrl: prUrl,
        note: `PR #${prNumber} was converted to draft.`,
        deliveryKey: `pr-${prNumber}-${action}-${pullRequest.updated_at || ''}`,
      };
    }
    if (action === 'closed' && pullRequest.merged) {
      if (pullRequest.base?.ref !== 'develop') {
        return { skip: 'Only task PRs merged into develop advance to testing.' };
      }
      return {
        kind: 'pr-merged',
        status: 'testing',
        evidenceUrl: prUrl,
        note: `PR #${prNumber} was merged; task is ready for staging/test deployment.`,
        deliveryKey: `pr-${prNumber}-merged-${pullRequest.merge_commit_sha || pullRequest.updated_at || ''}`,
      };
    }
    if (action === 'closed') {
      return {
        kind: 'pr-closed-unmerged',
        status: 'in progress',
        evidenceUrl: prUrl,
        note: `PR #${prNumber} was closed without merge.`,
        deliveryKey: `pr-${prNumber}-closed-${pullRequest.updated_at || ''}`,
      };
    }
    return { skip: `Unsupported pull request action: ${action}` };
  }

  if (eventName === 'pull_request_review') {
    const prNumber = pullRequest.number || payload.number;
    const state = normalizeStatus(review.state);
    if (isUntrustedFork(payload, pullRequest)) {
      return { skip: 'Reviews on fork pull requests cannot mutate ClickUp.' };
    }
    if (action === 'submitted' && state === 'changes_requested') {
      return {
        kind: 'review-changes-requested',
        status: 'in progress',
        evidenceUrl: review.html_url || pullRequest.html_url,
        note: `Changes requested on PR #${prNumber}; task returned to implementation.`,
        deliveryKey: `review-${review.id}-changes-requested`,
      };
    }
    if (action === 'submitted' && state === 'approved') {
      return {
        kind: 'review-approved',
        status: 'ready to merge',
        evidenceUrl: review.html_url || pullRequest.html_url,
        note: `PR #${prNumber} was approved; task is ready to merge.`,
        deliveryKey: `review-${review.id}-approved`,
      };
    }
    if (action === 'dismissed') {
      return {
        kind: 'review-dismissed',
        status: 'in review',
        evidenceUrl: review.html_url || pullRequest.html_url,
        note: `A review on PR #${prNumber} was dismissed; review is required again.`,
        deliveryKey: `review-${review.id}-dismissed`,
      };
    }
    return { skip: `Unsupported review action/state: ${action}/${state}` };
  }

  if (eventName === 'deployment_status') {
    return { skip: 'Deployment and promotion updates require manual lead/tester evidence.' };
  }

  if (eventName === 'workflow_dispatch') {
    const status = normalizeStatus(inputs.status);
    if (!MANUAL_STATUSES.has(status)) {
      throw new Error(`Unsupported manual status: ${inputs.status}`);
    }
    const note = String(inputs.note || '').trim();
    if (!note) throw new Error('Manual status updates require an evidence or reason note.');
    return {
      kind: 'manual',
      status,
      evidenceUrl: `${server}/${repository}/actions/runs/${env.GITHUB_RUN_ID || 'manual'}`,
      note,
      deliveryKey: `manual-${env.GITHUB_RUN_ID || Date.now()}-${status}`,
    };
  }

  return { skip: `Unsupported GitHub event: ${eventName}` };
}

function transitionAllowed(current, desired, kind) {
  if (!desired || current === desired) return false;
  if (kind === 'manual') return true;

  const allowed = {
    commit: ['backlog', 'ready', 'in progress'],
    'pr-draft': ['backlog', 'ready', 'in progress', 'in review', 'ready to merge'],
    'pr-open': ['backlog', 'ready', 'in progress', 'in review'],
    'review-approved': ['in review', 'ready to merge'],
    'review-changes-requested': ['in review', 'ready to merge'],
    'pr-closed-unmerged': ['in review', 'ready to merge'],
    'review-dismissed': ['in progress', 'in review', 'ready to merge'],
    'pr-merged': ['in progress', 'in review', 'ready to merge', 'testing'],
  };
  return (allowed[kind] || []).includes(current);
}

async function clickupRequest(path, options = {}, env = process.env) {
  const baseUrl = env.CLICKUP_API_BASE_URL || 'https://api.clickup.com/api/v2';
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: env.CLICKUP_API_TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const bodyText = await response.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { raw: bodyText };
  }
  if (!response.ok) {
    throw new Error(
      `ClickUp API ${response.status} ${response.statusText}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

function taskPath(taskId, workspaceId, suffix = '') {
  const query = new URLSearchParams({
    custom_task_ids: 'true',
    team_id: workspaceId,
  });
  return `/task/${encodeURIComponent(taskId)}${suffix}?${query}`;
}

function commentContainsMarker(comment, marker) {
  const text =
    typeof comment.comment_text === 'string'
      ? comment.comment_text
      : JSON.stringify(comment.comment_text || '');
  return text.includes(marker);
}

async function syncPlan(taskId, plan, env = process.env) {
  const workspaceId = env.CLICKUP_WORKSPACE_ID;
  if (!workspaceId) throw new Error('CLICKUP_WORKSPACE_ID is required.');
  const allowedLists = String(env.CLICKUP_ALLOWED_LIST_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowedLists.length) throw new Error('CLICKUP_ALLOWED_LIST_IDS must contain an allowed List.');

  const repository = env.GITHUB_REPOSITORY || 'unknown/repo';
  const marker = `[workflow-event:${repository}:${plan.deliveryKey}]`;
  const task = await clickupRequest(taskPath(taskId, workspaceId), {}, env);
  const currentStatus = normalizeStatus(task.status?.status || task.status);
  const listId = String(task.list?.id || '');
  if (!allowedLists.includes(listId)) {
    throw new Error(
      `Task ${taskId} belongs to ClickUp List ${listId}, which is not in CLICKUP_ALLOWED_LIST_IDS.`,
    );
  }

  const comments = await clickupRequest(taskPath(taskId, workspaceId, '/comment'), {}, env);
  if ((comments.comments || []).some((comment) => commentContainsMarker(comment, marker))) {
    return { taskId, currentStatus, outcome: 'duplicate-event-skipped', marker };
  }

  let outcome = 'commented-without-status-change';
  if (plan.status && transitionAllowed(currentStatus, plan.status, plan.kind)) {
    await clickupRequest(
      taskPath(taskId, workspaceId),
      { method: 'PUT', body: JSON.stringify({ status: plan.status }) },
      env,
    );
    outcome = `${currentStatus} -> ${plan.status}`;
  } else if (plan.status && currentStatus === plan.status) {
    outcome = `already-${plan.status}`;
  } else if (plan.status) {
    outcome = `guardrail-kept-${currentStatus}`;
  }

  const evidence = plan.evidenceUrl ? `\nEvidence: ${plan.evidenceUrl}` : '';
  const commentText = [
    `GitHub workflow sync: ${plan.note}`,
    `Status result: ${outcome}.${evidence}`,
    marker,
  ].join('\n\n');
  await clickupRequest(
    taskPath(taskId, workspaceId, '/comment'),
    {
      method: 'POST',
      body: JSON.stringify({ comment_text: commentText, notify_all: false }),
    },
    env,
  );

  return { taskId, currentStatus, outcome, marker, taskUrl: task.url };
}

function appendSummary(lines, env = process.env) {
  if (!env.GITHUB_STEP_SUMMARY) return;
  fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

async function main() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventName || !eventPath) {
    throw new Error('GITHUB_EVENT_NAME and GITHUB_EVENT_PATH are required.');
  }
  const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const plan = planEvent(eventName, payload, process.env);
  if (plan.skip) {
    console.log(`::notice::ClickUp sync skipped: ${plan.skip}`);
    appendSummary(['## ClickUp status sync', '', `Skipped: ${plan.skip}`]);
    return;
  }

  const taskId = resolveTaskId(
    eventName,
    payload,
    process.env.CLICKUP_TASK_ID_PATTERN || DEFAULT_TASK_ID_PATTERN,
  );
  if (!taskId) {
    console.log('::notice::ClickUp sync skipped: no unambiguous task ID found.');
    appendSummary([
      '## ClickUp status sync',
      '',
      'Skipped: no unambiguous task ID found in the branch, PR, commit, or deployment.',
    ]);
    return;
  }

  if (String(process.env.CLICKUP_SYNC_DRY_RUN).toLowerCase() === 'true') {
    console.log(JSON.stringify({ taskId, plan }, null, 2));
    appendSummary([
      '## ClickUp status sync (dry run)',
      '',
      `- Task: ${taskId}`,
      `- Event: ${plan.kind}`,
      `- Proposed status: ${plan.status || 'unchanged'}`,
    ]);
    return;
  }

  if (!process.env.CLICKUP_API_TOKEN) {
    console.log(
      '::warning::CLICKUP_API_TOKEN is not configured; GitHub event was detected but ClickUp was not changed.',
    );
    appendSummary([
      '## ClickUp status sync',
      '',
      `Detected ${plan.kind} for ${taskId}, but CLICKUP_API_TOKEN is not configured.`,
    ]);
    return;
  }

  const result = await syncPlan(taskId, plan, process.env);
  console.log(`ClickUp sync complete: ${JSON.stringify(result)}`);
  appendSummary(
    [
      '## ClickUp status sync',
      '',
      `- Task: ${taskId}`,
      `- Event: ${plan.kind}`,
      `- Result: ${result.outcome}`,
      result.taskUrl ? `- ClickUp: ${result.taskUrl}` : '',
    ].filter(Boolean),
  );
}

module.exports = {
  DEFAULT_TASK_ID_PATTERN,
  idsFromText,
  explicitIdsFromText,
  resolveTaskId,
  planEvent,
  transitionAllowed,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
