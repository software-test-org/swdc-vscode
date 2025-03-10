import { StatusBarAlignment, StatusBarItem, window } from "vscode";
import { SessionSummary } from "../model/models";
import { getFileDataAsJson, getItem, getSessionSummaryFile, humanizeMinutes } from "../Util";
import { isFlowModEnabled } from "./FlowManager";

let showStatusBarText = true;
let ctMetricStatusBarItem: StatusBarItem = undefined;
let ctFlowModeStatusBarItem: StatusBarItem = undefined;

export async function initializeStatusBar() {
  ctMetricStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);
  // add the name to the tooltip if we have it
  const name = getItem("name");
  let tooltip = "Click to see more from Code Time";
  if (name) {
    tooltip = `${tooltip} (${name})`;
  }
  ctMetricStatusBarItem.tooltip = tooltip;
  ctMetricStatusBarItem.command = "codetime.displaySidebar";
  ctMetricStatusBarItem.show();

  ctFlowModeStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 9);
  await updateFlowModeStatus();
}

export async function updateFlowModeStatus() {
  const { flowModeCommand, flowModeText, flowModeTooltip } = await getFlowModeStatusBarInfo();
  ctFlowModeStatusBarItem.command = flowModeCommand;
  ctFlowModeStatusBarItem.text = flowModeText;
  ctFlowModeStatusBarItem.tooltip = flowModeTooltip;
  if (isRegistered()) {
    ctFlowModeStatusBarItem.show();
  } else {
    ctFlowModeStatusBarItem.hide();
  }
}

async function getFlowModeStatusBarInfo() {
  let flowModeCommand = "codetime.enableFlow";
  let flowModeText = "$(circle-large-outline) Flow";
  let flowModeTooltip = "Enter Flow Mode";
  if (await isFlowModEnabled()) {
    flowModeCommand = "codetime.exitFlowMode";
    flowModeText = "$(circle-large-filled) Flow";
    flowModeTooltip = "Exit Flow Mode";
  }
  return { flowModeCommand, flowModeText, flowModeTooltip };
}

export function toggleStatusBar() {
  showStatusBarText = !showStatusBarText;

  // toggle the flow mode
  if (showStatusBarText && isRegistered()) {
    ctFlowModeStatusBarItem.show();
  } else if (!showStatusBarText) {
    ctFlowModeStatusBarItem.hide();
  }

  // toggle the metrics value
  updateStatusBarWithSummaryData();
}

export function isStatusBarTextVisible() {
  return showStatusBarText;
}

function isRegistered() {
  return !!getItem("name");
}

/**
 * Updates the status bar text with the current day minutes (session minutes)
 */
export function updateStatusBarWithSummaryData() {
  let sessionSummary = getFileDataAsJson(getSessionSummaryFile());
  if (!sessionSummary) {
    sessionSummary = new SessionSummary();
  }
  const inFlowIcon = sessionSummary.currentDayMinutes > sessionSummary.averageDailyMinutes ? "$(rocket)" : "$(clock)";
  const minutesStr = humanizeMinutes(sessionSummary.currentDayMinutes);

  const msg = `${inFlowIcon} ${minutesStr}`;
  showStatus(msg, null);
}

function showStatus(msg, tooltip) {
  if (!tooltip) {
    tooltip = "Active code time today. Click to see more from Code Time.";
  }

  let loggedInName = getItem("name");
  let userInfo = "";
  if (loggedInName && loggedInName !== "") {
    userInfo = ` Connected as ${loggedInName}`;
  }

  if (!showStatusBarText) {
    // add the message to the tooltip
    tooltip = msg + " | " + tooltip;
  }
  if (!ctMetricStatusBarItem) {
    return;
  }
  ctMetricStatusBarItem.tooltip = `${tooltip}${userInfo}`;
  if (!showStatusBarText) {
    ctMetricStatusBarItem.text = "$(clock)";
  } else {
    ctMetricStatusBarItem.text = msg;
  }
}
