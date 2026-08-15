// ==========================================================================
// DAPUR BATAGOR - ADMIN PORTAL ENTRY POINT
// This file imports and initializes all admin modules.
// ==========================================================================

import { initAdminDashboard, handleTableActions } from './admin/dashboard.js';
import { initAdminAuth, initModal, initLiveDateTime } from './admin/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all UI components
  initAdminAuth();
  initModal();
  initLiveDateTime();

  // Initialize dashboard logic
  initAdminDashboard();

  // Set up a single event listener for table actions (event delegation)
  const table = document.getElementById('orders-table');
  if (table) {
    table.addEventListener('click', handleTableActions);
  }
});
