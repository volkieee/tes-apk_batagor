// ==========================================================================
// DAPUR BATAGOR - ADMIN PORTAL ENTRY POINT
// This file imports and initializes all admin modules.
// ==========================================================================

import { initAdminDashboard, handleTableActions, listenForOrders } from '../dashboard/dashboard.js';
import { initAdminAuth, initModal, initLiveDateTime } from '../UI/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all UI components
  initAdminAuth();
  initModal();
  initLiveDateTime();

  // Initialize dashboard logic
  initAdminDashboard();
  listenForOrders();

  // Set up a single event listener for table actions (event delegation)
  const table = document.getElementById('orders-table');
  if (table) {
    table.addEventListener('click', handleTableActions);
  }
});
