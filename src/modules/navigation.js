// Navigation Module (Vite)
import { showPage, toggleSidebar, toggleMobileSidebar } from './router.js';

export { showPage, toggleSidebar, toggleMobileSidebar };

if (typeof window !== 'undefined') {
  window.SFJR_NAVIGATION_MODULE = { showPage, toggleSidebar, toggleMobileSidebar };
}
