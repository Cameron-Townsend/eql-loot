"use strict";

import {
  getField,
  getPreferredStats,
  normalizeLower,
  normalizeText
} from "./database.js";

/*
 * Official EQL equipment-slot numbers taken from the inventory XML.
 *
 * These correspond to:
 * inventory/Equip 0 through inventory/Equip 22
 *
 * EQL repurposes the legacy Charm and Power Source positions as:
 * Equip 0  = Any 1
 * Equip 21 = Any 2
 */
export const EQL_EQUIPMENT_SLOT_NUMBERS = {
  any_1: 0,
  ear_left: 1,
  head: 2,
  face: 3,
  ear_right: 4,
  neck: 5,
  shoulders: 6,
  arms: 7,
  back: 8,
  wrist_left: 9,
  wrist_right: 10,
  range: 11,
  hands: 12,
  primary: 13,
  secondary: 14,
  finger_left: 15,
  finger_right: 16,
  chest: 17,
  legs: 18,
  feet: 19,
  waist: 20,
  any_2: 21,
  ammo: 22
};

/*
 * Planner slot definitions follow the official EQL equipment order.
 *
 * The order is useful for:
 * - Saved-build diagnostics
 * - Future exports/imports
 * - XML interoperability
 * - Consistent slot iteration
 *
 * The visible web layout remains controlled by index.html and CSS.
 */
export const PLANNER_SLOTS = [
  {
    id: "any_1",
    label: "Any 1",
    group: "any",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.any_1
  },
  {
    id: "ear_left",
    label: "Left Ear",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.ear_left
  },
  {
    id: "head",
    label: "Head",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.head
  },
  {
    id: "face",
    label: "Face",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.face
  },
  {
    id: "ear_right",
    label: "Right Ear",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.ear_right
  },
  {
    id: "neck",
    label: "Neck",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.neck
  },
  {
    id: "shoulders",
    label: "Shoulders",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.shoulders
  },
  {
    id: "arms",
    label: "Arms",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.arms
  },
  {
    id: "back",
    label: "Back",
    officialLabel: "About Body",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.back
  },
  {
    id: "wrist_left",
    label: "Left Wrist",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.wrist_left
  },
  {
    id: "wrist_right",
    label: "Right Wrist",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.wrist_right
  },
  {
    id: "range",
    label: "Range",
    group: "weapon",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.range
  },
  {
    id: "hands",
    label: "Hands",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.hands
  },
  {
    id: "primary",
    label: "Primary",
    group: "weapon",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.primary
  },
  {
    id: "secondary",
    label: "Secondary",
    group: "weapon",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.secondary
  },
  {
    id: "finger_left",
    label: "Left Finger",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.finger_left
  },
  {
    id: "finger_right",
    label: "Right Finger",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.finger_right
  },
  {
    id: "chest",
    label: "Chest",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.chest
  },
  {
    id: "legs",
    label: "Legs",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.legs
  },
  {
    id: "feet",
    label: "Feet",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.feet
  },
  {
    id: "waist",
    label: "Waist",
    group: "armor",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.waist
  },
  {
    id: "any_2",
    label: "Any 2",
    group: "any",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.any_2
  },
  {
    id: "ammo",
    label: "Ammo",
    group: "weapon",
    eqlSlotNumber:
      EQL_EQUIPMENT_SLOT_NUMBERS.ammo
  }
];

export const PLANNER_SLOT_IDS =
  PLANNER_SLOTS.map(slot => slot.id);

export const ANY_SLOT_IDS = [
  "any_1",
  "any_2"
];

/*
 * Maps normalized CSV slot words to virtual planner positions.
 *
 * Paired equipment positions return both valid destinations.
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

  /*
   * EQL's client XML calls slot 8 "About Body."
   * Player-facing databases often call the same slot "Back."
   */
  back: [
    "back"
  ],

  "about body": [
    "back"
  ],

  aboutbody: [
    "back"
  ],

  cloak: [
    "back"
  ],

  cape: [
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
 * Exact composite forms handled before general token splitting.
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

  "primary and secondary": [
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

const NON_EQUIPMENT_SLOT_VALUES =
  new Set([
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

export function getPlannerSlotDefinition(
  slotId
) {
  return (
    PLANNER_SLOTS.find(
      slot => slot.id === slotId
    ) ?? null
  );
}

export function getPlannerSlotLabel(
  slotId
) {
  return (
    getPlannerSlotDefinition(slotId)
      ?.label ||
    slotId
  );
}

export function getPlannerSlotOfficialLabel(
  slotId
) {
  const definition =
    getPlannerSlotDefinition(slotId);

  return (
    definition?.officialLabel ||
    definition?.label ||
    slotId
  );
}

export function getEqlEquipmentSlotNumber(
  slotId
) {
  const definition =
    getPlannerSlotDefinition(slotId);

  return (
    Number.isInteger(
      definition?.eqlSlotNumber
    )
      ? definition.eqlSlotNumber
      : null
  );
}

/*
 * Returns only the item's ordinary legal destinations.
 *
 * Examples:
 * Finger -> finger_left, finger_right
 * Chest -> chest
 * Primary / Secondary -> primary, secondary
 */
export function getNormalPlannerSlots(
  record
) {
  const rawSlot =
    getField(record, "slot");

  const normalizedSlot =
    normalizeSlotText(rawSlot);

  if (
    !normalizedSlot ||
    NON_EQUIPMENT_SLOT_VALUES.has(
      normalizedSlot
    )
  ) {
    return [];
  }

  const exactComposite =
    COMPOSITE_SLOT_MAP[
      normalizedSlot
    ];

  if (exactComposite) {
    return deduplicateValues(
      exactComposite
    );
  }

  const destinationSlots = [];

  for (
    const token
    of splitSlotText(rawSlot)
  ) {
    const normalizedToken =
      normalizeSlotText(token);

    const mappedSlots =
      NORMAL_SLOT_MAP[
        normalizedToken
      ];

    if (!mappedSlots) {
      continue;
    }

    destinationSlots.push(
      ...mappedSlots
    );
  }

  return deduplicateValues(
    destinationSlots
  );
}

/*
 * Any 1 and Any 2 are appended only when the item maps to at least one
 * recognized normal equipment position.
 *
 * This implements the EQL rule:
 * any normally equippable item can use either Any slot.
 */
export function getCompatiblePlannerSlots(
  record
) {
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

export function isNormallyEquippable(
  record
) {
  return (
    getNormalPlannerSlots(record)
      .length > 0
  );
}

export function canEquipToPlannerSlot(
  record,
  plannerSlotId
) {
  return (
    getCompatiblePlannerSlots(record)
      .includes(plannerSlotId)
  );
}

export function isAnyPlannerSlot(
  slotId
) {
  return ANY_SLOT_IDS.includes(
    slotId
  );
}

/*
 * Returns the original CSV slot value.
 *
 * This is especially useful when displaying an item equipped in
 * Any 1 or Any 2.
 */
export function getNativeSlotDisplay(
  record
) {
  return getField(record, "slot");
}

/*
 * Weapon data
 */

export function getWeaponDamage(
  record
) {
  return parseNumericField(
    getField(record, "damage")
  );
}

export function getWeaponDelay(
  record
) {
  return parseNumericField(
    getField(record, "delay")
  );
}

export function getWeaponSkill(
  record
) {
  return getField(
    record,
    "weaponSkill"
  );
}

export function getWeaponRatio(
  record
) {
  const damage =
    getWeaponDamage(record);

  const delay =
    getWeaponDelay(record);

  if (
    damage === null ||
    delay === null ||
    delay <= 0
  ) {
    return null;
  }

  return damage / delay;
}

export function isWeaponRecord(
  record
) {
  const damage =
    getWeaponDamage(record);

  const delay =
    getWeaponDelay(record);

  return (
    damage !== null ||
    delay !== null ||
    Boolean(getWeaponSkill(record))
  );
}

/*
 * Example:
 * DMG 12, DLY 24 (Ratio 0.500)
 */
export function getWeaponStatDisplay(
  record
) {
  const damage =
    getWeaponDamage(record);

  const delay =
    getWeaponDelay(record);

  const ratio =
    getWeaponRatio(record);

  const visibleParts = [];

  if (damage !== null) {
    visibleParts.push(
      `DMG ${formatNumber(damage)}`
    );
  }

  if (delay !== null) {
    visibleParts.push(
      `DLY ${formatNumber(delay)}`
    );
  }

  const baseText =
    visibleParts.join(", ");

  if (ratio === null) {
    return baseText;
  }

  return (
    `${baseText} ` +
    `(Ratio ${ratio.toFixed(3)})`
  ).trim();
}

/*
 * Single source of truth for item-stat display.
 *
 * Non-weapon:
 * AC 5, STR +4, HP +20
 *
 * Weapon:
 * AC 5, STR +4, HP +20, DMG 12, DLY 24 (Ratio 0.500)
 *
 * If the existing stats field already contains DMG or DLY, those
 * native values are not duplicated. The ratio is still appended.
 */
export function getItemStatsDisplay(
  record
) {
  const preferredStats =
    normalizeText(
      getPreferredStats(record)
    );

  const damage =
    getWeaponDamage(record);

  const delay =
    getWeaponDelay(record);

  const ratio =
    getWeaponRatio(record);

  const nativeStatParts = [];

  if (preferredStats) {
    nativeStatParts.push(
      preferredStats
    );
  }

  if (
    damage !== null &&
    !containsDamageStat(
      preferredStats
    )
  ) {
    nativeStatParts.push(
      `DMG ${formatNumber(damage)}`
    );
  }

  if (
    delay !== null &&
    !containsDelayStat(
      preferredStats
    )
  ) {
    nativeStatParts.push(
      `DLY ${formatNumber(delay)}`
    );
  }

  const baseText =
    joinStatParts(
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

export function getCompactWeaponDisplay(
  record
) {
  return getWeaponStatDisplay(
    record
  );
}

export function getItemRuleDiagnostics(
  record
) {
  const rawSlot =
    getField(record, "slot");

  return {
    recordId:
      getField(record, "recordId"),

    itemName:
      getField(record, "itemName"),

    rawSlot,

    normalizedSlot:
      normalizeSlotText(rawSlot),

    normalPlannerSlots:
      getNormalPlannerSlots(record),

    compatiblePlannerSlots:
      getCompatiblePlannerSlots(
        record
      ),

    equippable:
      isNormallyEquippable(record),

    damage:
      getWeaponDamage(record),

    delay:
      getWeaponDelay(record),

    ratio:
      getWeaponRatio(record),

    weaponSkill:
      getWeaponSkill(record),

    statsDisplay:
      getItemStatsDisplay(record)
  };
}

/*
 * Internal helpers
 */

function splitSlotText(value) {
  const text =
    normalizeText(value);

  if (!text) {
    return [];
  }

  return text
    .replace(/\band\b/gi, ",")
    .split(
      /\s*(?:,|\/|\||;|\+)\s*/
    )
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
  const text =
    normalizeText(value);

  if (!text) {
    return null;
  }

  /*
   * Accepts values such as:
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

  const parsed =
    Number(match[0]);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function containsDamageStat(
  statsText
) {
  return (
    /\bDMG\s*[:=+]?\s*[-+]?\d+(?:\.\d+)?\b/i
      .test(statsText) ||
    /\bDAMAGE\s*[:=+]?\s*[-+]?\d+(?:\.\d+)?\b/i
      .test(statsText)
  );
}

function containsDelayStat(
  statsText
) {
  return (
    /\bDLY\s*[:=+]?\s*[-+]?\d+(?:\.\d+)?\b/i
      .test(statsText) ||
    /\bDELAY\s*[:=+]?\s*[-+]?\d+(?:\.\d+)?\b/i
      .test(statsText)
  );
}

function joinStatParts(parts) {
  const cleanedParts =
    parts
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
