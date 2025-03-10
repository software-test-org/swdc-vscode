import { window } from "vscode";
import { showDashboard } from "../managers/WebViewManager";
import { getItem } from "../Util";
import { softwareGet, isResponseOk } from "../http/HttpClient";
import { configureSettings } from "../managers/ConfigManager";
import { TrackerManager } from "../managers/TrackerManager";
import { configureSettingsKpmItem, showMeTheDataKpmItem } from "../tree/TreeButtonProvider";
import { format, startOfDay, differenceInMilliseconds } from "date-fns";

const MIN_IN_MILLIS = 60 * 1000;
const HOUR_IN_MILLIS = 60 * 60 * 1000;

let timer = undefined;

export const setEndOfDayNotification = async (user: any) => {
  // clear any existing timer
  if (timer) {
    clearTimeout(timer);
  }

  // If the end of day notification setting is turned on (if undefined or null, will default to true)
  if (user?.preferences?.notifications?.endOfDayNotification !== false) {
    const jwt = getItem("jwt");

    const d = new Date();
    const day = format(d, "EEE").toLowerCase();
    let msUntilEndOfTheDay = 0;

    // [[118800,147600],[205200,234000],[291600,320400],[378000,406800],[464400,493200]]
    // default of 5pm if the response or work_hours format doesn't have the {dow:...}
    if (day !== "sun" && day !== "sat") {
      msUntilEndOfTheDay = getMillisUntilEndOfTheDay(d, HOUR_IN_MILLIS * 17);
    }

    const response = await softwareGet("/users/profile", jwt);
    if (isResponseOk(response)) {
      // get the day of the week that matches today
      const work_hours_today = response.data.work_hours[day] || undefined;
      if (work_hours_today?.active) {
        // it's active, get the largest end range
        const endTimes = work_hours_today.ranges.map((n) => {
          // convert "end" to total seconds in a day
          return getEndTimeSeconds(n.end);
        });

        // sort milliseconds in descending order
        endTimes.sort(function (a, b) {
          return b - a;
        });

        msUntilEndOfTheDay = getMillisUntilEndOfTheDay(d, endTimes[0]);
      }
    }

    if (msUntilEndOfTheDay > 0) {
      // set the timer to fire in "n" milliseconds
      timer = setTimeout(showEndOfDayNotification, msUntilEndOfTheDay);
    }
  }
};

export const showEndOfDayNotification = async () => {
  const tracker: TrackerManager = TrackerManager.getInstance();
  const selection = await window.showInformationMessage(
    "It's the end of your work day! Would you like to see your code time stats for today?",
    ...["Settings", "Show me the data"]
  );

  if (selection === "Show me the data") {
    let item = showMeTheDataKpmItem();
    tracker.trackUIInteraction(item);
    showDashboard();
  } else if (selection === "Settings") {
    let item = configureSettingsKpmItem();
    tracker.trackUIInteraction(item);
    configureSettings();
  }
};

function getEndTimeSeconds(end) {
  const hourMin = end.split(":");
  return parseInt(hourMin[0], 10) * HOUR_IN_MILLIS + parseInt(hourMin[1], 10) * MIN_IN_MILLIS;
}

function getMillisUntilEndOfTheDay(date, endMillis) {
  var startD = startOfDay(date);
  var millisDiff = differenceInMilliseconds(date, startD);
  return endMillis - millisDiff;
}
