/**
 * Default skills and actions seeded when a job_hunter agent is created.
 */

export interface DefaultSkill {
  skillRef: string;
  isBaseline: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface DefaultAction {
  actionRef: string;
  isEnabled: boolean;
  sortOrder: number;
}

// 5 baseline skills (always included)
const BASELINE_SKILLS: DefaultSkill[] = [
  { skillRef: "builtin:cognitive-load", isBaseline: true, isActive: true, sortOrder: 1 },
  { skillRef: "builtin:self-discovery", isBaseline: true, isActive: true, sortOrder: 2 },
  { skillRef: "builtin:eager-want", isBaseline: true, isActive: true, sortOrder: 3 },
  { skillRef: "builtin:social-norms", isBaseline: true, isActive: true, sortOrder: 4 },
  { skillRef: "builtin:system1-survival", isBaseline: true, isActive: true, sortOrder: 5 },
];

// 4 Voss (tactical empathy)
const VOSS_SKILLS: DefaultSkill[] = [
  { skillRef: "voss:tactical-empathy", isBaseline: false, isActive: true, sortOrder: 10 },
  { skillRef: "voss:mirroring", isBaseline: false, isActive: true, sortOrder: 11 },
  { skillRef: "voss:labeling", isBaseline: false, isActive: true, sortOrder: 12 },
  { skillRef: "voss:calibrated-questions", isBaseline: false, isActive: true, sortOrder: 13 },
];

// 6 Cialdini (influence principles)
const CIALDINI_SKILLS: DefaultSkill[] = [
  { skillRef: "cialdini:reciprocity", isBaseline: false, isActive: true, sortOrder: 20 },
  { skillRef: "cialdini:commitment-consistency", isBaseline: false, isActive: true, sortOrder: 21 },
  { skillRef: "cialdini:social-proof", isBaseline: false, isActive: true, sortOrder: 22 },
  { skillRef: "cialdini:authority", isBaseline: false, isActive: true, sortOrder: 23 },
  { skillRef: "cialdini:liking", isBaseline: false, isActive: true, sortOrder: 24 },
  { skillRef: "cialdini:scarcity", isBaseline: false, isActive: true, sortOrder: 25 },
];

// 4 Carnegie (relationship building)
const CARNEGIE_SKILLS: DefaultSkill[] = [
  { skillRef: "carnegie:genuine-interest", isBaseline: false, isActive: true, sortOrder: 30 },
  { skillRef: "carnegie:name-remembering", isBaseline: false, isActive: true, sortOrder: 31 },
  { skillRef: "carnegie:active-listening", isBaseline: false, isActive: true, sortOrder: 32 },
  { skillRef: "carnegie:importance-feeling", isBaseline: false, isActive: true, sortOrder: 33 },
];

// 19 Behavioral (decision science)
const BEHAVIORAL_SKILLS: DefaultSkill[] = [
  { skillRef: "behavioral:anchoring", isBaseline: false, isActive: true, sortOrder: 40 },
  { skillRef: "behavioral:loss-aversion", isBaseline: false, isActive: true, sortOrder: 41 },
  { skillRef: "behavioral:status-quo-bias", isBaseline: false, isActive: true, sortOrder: 42 },
  { skillRef: "behavioral:framing-effect", isBaseline: false, isActive: true, sortOrder: 43 },
  { skillRef: "behavioral:endowment-effect", isBaseline: false, isActive: true, sortOrder: 44 },
  { skillRef: "behavioral:peak-end-rule", isBaseline: false, isActive: true, sortOrder: 45 },
  { skillRef: "behavioral:decoy-effect", isBaseline: false, isActive: true, sortOrder: 46 },
  { skillRef: "behavioral:paradox-of-choice", isBaseline: false, isActive: true, sortOrder: 47 },
  { skillRef: "behavioral:hyperbolic-discounting", isBaseline: false, isActive: true, sortOrder: 48 },
  { skillRef: "behavioral:ikea-effect", isBaseline: false, isActive: true, sortOrder: 49 },
  { skillRef: "behavioral:mere-exposure", isBaseline: false, isActive: true, sortOrder: 50 },
  { skillRef: "behavioral:bizarreness-effect", isBaseline: false, isActive: true, sortOrder: 51 },
  { skillRef: "behavioral:curiosity-gap", isBaseline: false, isActive: true, sortOrder: 52 },
  { skillRef: "behavioral:narrative-transport", isBaseline: false, isActive: true, sortOrder: 53 },
  { skillRef: "behavioral:concrete-abstract", isBaseline: false, isActive: true, sortOrder: 54 },
  { skillRef: "behavioral:processing-fluency", isBaseline: false, isActive: true, sortOrder: 55 },
  { skillRef: "behavioral:goal-gradient", isBaseline: false, isActive: true, sortOrder: 56 },
  { skillRef: "behavioral:zeigarnik-effect", isBaseline: false, isActive: true, sortOrder: 57 },
  { skillRef: "behavioral:pratfall-effect", isBaseline: false, isActive: true, sortOrder: 58 },
];

// 4 Channel (medium-specific)
const CHANNEL_SKILLS: DefaultSkill[] = [
  { skillRef: "channel:linkedin-norms", isBaseline: false, isActive: true, sortOrder: 60 },
  { skillRef: "channel:email-norms", isBaseline: false, isActive: true, sortOrder: 61 },
  { skillRef: "channel:whatsapp-norms", isBaseline: false, isActive: true, sortOrder: 62 },
  { skillRef: "channel:cold-call-norms", isBaseline: false, isActive: true, sortOrder: 63 },
];

// 4 Meta (meta-skills)
const META_SKILLS: DefaultSkill[] = [
  { skillRef: "meta:channel-selection", isBaseline: false, isActive: true, sortOrder: 70 },
  { skillRef: "meta:timing-optimization", isBaseline: false, isActive: true, sortOrder: 71 },
  { skillRef: "meta:sequence-design", isBaseline: false, isActive: true, sortOrder: 72 },
  { skillRef: "meta:ab-variation", isBaseline: false, isActive: true, sortOrder: 73 },
];

export const DEFAULT_SKILLS: DefaultSkill[] = [
  ...BASELINE_SKILLS,
  ...VOSS_SKILLS,
  ...CIALDINI_SKILLS,
  ...CARNEGIE_SKILLS,
  ...BEHAVIORAL_SKILLS,
  ...CHANNEL_SKILLS,
  ...META_SKILLS,
];

export const DEFAULT_ACTIONS: DefaultAction[] = [
  { actionRef: "builtin:serper-search", isEnabled: true, sortOrder: 1 },
  { actionRef: "builtin:gmail-create-draft", isEnabled: true, sortOrder: 2 },
  { actionRef: "builtin:gmail-send-draft", isEnabled: true, sortOrder: 3 },
  { actionRef: "builtin:linkedin-read-profile", isEnabled: true, sortOrder: 4 },
  { actionRef: "builtin:linkedin-send-connection", isEnabled: true, sortOrder: 5 },
  { actionRef: "builtin:linkedin-send-dm", isEnabled: true, sortOrder: 6 },
];
