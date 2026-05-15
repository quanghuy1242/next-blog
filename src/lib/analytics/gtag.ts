export const GA_TRACKING_ID = 'G-LCDKH73MHQ';

type GtagConfig = Record<string, unknown>;

type GtagCommand =
  | ['config', string, GtagConfig]
  | ['event', string, GtagConfig];

type GtagFunction = (...args: GtagCommand) => void;

declare global {
  interface Window {
    gtag?: GtagFunction;
  }
}

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageview = (url: string): void => {
  window.gtag?.('config', GA_TRACKING_ID, {
    page_path: url,
  });
};
