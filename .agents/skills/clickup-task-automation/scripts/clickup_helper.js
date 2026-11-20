#!/usr/bin/env node

/**
 * ClickUp Task Automation Helper
 * Supports:
 * - Looking up tasks by Custom ID (e.g. DEV-5252) or internal task ID
 * - Fetching workspace members
 * - Posting comments with Rich @Mentions (type: "tag") so ClickUp triggers real notifications
 * - Listing, updating, and deleting comments
 */

import fs from "fs";
import path from "path";

const TOKEN = process.env.CLICKUP_API_TOKEN || "pk_306696764_L83SBHFNUMR5EXCABM3801M8CV4W3U0B";
const BASE_URL = "https://api.clickup.com/api/v2";

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: TOKEN,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ClickUp API Error (${res.status} ${res.statusText}): ${errorText}`);
  }

  return res.json();
}

// Cache team info
let cachedTeam = null;

async function getTeam() {
  if (cachedTeam) return cachedTeam;
  const data = await request("/team");
  if (!data.teams || data.teams.length === 0) {
    throw new Error("No teams found for ClickUp token");
  }
  cachedTeam = data.teams[0];
  return cachedTeam;
}

async function getMembers() {
  const team = await getTeam();
  return team.members || [];
}

async function getTask(taskId) {
  const team = await getTeam();
  // Check if it looks like a custom ID (e.g., DEV-1234, AUTH-001)
  const isCustomId = /^[A-Za-z]+-\d+$/.test(taskId.trim());
  const endpoint = isCustomId
    ? `/task/${taskId.trim()}?custom_task_ids=true&team_id=${team.id}`
    : `/task/${taskId.trim()}`;
  return request(endpoint);
}

/**
 * Parse a plain-text message containing @username and markdown code blocks into ClickUp comment AST blocks.
 * - Mentions match workspace members and become { type: "tag", user: {...}, text: "@username" }
 * - Fenced code blocks ```lang\ncode\n``` become { text: "code\n", attributes: { "code-block": lang || true } }
 */
async function buildCommentBlocks(rawText) {
  const members = await getMembers();
  const memberMap = new Map();

  for (const m of members) {
    const u = m.user;
    if (u.username) memberMap.set(u.username.toLowerCase(), u);
    if (u.email) {
      memberMap.set(u.email.toLowerCase(), u);
      const emailPrefix = u.email.split("@")[0].toLowerCase();
      memberMap.set(emailPrefix, u);
    }
  }

  const blocks = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)\n?```/g;
  let lastIndex = 0;
  let codeMatch;

  function parseMentions(text) {
    const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
    let mIndex = 0;
    let mMatch;
    while ((mMatch = mentionRegex.exec(text)) !== null) {
      const matchedText = mMatch[0];
      const username = mMatch[1].toLowerCase();
      const user = memberMap.get(username);
      if (user) {
        if (mMatch.index > mIndex) {
          blocks.push({ text: text.substring(mIndex, mMatch.index) });
        }
        blocks.push({
          type: "tag",
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            initials: user.initials || user.username?.slice(0, 2).toUpperCase() || "",
            profilePicture: user.profilePicture || null
          },
          text: matchedText
        });
        mIndex = mMatch.index + matchedText.length;
      }
    }
    if (mIndex < text.length) {
      blocks.push({ text: text.substring(mIndex) });
    }
  }

  while ((codeMatch = codeBlockRegex.exec(rawText)) !== null) {
    const textBefore = rawText.substring(lastIndex, codeMatch.index);
    if (textBefore) {
      parseMentions(textBefore);
    }
    const lang = codeMatch[1]?.trim();
    let codeContent = codeMatch[2];
    if (!codeContent.endsWith("\n")) {
      codeContent += "\n";
    }
    blocks.push({
      text: codeContent,
      attributes: {
        "code-block": lang || true
      }
    });
    lastIndex = codeMatch.index + codeMatch[0].length;
  }

  if (lastIndex < rawText.length) {
    parseMentions(rawText.substring(lastIndex));
  }

  return blocks.length > 0 ? blocks : [{ text: rawText }];
}

async function postComment(taskId, messageText, options = {}) {
  const task = await getTask(taskId);
  const internalId = task.id;
  const blocks = await buildCommentBlocks(messageText);

  const payload = {
    comment: blocks,
    notify_all: options.notifyAll !== false
  };

  if (options.assignee) {
    payload.assignee = options.assignee;
  }

  return request(`/task/${internalId}/comment`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function getComments(taskId) {
  const task = await getTask(taskId);
  return request(`/task/${task.id}/comment`);
}

async function updateComment(commentId, messageText) {
  const blocks = await buildCommentBlocks(messageText);
  return request(`/comment/${commentId}`, {
    method: "PUT",
    body: JSON.stringify({
      comment: blocks,
      notify_all: true
    })
  });
}

async function deleteComment(commentId) {
  return request(`/comment/${commentId}`, {
    method: "DELETE"
  });
}

async function updateTaskStatus(taskId, status) {
  const team = await getTeam();
  const isCustomId = /^[A-Za-z]+-\d+$/.test(taskId.trim());
  const endpoint = isCustomId
    ? `/task/${taskId.trim()}?custom_task_ids=true&team_id=${team.id}`
    : `/task/${taskId.trim()}`;
  return request(endpoint, {
    method: "PUT",
    body: JSON.stringify({ status })
  });
}

function getListIdFromWorkflow(cwd = process.cwd()) {
  try {
    const tomlPath = path.join(cwd, ".clickup-workflow.toml");
    if (fs.existsSync(tomlPath)) {
      const content = fs.readFileSync(tomlPath, "utf8");
      const match = content.match(/list_id\s*=\s*["']([^"']+)["']/);
      if (match) return match[1];
    }
  } catch {}
  return "1100690000004796"; // fallback fotobots-whitelabel list
}

async function createTask(name, description = "", options = {}) {
  const listId = options.listId || getListIdFromWorkflow();
  const payload = {
    name,
    description,
    status: options.status || "ready"
  };
  if (options.priority) payload.priority = options.priority;
  if (options.points) payload.points = options.points;

  return request(`/list/${listId}/task`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function setPrLink(taskId, prUrl) {
  const task = await getTask(taskId);
  const team = await getTeam();
  const prField = (task.custom_fields || []).find(
    f => f.name && f.name.toLowerCase() === "pr link"
  );
  if (!prField) {
    throw new Error(`Custom field "PR Link" not found on task ${taskId}`);
  }
  const isCustomId = /^[A-Za-z]+-\d+$/.test(taskId.trim());
  const endpoint = isCustomId
    ? `/task/${taskId.trim()}/field/${prField.id}?custom_task_ids=true&team_id=${team.id}`
    : `/task/${taskId.trim()}/field/${prField.id}`;

  return request(endpoint, {
    method: "POST",
    body: JSON.stringify({ value: prUrl })
  });
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(`
ClickUp Task Automation Helper

Usage:
  node clickup_helper.js task <TASK_ID>
  node clickup_helper.js members
  node clickup_helper.js create-task "<NAME>" "[DESCRIPTION]" "[STATUS]"
  node clickup_helper.js set-pr-link <TASK_ID> <PR_URL>
  node clickup_helper.js comment <TASK_ID> "<MESSAGE>"
  node clickup_helper.js set-status <TASK_ID> <STATUS>
  node clickup_helper.js comments <TASK_ID>
  node clickup_helper.js update-comment <COMMENT_ID> "<MESSAGE>"
  node clickup_helper.js delete-comment <COMMENT_ID>

Examples:
  node clickup_helper.js task DEV-5252
  node clickup_helper.js create-task "[AUTH-010] Verify OTP Service" "Spec: Implementation/auth-spec.md" ready
  node clickup_helper.js set-pr-link DEV-5252 https://github.com/Thairun/fotobots-whitelabel/pull/12
  node clickup_helper.js set-status DEV-5252 rework
  node clickup_helper.js comment DEV-5252 "@jet-thairun แผนงานผ่านแล้ว ลุยต่อได้เลย"
`);
    return;
  }

  try {
    switch (command) {
      case "create-task": {
        const name = args[1];
        const description = args[2] || "";
        const status = args[3] || "ready";
        if (!name) throw new Error("Task name required");
        const created = await createTask(name, description, { status });
        console.log(JSON.stringify({
          id: created.id,
          custom_id: created.custom_id,
          name: created.name,
          status: created.status?.status,
          url: created.url
        }, null, 2));
        break;
      }
      case "set-pr-link": {
        const taskId = args[1];
        const prUrl = args[2];
        if (!taskId || !prUrl) throw new Error("Task ID and PR URL required");
        await setPrLink(taskId, prUrl);
        console.log(`PR Link for task ${taskId} updated to: ${prUrl}`);
        break;
      }
      case "task": {
        const taskId = args[1];
        if (!taskId) throw new Error("Task ID required");
        const task = await getTask(taskId);
        console.log(JSON.stringify({
          id: task.id,
          custom_id: task.custom_id,
          name: task.name,
          status: task.status?.status,
          assignees: (task.assignees || []).map(a => ({ id: a.id, username: a.username, email: a.email })),
          url: task.url
        }, null, 2));
        break;
      }
      case "members": {
        const members = await getMembers();
        console.log(JSON.stringify(members.map(m => ({
          id: m.user.id,
          username: m.user.username,
          email: m.user.email
        })), null, 2));
        break;
      }
      case "set-status": {
        const taskId = args[1];
        const status = args[2];
        if (!taskId || !status) throw new Error("Task ID and status required");
        await updateTaskStatus(taskId, status);
        console.log(`Task ${taskId} status updated to: ${status}`);
        break;
      }
      case "comment": {
        const taskId = args[1];
        const message = args[2];
        if (!taskId || !message) throw new Error("Task ID and message required");
        const res = await postComment(taskId, message);
        console.log("Comment posted successfully! Comment ID:", res.id);
        break;
      }
      case "comments": {
        const taskId = args[1];
        if (!taskId) throw new Error("Task ID required");
        const res = await getComments(taskId);
        console.log(JSON.stringify(res.comments.map(c => ({
          id: c.id,
          date: new Date(Number(c.date)).toLocaleString(),
          user: c.user?.username,
          text: c.comment_text
        })), null, 2));
        break;
      }
      case "update-comment": {
        const commentId = args[1];
        const message = args[2];
        if (!commentId || !message) throw new Error("Comment ID and message required");
        await updateComment(commentId, message);
        console.log("Comment updated successfully!");
        break;
      }
      case "delete-comment": {
        const commentId = args[1];
        if (!commentId) throw new Error("Comment ID required");
        await deleteComment(commentId);
        console.log("Comment deleted successfully!");
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  main();
}

export {
  getTask,
  getMembers,
  createTask,
  setPrLink,
  buildCommentBlocks,
  postComment,
  getComments,
  updateComment,
  deleteComment,
  updateTaskStatus
};
