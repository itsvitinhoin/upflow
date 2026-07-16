type Translate = (key: string, vars?: Record<string, string | number>) => string;

const TITLE_KEYS: Record<string, string> = {
  "client created and services selected": "onboardingBoard.item.clientCreatedAndServicesSelected",
  "company registration completed": "onboardingBoard.item.companyRegistrationCompleted",
  "signed contract uploaded privately": "onboardingBoard.item.signedContractUploadedPrivately",
  "service leaders assigned": "onboardingBoard.item.serviceLeadersAssigned",
  "client communication group created": "onboardingBoard.item.clientCommunicationGroupCreated",
  "brand guidelines meeting scheduled": "onboardingBoard.item.brandGuidelinesMeetingScheduled",
  "visita tecnica scheduled": "onboardingBoard.item.technicalVisitScheduled",
  "marketing b2b onboarding form": "onboardingBoard.item.marketingB2BForm",
  "marketing b2b onboarding form completed": "onboardingBoard.item.marketingB2BFormCompleted",
  "marketing b2b kickoff meeting scheduled": "onboardingBoard.item.marketingB2BKickoffScheduled",
  "marketing b2c onboarding form": "onboardingBoard.item.marketingB2CForm",
  "marketing b2c onboarding form completed": "onboardingBoard.item.marketingB2CFormCompleted",
  "marketing b2c kickoff meeting scheduled": "onboardingBoard.item.marketingB2CKickoffScheduled",
  "onboarding: commercial setup confirmed": "onboardingBoard.item.commercialSetupConfirmed",
  "onboarding: complete finance registration": "onboardingBoard.item.completeFinanceRegistration",
  "onboarding: upload signed contract": "onboardingBoard.item.uploadSignedContract",
  "onboarding: create client communication group": "onboardingBoard.item.createClientCommunicationGroup",
  "onboarding: schedule brand guidelines meeting": "onboardingBoard.item.scheduleBrandGuidelinesMeeting",
  "onboarding: schedule visita tecnica": "onboardingBoard.item.scheduleTechnicalVisit",
  "onboarding: schedule marketing b2b kickoff meeting": "onboardingBoard.item.scheduleMarketingB2BKickoff",
  "onboarding: schedule marketing b2c kickoff meeting": "onboardingBoard.item.scheduleMarketingB2CKickoff",
  "up zero website configuration": "onboardingBoard.configureUpZero",
};

function normalizedTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function translated(key: string, fallback: string, t: Translate, vars?: Record<string, string | number>) {
  const value = t(key, vars);
  return value === key ? fallback : value;
}

export function onboardingTitleLabel(title: string, t: Translate) {
  const key = TITLE_KEYS[normalizedTitle(title)];
  if (key) return translated(key, title, t);

  const scheduledMatch = title.match(/^(.+?)\s+onboarding meeting scheduled$/i);
  if (scheduledMatch) {
    return translated(
      "onboardingBoard.item.serviceMeetingScheduled",
      title,
      t,
      { service: scheduledMatch[1] },
    );
  }

  const schedulingMatch = title.match(/^Onboarding:\s*schedule\s+(.+?)\s+onboarding meeting$/i);
  if (schedulingMatch) {
    return translated(
      "onboardingBoard.item.scheduleServiceMeeting",
      title,
      t,
      { service: schedulingMatch[1] },
    );
  }

  return title;
}
