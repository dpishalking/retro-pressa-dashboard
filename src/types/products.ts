export type ProductIssuePage = {
  page: number;
  src: string;
  file: string;
};

export type ProductIssueManifest = {
  version: 1;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  sourceFile: string;
  pages: ProductIssuePage[];
};

export type ProductIssueSummary = {
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  viewPath: string;
};
