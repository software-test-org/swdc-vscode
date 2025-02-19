import { commands, ProgressLocation, window } from "vscode";
import { getPreference } from "../DataController";
import { softwarePost, softwareDelete } from "../http/HttpClient";
import { getItem } from "../Util";
import { softwareGet } from "../http/HttpClient";

import { checkRegistration, showModalSignupPrompt, checkSlackConnectionForFlowMode } from "./SlackManager";
import { FULL_SCREEN_MODE_ID, NORMAL_SCREEN_MODE, showFullScreenMode, showNormalScreenMode, showZenMode, ZEN_MODE_ID } from "./ScreenManager";
import { updateFlowModeStatus } from "./StatusBarManager";

export let enablingFlow = false;
export let enabledFlow = false;

let initialized = false;

export async function isFlowModEnabled() {
  if (!initialized && getItem("jwt")) {
    enabledFlow = await determineFlowModeFromApi();
    initialized = true;
  }
  return enabledFlow;
}

/**
 * Screen Mode: full screen
 * Pause Notifications: on
 * Slack Away Msg: It's CodeTime!
 */
export function getConfigSettingsTooltip() {
  const preferences = [];
  const flowModeSettings = getPreference("flowMode");
  // move this to the backend
  preferences.push(`**Screen Mode**: *${flowModeSettings?.editor?.vscode?.screenMode?.toLowerCase()}*`);

  const notificationState = flowModeSettings?.slack?.pauseSlackNotifications ? "on" : "off";
  preferences.push(`**Pause Notifications**: *${notificationState}*`);

  const slackStatusText = flowModeSettings?.slack?.slackStatusText ?? "";
  preferences.push(`**Slack Away Msg**: *${slackStatusText}*`);

  const autoEnableFlowMode = flowModeSettings?.editor?.autoEnableFlowMode ? "on" : "off";
  preferences.push(`**Automatically Enable Flow Mode**: *${autoEnableFlowMode}*`);

  // 2 spaces followed by a newline will create newlines in markdown
  return preferences.length ? preferences.join("  \n") : "";
}

export async function enableFlow({ automated = false, skipSlackCheck = false }) {
  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Enabling flow...",
      cancellable: false,
    },

    (progress) => {
      return new Promise((resolve, reject) => {
        initiateFlow({ automated, skipSlackCheck }).catch((e) => {});
        resolve(true);
      });
    }
  );
}

export function getConfiguredScreenMode() {
  const flowModeSettings = getPreference("flowMode");
  const screenMode = flowModeSettings?.editor?.vscode?.screenMode;
  if (screenMode?.includes("Full Screen")) {
    return FULL_SCREEN_MODE_ID;
  } else if (screenMode?.includes("Zen")) {
    return ZEN_MODE_ID;
  }
  return NORMAL_SCREEN_MODE;
}

async function initiateFlow({ automated = false, skipSlackCheck = false }) {
  const isRegistered = checkRegistration(false);
  if (!isRegistered) {
    // show the flow mode prompt
    showModalSignupPrompt("To use Flow Mode, please first sign up or login.");
    return;
  }

  // { connected, usingAllSettingsForFlow }
  if (!skipSlackCheck) {
    const connectInfo = await checkSlackConnectionForFlowMode();
    if (!connectInfo.continue) {
      return;
    }
  }

  const preferredScreenMode = getConfiguredScreenMode();

  // create a FlowSession on backend.  Also handles 3rd party automations (slack, cal, etc)
  softwarePost("/v1/flow_sessions", { automated }, getItem("jwt"));

  // update screen mode
  if (preferredScreenMode === FULL_SCREEN_MODE_ID) {
    showFullScreenMode();
  } else if (preferredScreenMode === ZEN_MODE_ID) {
    showZenMode();
  } else {
    showNormalScreenMode();
  }

  enabledFlow = true;
  enablingFlow = false;

  commands.executeCommand("codetime.refreshCodeTimeView");

  updateFlowModeStatus();
}

export async function pauseFlow() {
  if (enabledFlow) {
    window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Turning off flow...",
        cancellable: false,
      },
      (progress) => {
        return new Promise((resolve, reject) => {
          pauseFlowInitiate().catch((e) => {});
          resolve(true);
        });
      }
    );
  }
}

async function pauseFlowInitiate() {
  await softwareDelete("/v1/flow_sessions", getItem("jwt"));
  showNormalScreenMode();

  enabledFlow = false;
  commands.executeCommand("codetime.refreshCodeTimeView");

  updateFlowModeStatus();
}

export async function isInFlowMode() {
  if (enablingFlow) {
    return true;
  } else if (!enabledFlow) {
    return false;
  }

  // we've made it here, check the api and screen state
  return await determineFlowModeFromApi();
}

export async function determineFlowModeFromApi() {
  const flowSessionsReponse = getItem("jwt") ? await softwareGet("/v1/flow_sessions", getItem("jwt")) : { data: { flow_sessions: [] } };
  const openFlowSessions = flowSessionsReponse?.data?.flow_sessions;
  // make sure "enabledFlow" is set as it's used as a getter outside this export
  enabledFlow = openFlowSessions?.length > 0;

  return enabledFlow;
}
