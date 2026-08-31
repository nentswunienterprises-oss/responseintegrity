const SOUTH_AFRICA_TIME_ZONE = "Africa/Johannesburg";

type MonthDayWindow = {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  spansYear?: boolean;
};

type ParentIntakeKey = "full_year" | "mid_year";
type TutorCycleKey = "annual" | "mid_year";

type ParentIntakeDefinition = {
  key: ParentIntakeKey;
  label: string;
  shortLabel: string;
  windowLabel: string;
  bestFor: string;
  cadenceLabel: string;
  trainingBeginsLabel: string;
  window: MonthDayWindow;
};

type TutorCycleDefinition = {
  key: TutorCycleKey;
  label: string;
  supportsLabel: string;
  applicationWindowLabel: string;
  conditioningWindowLabel: string;
  certificationDeadlineLabel: string;
  deploymentLockInLabel: string;
  deploymentBeginsLabel: string;
  applicationWindow: MonthDayWindow;
};

type TutorPhase = {
  key:
    | "annual_application"
    | "annual_conditioning"
    | "annual_lock_in"
    | "full_year_live"
    | "mid_year_application"
    | "mid_year_conditioning"
    | "mid_year_lock_in"
    | "mid_year_live";
  label: string;
  window: MonthDayWindow;
  applicationsOpen: boolean;
  cycleKey?: TutorCycleKey;
  description: string;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getDatePartsInSouthAfrica(date = new Date()): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SOUTH_AFRICA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function toMonthDayValue(month: number, day: number) {
  return month * 100 + day;
}

function isWithinRecurringWindow(parts: DateParts, window: MonthDayWindow) {
  const current = toMonthDayValue(parts.month, parts.day);
  const start = toMonthDayValue(window.startMonth, window.startDay);
  const end = toMonthDayValue(window.endMonth, window.endDay);

  if (window.spansYear) {
    return current >= start || current <= end;
  }

  return current >= start && current <= end;
}

function toUtcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function formatAbsoluteDate(year: number, month: number, day: number) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toUtcDate(year, month, day));
}

function formatTodayLabel(parts: DateParts) {
  return formatAbsoluteDate(parts.year, parts.month, parts.day);
}

function getActiveWindowOccurrence(parts: DateParts, window: MonthDayWindow) {
  if (!window.spansYear) {
    return {
      startYear: parts.year,
      endYear: parts.year,
    };
  }

  if (parts.month > window.endMonth || (parts.month === window.endMonth && parts.day > window.endDay)) {
    return {
      startYear: parts.year,
      endYear: parts.year + 1,
    };
  }

  return {
    startYear: parts.year - 1,
    endYear: parts.year,
  };
}

function getNextWindowStart(parts: DateParts, window: MonthDayWindow) {
  const today = toUtcDate(parts.year, parts.month, parts.day);
  let candidate = toUtcDate(parts.year, window.startMonth, window.startDay);

  if (candidate <= today) {
    candidate = toUtcDate(parts.year + 1, window.startMonth, window.startDay);
  }

  return candidate;
}

const parentIntakeDefinitions: ParentIntakeDefinition[] = [
  {
    key: "full_year",
    label: "Full-Year Conditioning Intake",
    shortLabel: "Full-Year Intake",
    windowLabel: "1 November - 31 January",
    bestFor: "Families preparing before the academic year becomes urgent.",
    cadenceLabel: "2 sessions per week • 8 sessions per month",
    trainingBeginsLabel: "Training begins 1 February",
    window: {
      startMonth: 11,
      startDay: 1,
      endMonth: 1,
      endDay: 31,
      spansYear: true,
    },
  },
  {
    key: "mid_year",
    label: "Mid-Year Conditioning Intake",
    shortLabel: "Mid-Year Intake",
    windowLabel: "1 May - 31 May",
    bestFor: "Families who still have serious runway before final-year pressure peaks.",
    cadenceLabel: "2 sessions per week • 8 sessions per month",
    trainingBeginsLabel: "Training begins 1 June",
    window: {
      startMonth: 5,
      startDay: 1,
      endMonth: 5,
      endDay: 31,
    },
  },
];

const tutorCycleDefinitions: TutorCycleDefinition[] = [
  {
    key: "annual",
    label: "Annual Operator Certification Cycle",
    supportsLabel: "Supports the Full-Year Conditioning Intake",
    applicationWindowLabel: "1 October - 31 October",
    conditioningWindowLabel: "1 November - 15 January",
    certificationDeadlineLabel: "15 January",
    deploymentLockInLabel: "16 January - 31 January",
    deploymentBeginsLabel: "1 February",
    applicationWindow: {
      startMonth: 10,
      startDay: 1,
      endMonth: 10,
      endDay: 31,
    },
  },
  {
    key: "mid_year",
    label: "Mid-Year Operator Certification Cycle",
    supportsLabel: "Supports the Mid-Year Conditioning Intake",
    applicationWindowLabel: "1 April - 30 April",
    conditioningWindowLabel: "1 May - 20 May",
    certificationDeadlineLabel: "20 May",
    deploymentLockInLabel: "21 May - 31 May",
    deploymentBeginsLabel: "1 June",
    applicationWindow: {
      startMonth: 4,
      startDay: 1,
      endMonth: 4,
      endDay: 30,
    },
  },
];

const tutorPhases: TutorPhase[] = [
  {
    key: "annual_application",
    label: "Annual Operator Application Window",
    window: { startMonth: 10, startDay: 1, endMonth: 10, endDay: 31 },
    applicationsOpen: true,
    cycleKey: "annual",
    description:
      "New specialists can apply, submit documents, and enter applicant mode for the February deployment pool.",
  },
  {
    key: "annual_conditioning",
    label: "Annual Operator Conditioning Window",
    window: {
      startMonth: 11,
      startDay: 1,
      endMonth: 1,
      endDay: 15,
      spansYear: true,
    },
    applicationsOpen: false,
    cycleKey: "annual",
    description:
      "Selected candidates are already inside training, battle testing, and sandbox preparation for the February deployment pool.",
  },
  {
    key: "annual_lock_in",
    label: "Annual Deployment Lock-In",
    window: { startMonth: 1, startDay: 16, endMonth: 1, endDay: 31 },
    applicationsOpen: false,
    cycleKey: "annual",
    description:
      "Only certified live operators are being matched now. Schedules and capacity are being locked before February deployment.",
  },
  {
    key: "full_year_live",
    label: "Full-Year Deployment Season",
    window: { startMonth: 2, startDay: 1, endMonth: 3, endDay: 31 },
    applicationsOpen: false,
    cycleKey: "annual",
    description:
      "Certified operators are already deployed with active students. New specialist entry is paused until the next application window.",
  },
  {
    key: "mid_year_application",
    label: "Mid-Year Operator Application Window",
    window: { startMonth: 4, startDay: 1, endMonth: 4, endDay: 30 },
    applicationsOpen: true,
    cycleKey: "mid_year",
    description:
      "New specialists can apply for the June deployment pool and begin the mid-year certification cycle.",
  },
  {
    key: "mid_year_conditioning",
    label: "Mid-Year Operator Conditioning Window",
    window: { startMonth: 5, startDay: 1, endMonth: 5, endDay: 20 },
    applicationsOpen: false,
    cycleKey: "mid_year",
    description:
      "Selected candidates are already moving through accelerated conditioning, battle testing, and sandbox readiness.",
  },
  {
    key: "mid_year_lock_in",
    label: "Mid-Year Deployment Lock-In",
    window: { startMonth: 5, startDay: 21, endMonth: 5, endDay: 31 },
    applicationsOpen: false,
    cycleKey: "mid_year",
    description:
      "Only certified live operators are being matched now.  ",
  },
  {
    key: "mid_year_live",
    label: "Mid-Year Deployment Season",
    window: { startMonth: 6, startDay: 1, endMonth: 9, endDay: 30 },
    applicationsOpen: false,
    cycleKey: "mid_year",
    description:
      "Certified operators are already carrying live student responsibility. New specialist entry is paused until the annual cycle opens.",
  },
];

export function getParentIntakeDefinitions() {
  return parentIntakeDefinitions;
}

export function getTutorCycleDefinitions() {
  return tutorCycleDefinitions;
}

export function getParentIntakeLabel(key: string | null | undefined) {
  return parentIntakeDefinitions.find((definition) => definition.key === key)?.label ?? "Current Intake";
}

export function getTutorCycleLabel(key: string | null | undefined) {
  return tutorCycleDefinitions.find((definition) => definition.key === key)?.label ?? "Specialist Entry";
}

export function getParentIntakeStatus(date = new Date()) {
  const parts = getDatePartsInSouthAfrica(date);
  const activeDefinition =
    parentIntakeDefinitions.find((definition) => isWithinRecurringWindow(parts, definition.window)) ?? null;

  const nextDefinition = parentIntakeDefinitions
    .map((definition) => ({
      definition,
      nextStart: getNextWindowStart(parts, definition.window),
    }))
    .sort((left, right) => left.nextStart.getTime() - right.nextStart.getTime())[0];

  if (activeDefinition) {
    const occurrence = getActiveWindowOccurrence(parts, activeDefinition.window);
    const closingLabel = formatAbsoluteDate(
      occurrence.endYear,
      activeDefinition.window.endMonth,
      activeDefinition.window.endDay,
    );

    return {
      todayLabel: formatTodayLabel(parts),
      isOpen: true,
      activeDefinition,
      heading: `${activeDefinition.label} is open now.`,
      badge: "Parent intake open",
      summary: `New family entry is open through ${closingLabel}.`,
      detail:
        "Families do not join Response Integrity for random tutoring. They enter through a defined intake and commit to the fixed conditioning rhythm required for the system to work.",
      closingLabel,
      nextOpeningLabel: formatAbsoluteDate(
        nextDefinition.nextStart.getUTCFullYear(),
        nextDefinition.nextStart.getUTCMonth() + 1,
        nextDefinition.nextStart.getUTCDate(),
      ),
      nextDefinition: nextDefinition.definition,
    };
  }

  const currentMonthDay = toMonthDayValue(parts.month, parts.day);
  let seasonalContext =
    "Response Integrity is outside a parent intake window right now. New family entry is paused while active cohorts continue inside their protected rhythm.";

  if (currentMonthDay >= 201 && currentMonthDay <= 430) {
    seasonalContext =
      "The full-year cohort is already in conditioning. New family entry stays closed until the next defined intake opens.";
  } else if (currentMonthDay >= 601 && currentMonthDay <= 831) {
    seasonalContext =
      "Active cohorts are already in conditioning. Response Integrity does not layer in random late signups while that cadence is running.";
  } else if (currentMonthDay >= 901 && currentMonthDay <= 1031) {
    seasonalContext =
      "Execution pressure is active for enrolled students, and the next full-year intake is protected as a deliberate planning entry, not emergency rescue.";
  }

  return {
    todayLabel: formatTodayLabel(parts),
    isOpen: false,
    activeDefinition: null,
    heading: "Parent intake is closed today.",
    badge: "Parent intake closed",
    summary: `The next intake opens ${formatAbsoluteDate(
      nextDefinition.nextStart.getUTCFullYear(),
      nextDefinition.nextStart.getUTCMonth() + 1,
      nextDefinition.nextStart.getUTCDate(),
    )}.`,
    detail: seasonalContext,
    nextOpeningLabel: formatAbsoluteDate(
      nextDefinition.nextStart.getUTCFullYear(),
      nextDefinition.nextStart.getUTCMonth() + 1,
      nextDefinition.nextStart.getUTCDate(),
    ),
    nextDefinition: nextDefinition.definition,
  };
}

export function getTutorIntakeStatus(date = new Date()) {
  const parts = getDatePartsInSouthAfrica(date);
  const phase = tutorPhases.find((candidate) => isWithinRecurringWindow(parts, candidate.window)) ?? tutorPhases[0];
  const nextCycle = tutorCycleDefinitions
    .map((definition) => ({
      definition,
      nextStart: getNextWindowStart(parts, definition.applicationWindow),
    }))
    .sort((left, right) => left.nextStart.getTime() - right.nextStart.getTime())[0];

  if (phase.applicationsOpen && phase.cycleKey) {
    const cycle = tutorCycleDefinitions.find((definition) => definition.key === phase.cycleKey)!;
    const closingLabel = formatAbsoluteDate(parts.year, cycle.applicationWindow.endMonth, cycle.applicationWindow.endDay);

    return {
      todayLabel: formatTodayLabel(parts),
      isOpen: true,
      phase,
      activeCycle: cycle,
      badge: "Specialist applications open",
      heading: `${phase.label} is open now.`,
      summary: `New specialist applications are open through ${closingLabel}.`,
      detail:
        "Entry starts in applicant mode. Only candidates who move through training, sandbox readiness, and certification by deadline become deployable operators.",
      closingLabel,
      nextOpeningLabel: formatAbsoluteDate(
        nextCycle.nextStart.getUTCFullYear(),
        nextCycle.nextStart.getUTCMonth() + 1,
        nextCycle.nextStart.getUTCDate(),
      ),
      nextCycle: nextCycle.definition,
    };
  }

  return {
    todayLabel: formatTodayLabel(parts),
    isOpen: false,
    phase,
    activeCycle: phase.cycleKey
      ? tutorCycleDefinitions.find((definition) => definition.key === phase.cycleKey) ?? null
      : null,
    badge: "Specialist applications closed",
    heading: `${phase.label} is active right now.`,
    summary: `The next specialist application window opens ${formatAbsoluteDate(
      nextCycle.nextStart.getUTCFullYear(),
      nextCycle.nextStart.getUTCMonth() + 1,
      nextCycle.nextStart.getUTCDate(),
    )}.`,
    detail: phase.description,
    nextOpeningLabel: formatAbsoluteDate(
      nextCycle.nextStart.getUTCFullYear(),
      nextCycle.nextStart.getUTCMonth() + 1,
      nextCycle.nextStart.getUTCDate(),
    ),
    nextCycle: nextCycle.definition,
  };
}
