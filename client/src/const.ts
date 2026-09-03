export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Placeholder for the local auth screen. The portable export starts in demo mode;
 * replace this with your chosen OIDC/Auth.js flow before production.
 */
export const startLogin = () => {
  window.location.assign("/login");
};
