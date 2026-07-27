declare module "page-flip/dist/js/page-flip.module.js" {
  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, unknown>);
    destroy(): void;
    update(): void;
    loadFromImages(images: string[]): void;
    flipNext(corner?: "top" | "bottom"): void;
    flipPrev(corner?: "top" | "bottom"): void;
    flip(page: number, corner?: "top" | "bottom"): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    on(event: string, callback: (event: { data: number | { page: number } }) => void): void;
  }
}
