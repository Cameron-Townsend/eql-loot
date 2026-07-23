"use strict";

import {
  getField,
  getPreferredStats,
  normalizeLower,
  normalizeText
} from "./database.js";

/*
 * Planner slot definitions.
 *
 * These are virtual browser-planner positions. They do not alter the CSV
 * item slot values.
 */
export const PLANNER_SLOTS = [
  {
    id: "ear_left",
    label: "Left Ear",
    group: "armor"
  },
  {
    id: "ear_right",
    label: "Right Ear",
    group: "armor"
  },
  {
    id: "head",
    label: "Head",
    group: "armor"
  },
  {
    id: "face",
    label: "Face",
    group: "armor"
  },
  {
    id: "neck",
    label: "Neck",
    group: "armor"
  },
  {
    id: "shoulders",
    label: "Shoulders",
    group: "armor"
  },
  {
    id: "arms",
    label: "Arms",
    group: "armor"
  },
  {
    id: "chest",
    label: "Chest",
    group: "armor"
  },
  {
    id: "back",
    label: "Back",
    group: "armor"
  },
  {
    id: "wrist_left",
    label: "Left Wrist",
    group: "armor"
  },
  {
    id: "wrist_right",
    label: "Right Wrist",
    group: "armor"
  },
  {
    id: "hands",
    label: "Hands",
    group: "armor"
  },
  {
    id: "finger_left",
    label: "Left Finger",
    group: "armor"
  },
  {
    id: "finger_right",
    label: "Right Finger",
    group: "armor"
  },
  {
    id: "waist",
    label: "Waist",
    group: "armor"
  },
  {
    id: "legs",
    label: "Legs",
    group: "armor"
  },
  {
    id: "feet",
    label: "Feet",
    group: "armor"
  },
  {
    id: "primary",
    label: "Primary",
    group: "weapon"
  },
  {
    id: "secondary",
    label: "Secondary",
    group: "weapon"
  },
  {
    id: "range",
    label: "Range",
    group: "weapon"
  },
  {
    id: "ammo",
    label: "Ammo",
    group: "weapon"
  },
  {
    id: "any_1",
    label: "Any 1",
    group: "any"
  },
  {
    id: "any_2",
    label: "Any 2",
    group: "any"
  }
];

export const PLANNER_SLOT_IDS = PLANNER_SLOTS.map(
  slot => slot.id
);

export const ANY_SLOT_IDS = [
  "any_1",
  "any_2"
];

/*
 * Maps normalized CSV slot words to virtual planner positions.
 *
 * Paired slots return both possible destinations.
 */
const NORMAL_SLOT_MAP = {
  ear: [
    "ear_left",
    "ear_right"
  ],

  ears: [
    "ear_left",
    "ear_right"
  ],

  head: [
    "head"
  ],

  face: [
    "face"
  ],

  neck: [
    "neck"
  ],

  shoulder: [
    "shoulders"
  ],

  shoulders: [
    "shoulders"
  ],

  arm: [
    "arms"
  ],

  arms: [
    "arms"
  ],

  chest: [
    "chest"
  ],

  torso: [
    "chest"
  ],

  back: [
    "back"
  ],

  wrist: [
    "wrist_left",
    "wrist_right"
  ],

  wrists: [
    "wrist_left",
    "wrist_right"
  ],

  hand: [
    "hands"
  ],

  hands: [
    "hands"
  ],

  finger: [
    "finger_left",
    "finger_right"
  ],

  fingers: [
    "finger_left",
    "finger_right"
  ],

  ring: [
    "finger_left",
    "finger_right"
  ],

  rings: [
    "finger_left",
    "finger_right"
  ],

  waist: [
    "waist"
  ],

  belt: [
    "waist"
  ],

  leg: [
    "legs"
  ],

  legs: [
    "legs"
  ],

  foot: [
    "feet"
  ],

  feet: [
    "feet"
  ],

  primary: [
    "primary"
  ],

  mainhand: [
    "primary"
  ],

  "main hand": [
    "primary"
  ],

  secondary: [
    "secondary"
  ],

  offhand: [
    "secondary"
  ],

  "off hand": [
    "secondary"
  ],

  held: [
    "secondary"
  ],

  shield: [
    "secondary"
  ],

  range: [
    "range"
  ],

  ranged: [
    "range"
  ],

  ammo: [
    "ammo"
  ],

  ammunition: [
    "ammo"
  ]
};

/*
 * These exact composite forms are handled before normal token splitting.
 */
const COMPOSITE_SLOT_MAP = {
  "primary secondary": [
    "primary",
    "secondary"
  ],

  "primary/secondary": [
    "primary",
    "secondary"
  ],

  "primary / secondary": [
    "primary",
    "secondary"
  ],

  "primary, secondary": [
    "primary",
    "secondary"
  ],

  "primary|secondary": [
    "primary",
    "secondary"
  ],

  "primary; secondary": [
    "primary",
    "secondary"
  ],

  "ear ear": [
    "ear_left",
    "ear_right"
  ],

  "wrist wrist": [
    "wrist_left",
    "wrist_right"
  ],

  "finger finger": [
    "finger_left",
    "finger_right"
  ]
};

const NON_EQUIPMENT_SLOT_VALUES = new Set([
  "",
  "none",
  "n/a",
  "na",
  "not applicable",
  "inventory",
  "inventory only",
  "quest",
  "quest item",
  "key",
  "tradeskill",
  "consumable",
  "container",
  "bag",
  "book",
  "spell",
  "unknown"
]);

export function getPlannerSlotDefinition(slotId) {
  return PLANNER_SLOTS.find(
    slot => slot.id === slotId
  ) ?? null;
}

export function getPlannerSlotLabel(slotId) {
  return (
    getPlannerSlotDefinition(slotId)?.label ||
    slotId
  );
}

/*
 * Returns only the item's ordinary legal equipment destinations.
 *
 * Examples:
 * Finger -> finger_left, finger_right
 * Chest -> chest
 * Primary / Secondary -> primary, secondary
 */
export function getNormalPlannerSlots(record) {
  const rawSlot = getField(record, "slot");
  const normalizedSlot = normalizeSlotText(rawSlot);

  if (
    !normalizedSlot ||
    NON_EQUIPMENT_SLOT_VALUES.has(normalizedSlot)
  ) {
    return [];
  }

  const exactComposite =
    COMPOSITE_SLOT_MAP[normalizedSlot];

  if (exactComposite) {
    return deduplicateValues(exactComposite);
  }

  const destinationSlots = [];

  for (const token of splitSlotText(rawSlot)) {
    const normalizedToken =
      normalizeSlotText(token);

    const mappedSlots =
      NORMAL_SLOT_MAP[normalizedToken];

    if (!mappedSlots) {
      continue;
    }

    destinationSlots.push(...mappedSlots);
  }

  return deduplicateValues(destinationSlots);
}

/*
 * Any 1 and Any 2 are appended only when the item maps to at least one
 * recognized normal equipment slot.
 */
export function getCompatiblePlannerSlots(record) {
  const normalSlots =
    getNormalPlannerSlots(record);

  if (normalSlots.length === 0) {
    return [];
  }

  return [
    ...normalSlots,
    ...ANY_SLOT_IDS
  ];
}

export function isNormallyEquippable(record) {
  return getNormalPlannerSlots(record).length > 0;
}

export function canEquipToPlannerSlot(
  record,
  plannerSlotId
) {
  return getCompatiblePlannerSlots(record)
    .includes(plannerSlotId);
}

export function isAnyPlannerSlot(slotId) {
  return ANY_SLOT_IDS.includes(slotId);
}

/*
 * Returns the item's native CSV slot text for display in Any slots.
 */
export function getNativeSlotDisplay(record) {
  return getField(record, "slot");
}

/*
 * Weapon data
 */

export function getWeaponDamage(record) {
  return parseNumericField(
    getField(record, "damage")
  );
}

export function getWeaponDelay(record) {
  return parseNumericField(
    getField(record, "delay")
  );
}

export function getWeaponSkill(record) {
  return getField(record, "weaponSkill");
}

export function getWeaponRatio(record) {
  const damage = getWeaponDamage(record);
  const delay = getWeaponDelay(record);

  if (
    damage === null ||
    delay === null ||
    delay <= 0
  ) {
    return null;
  }

  return damage / delay;
}

export function isWeaponRecord(record) {
  const damage = getWeaponDamage(record);
  const delay = getWeaponDelay(record);

  return (
    damage !== null ||
    delay !== null ||
    Boolean(getWeaponSkill(record))
  );
}

/*
 * Returns:
 * DMG 12, DLY 24 (Ratio 0.500)
 */
export function getWeaponStatDisplay(record) {
  const damage = getWeaponDamage(record);
  const delay = getWeaponDelay(record);
  const ratio = getWeaponRatio(record);

  const visibleParts = [];

  if (damage !== null) {
    visibleParts.push(`DMG ${formatNumber(damage)}`);
  }

  if (delay !== null) {
    visibleParts.push(`DLY ${formatNumber(delay)}`);
  }

  const baseText = visibleParts.join(", ");

  if (ratio === null) {
    return baseText;
  }

  return (
    `${baseText} ` +
    `(Ratio ${ratio.toFixed(3)})`
  ).trim();
}

/*
 * Single source of truth for item stat display.
 *
 * Non-weapon:
 * AC 5, STR +4, HP +20
 *
 * Weapon:
 * AC 5, STR +4, HP +20, DMG 12, DLY 24 (Ratio 0.500)
 *
 * If the stats field already contains DMG or DLY, those values are not
 * repeated. The calculated ratio is still appended once.
 */
export function getItemStatsDisplay(record) {
  const preferredStats = normalizeText(
    getPreferredStats(record)
  );

  const damage = getWeaponDamage(record);
  const delay = getWeaponDelay(record);
  const ratio = getWeaponRatio(record);

  const nativeStatParts = [];

  if (preferredStats) {
    nativeStatParts.push(preferredStats);
  }

  if (
    damage !== null &&
    !containsDamageStat(preferredStats)
  ) {
    nativeStatParts.push(
      `DMG ${formatNumber(damage)}`
    );
  }

  if (
    delay !== null &&
    !containsDelayStat(preferredStats)
  ) {
    nativeStatParts.push(
      `DLY ${formatNumber(delay)}`
    );
  }

  const baseText = joinStatParts(
    nativeStatParts
  );

  if (ratio === null) {
    return baseText;
  }

  return (
    `${baseText} ` +
    `(Ratio ${ratio.toFixed(3)})`
  ).trim();
}

/*
 * Shorter planner-slot display.
 *
 * This intentionally uses the same data and ratio calculation as the full
 * item display, but it omits ordinary armor stats when a compact weapon line
 * is needed.
 */
export function getCompactWeaponDisplay(record) {
  return getWeaponStatDisplay(record);
}

export function getItemRuleDiagnostics(record) {
  const rawSlot = getField(record, "slot");

  return {
    recordId: getField(record, "recordId"),
    itemName: getField(record, "itemName"),
    rawSlot,
    normalizedSlot: normalizeSlotText(rawSlot),
    normalPlannerSlots:
      getNormalPlannerSlots(record),
    compatiblePlannerSlots:
      getCompatiblePlannerSlots(record),
    equippable: isNormallyEquippable(record),
    damage: getWeaponDamage(record),
    delay: getWeaponDelay(record),
    ratio: getWeaponRatio(record),
    weaponSkill: getWeaponSkill(record),
    statsDisplay: getItemStatsDisplay(record)
  };
}

/*
 * Internal helpers
 */

function splitSlotText(value) {
  const text = normalizeText(value);

  if (!text) {
    return [];
  }

  return text
    .replace(/\band\b/gi, ",")
    .split(/\s*(?:,|\/|\||;|\+)\s*/)
    .map(part => part.trim())
    .filter(Boolean);
}

function normalizeSlotText(value) {
  return normalizeLower(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumericField(value) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  /*
   * Accept values such as:
   * 12
   * +12
   * 12.5
   * DMG 12
   * Damage: 12
   *
   * The first numeric value is used.
   */
  const match = text.match(
    /[-+]?\d+(?:\.\d+)?/
  );

  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function containsDamageStat(statsText) {
  return (
    /\bDMG\s*[:=+]?\s*[-+]?\d+(?:\.\d+)?\b/i
      .test(statsText) ||
    /\bDAMAGE\s*[:=+]?\s*[-+]?\d+(?:\.\d+)?\b/i
      .test(statsText)
  );
}

function containsDelayStat(statsText) {
  return (
    /\bDLY\s*[:=+]?\s*[-+]?\d+(?:\.\d+)?\b/i
      .test(statsText) ||
    /\bDELAY\s*[:=+]?\s*[-+]?\d+(?:\.\d+)?\b/i
      .test(statsText)
  );
}

function joinStatParts(parts) {
  const cleanedParts = parts
    .map(part =>
      normalizeText(part)
        .replace(/[,\s]+$/g, "")
        .trim()
    )
    .filter(Boolean);

  return cleanedParts.join(", ");
}

function formatNumber(value) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(
    Number(value.toFixed(3))
  );
}

function deduplicateValues(values) {
  return [...new Set(values)];
}
