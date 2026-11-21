const categories = ["service_quality", "late_no_show", "customer_no_show", "payment", "refund", "behaviour", "safety", "app_issue", "booking_issue", "other"];
const levels = ["support", "operations", "management"];
const transitions = {
  open: ["assigned"],
  assigned: ["in_progress"],
  in_progress: ["waiting", "resolved"],
  waiting: ["in_progress", "resolved"],
  resolved: ["in_progress", "closed"],
  closed: []
};
const slaHours = { urgent: [1, 12], high: [4, 24], normal: [12, 72], low: [24, 120] };

function initialPriority(category) {
  if (category === "safety") return "urgent";
  if (["late_no_show", "payment", "refund", "behaviour"].includes(category)) return "high";
  return "normal";
}

function deadlines(createdAt, priority) {
  const [response, resolution] = slaHours[priority];
  return {
    responseDueAt: new Date(createdAt.getTime() + response * 3600000),
    resolutionDueAt: new Date(createdAt.getTime() + resolution * 3600000)
  };
}

function ticketStatus(status) {
  return status === "in_review" ? "in_progress" : status;
}

function agentLevel(user) {
  if (user.adminRole === "support") return "support";
  if (user.adminRole === "operations") return "operations";
  if (["owner", "super-admin"].includes(user.adminRole ?? "owner")) return "management";
  return null;
}

function canHandle(user, level) {
  const agent = agentLevel(user);
  return agent !== null && levels.indexOf(agent) >= levels.indexOf(level ?? "support");
}

module.exports = { categories, levels, transitions, slaHours, initialPriority, deadlines, ticketStatus, agentLevel, canHandle };
