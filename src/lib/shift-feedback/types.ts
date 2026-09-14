export type ShiftFocusLead = {
  id: string;
  title: string;
  url: string;
  note: string;
  nextStep: string;
};

export type ShiftLeadItem = {
  id: string;
  title: string;
  url: string;
  comment: string;
};

export type ShiftManagerPage = {
  bitrixUserId: string;
  scheduleName: string;
  name: string;
  firstName: string;
  onShift: boolean;
  leadsCreated: number;
  leadDupes: number;
  leadUnique: number;
  withUtm: number;
  withoutUtm: number;
  dialogs: number;
  managerMessages: number;
  avgManagerMessages: number | null;
  medianReplyMin: number | null;
  shareUnder5: number | null;
  shareOver60: number | null;
  waitingOnUs: number;
  clientSilent: number;
  withPrice: number;
  withClose: number;
  withList: number;
  withPhoto: number;
  withRecommendation: number;
  withRecipient: number;
  headline: string;
  good: string[];
  better: string[];
  focusLeads: ShiftFocusLead[];
  leads: ShiftLeadItem[];
};

export type ShiftFeedbackReport = {
  day: string;
  dayLabel: string;
  generatedAt: string;
  cutLabel: string;
  liveCut: boolean;
  timezone: "Europe/Moscow";
  shiftHours: string;
  onShiftNames: string[];
  unmatchedSchedule: string[];
  team: {
    created: number;
    dupes: number;
    unique: number;
    withUtm: number;
    withoutUtm: number;
    dialogs: number;
    waitingOnUs: number;
    clientSilent: number;
  };
  managers: ShiftManagerPage[];
  offShift: ShiftManagerPage[];
};
