export type PartnerStatus = "pending" | "active" | "suspended" | "rejected";

export type PartnerAttribution = "promo" | "referral" | "manual";

export type PartnerSaleStatus = "pending" | "paid" | "cancelled" | "refunded";

export type PartnerPayoutStatus = "pending" | "processing" | "paid" | "failed";

export type Partner = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  promoCode: string;
  referralSlug: string;
  commissionRate: number;
  status: PartnerStatus;
  payoutMethod: string;
  payoutDetails: string;
  clicks: number;
  leads: number;
  paidOrders: number;
  salesTotal: number;
  accrued: number;
  paidOut: number;
  available: number;
  tier?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

export type PartnerSale = {
  id: string;
  partnerId: string;
  dealId?: string;
  date: string;
  product: string;
  amount: number;
  status: PartnerSaleStatus;
  commission: number;
  attribution: PartnerAttribution;
  createdAt: string;
  updatedAt: string;
};

export type PartnerPayout = {
  id: string;
  partnerId: string;
  date: string;
  amount: number;
  status: PartnerPayoutStatus;
  method: string;
  createdAt: string;
  updatedAt: string;
};

export type PartnerCatalogProduct = {
  id: string;
  title: string;
  description: string;
  priceFrom: number;
  /** When set, shown instead of formatted priceFrom (e.g. «по запросу»). */
  priceLabel?: string;
  productionDays: string;
  audience: string;
  image: string;
  detailsHref?: string;
};

export type PartnerMaterialKind =
  | "pdf"
  | "photo"
  | "video"
  | "reels"
  | "logo"
  | "banner"
  | "text"
  | "faq";

export type PartnerMaterial = {
  id: string;
  title: string;
  description: string;
  kind: PartnerMaterialKind;
  href: string;
};

export type PartnerFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type PartnersCatalog = {
  version: 1;
  partners: Partner[];
  sales: PartnerSale[];
  payouts: PartnerPayout[];
  updatedAt: string;
};

export type PartnerPublicProfile = Omit<Partner, never> & {
  referralUrl: string;
};

export type PartnerMeResponse = {
  partner: PartnerPublicProfile;
  recentSales: PartnerSale[];
  recentPayouts: PartnerPayout[];
  conversion: number;
};
