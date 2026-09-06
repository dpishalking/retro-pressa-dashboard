export type ManagerChatFocusLead = {
  id: string;
  title: string;
  url: string;
  note: string;
};

export type ManagerChatFeedback = {
  bitrixUserId: string;
  name: string;
  firstName: string;
  dialogs: number;
  messages: number;
  stats: {
    withPrice: number;
    withClose: number;
    withList: number;
    withPhoto: number;
    withRecommendation: number;
    waitingOnUs: number;
    slowFirst: number;
  };
  headline: string;
  good: string[];
  better: string[];
  tryToday: string;
  focusLeads: ManagerChatFocusLead[];
};

export type RopChatFeedbackReport = {
  day: string;
  generatedAt: string;
  source: "bitrix-openlines";
  managers: ManagerChatFeedback[];
  teamHeadline: string;
};
