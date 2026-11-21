// ==========================================================================
// ADMIN - DASHBOARD MODULE
// Manages table population, batch filtering, stats calculation, and order actions.
// ==========================================================================

import { showToast } from '../ui/ui.js';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { db } from '../config/firebase-config.js';

let ordersList = [];
let hasLoadedOrders = false;
let currentBatchFilter = 'Batch 2'; // Default: Batch 2 (Aktif & Fresh)

// Cutoff timestamp: Pesanan Batch 1 selesai per pertengahan Oktober 2026.
// Semua pesanan mulai akhir Oktober 2026 (atau bertanda Batch 2) otomatis masuk Batch 2!
const BATCH_2_START_TIMESTAMP = 1793000000000;

/**
 * Helper to auto-correct specific historical typos or customer changes (e.g. Bapak & emak sugata -> 1 porsi).
 */
export function correctSpecificOrders(order) {
  if (!order) return false;
  const nameNorm = String(order.name || '').toLowerCase().trim();
  // Target: "Bapak & emak sugata" (also catches "bapak & emak sugata", "bapak dan emak sugata", "bapak emak sugata")
  if (nameNorm.includes('sugata') && (nameNorm.includes('bapak') || nameNorm.includes('emak'))) {
    if (order.mix !== 1 || order.total !== 15000 || order.original !== 2 || order.cheese !== 2) {
      order.mix = 1;
      order.original = 2;
      order.cheese = 2;
      order.total = 15000;
      return true;
    }
  }
  return false;
}

/**
 * Normalizes and determines which batch an order belongs to.
 * Double protection: checks both .batch property and order timestamp ID.
 */
export function getOrderBatch(ord) {
  if (!ord) return 'Batch 1';
  
  // 1. Cek jika order secara eksplisit memiliki atribut batch
  const b = String(ord.batch || '').trim().toLowerCase();
  if (b.includes('2')) return 'Batch 2';
  if (b.includes('1')) return 'Batch 1';

  // 2. Cek berdasarkan waktu pemesanan (semua pesanan hari ini otomatis Batch 2)
  const orderIdNum = Number(ord.id);
  if (!isNaN(orderIdNum) && orderIdNum >= BATCH_2_START_TIMESTAMP) {
    return 'Batch 2';
  }

  // 3. Pesanan lama yang dibuat di Batch 1
  return 'Batch 1';
}

/**
 * Initializes the main dashboard functionalities like batch tabs and the export button.
 */
export function initAdminDashboard() {
  initSpreadsheetModal();
  const btnExport = document.getElementById('btn-export-orders');

  // Tab batch switching
  const tabsGroup = document.getElementById('batch-tabs-group');
  if (tabsGroup) {
    tabsGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.batch-tab-btn');
      if (!btn) return;
      const selectedBatch = btn.dataset.batch;
      if (!selectedBatch) return;

      currentBatchFilter = selectedBatch;
      tabsGroup.querySelectorAll('.batch-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const labelEl = document.getElementById('current-batch-label');
      if (labelEl) {
        if (selectedBatch === 'Batch 2') labelEl.textContent = 'Batch 2';
        else if (selectedBatch === 'Batch 1') labelEl.textContent = 'Batch 1 Selesai';
        else labelEl.textContent = 'Semua Riwayat Pesanan';
      }

      refreshAdminTable();
    });
  }

  // Export Rekap Order Button
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      let displayedOrders = ordersList;
      if (currentBatchFilter === 'Batch 2') {
        displayedOrders = ordersList.filter(o => getOrderBatch(o) === 'Batch 2');
      } else if (currentBatchFilter === 'Batch 1') {
        displayedOrders = ordersList.filter(o => getOrderBatch(o) === 'Batch 1');
      }

      if (displayedOrders.length === 0) {
        const batchName = currentBatchFilter === 'Batch 2' ? 'Batch 2' : currentBatchFilter === 'Batch 1' ? 'Batch 1' : 'semua batch';
        showToast('Log Kosong', `Belum ada pesanan di ${batchName} untuk diekspor.`, 'error');
        return;
      }

      const batchTitle = currentBatchFilter === 'Batch 2' 
        ? 'BATCH 2' 
        : currentBatchFilter === 'Batch 1' 
          ? 'BATCH 1 SELESAI' 
          : 'SEMUA BATCH';

      let summaryText = `*REKAP PESANAN BATAGOR-IN - ${batchTitle}*\nTanggal Rekap: ${getFormattedDate()}\n====================================\n\n`;
      let totalIncome = 0;
      let pendingCount = 0;

      displayedOrders.forEach((ord, idx) => {
        const classPart = ord.role === 'Siswa' ? ` (${ord.classRoom})` : ` (${ord.role})`;
        summaryText += `${idx + 1}. *${ord.name}*${classPart} [${getOrderBatch(ord)}]\n`;
        let qty = ord.mix;
        if (!qty && ord.original && ord.cheese && ord.original === ord.cheese) {
          qty = Math.round(ord.original / 2);
        }
        if (!qty && ord.total) {
          qty = Math.round(ord.total / 15000);
        }
        if (qty > 0) {
          summaryText += `   - Original + Keju: ${qty} porsi (${qty * 2} Ori + ${qty * 2} Keju)\n`;
        } else {
          if (ord.original > 0) summaryText += `   - Original: ${ord.original} porsi\n`;
          if (ord.cheese > 0) summaryText += `   - Keju: ${ord.cheese} porsi\n`;
        }
        if (ord.mercon > 0) summaryText += `   - Mercon: ${ord.mercon} porsi\n`;
        summaryText += `   - Bumbu Kacang: ${ord.bumbu || 'Digabung'}\n`;
        if (ord.addonSambal) summaryText += `   - Add-on: Saus Sambal\n`;
        const payLabel = ord.paymentMethod === 'BCA' ? 'Transfer BCA (Bukti Ada)' : 'Tunai / Cash';
        summaryText += `   - Pembayaran: ${payLabel}\n`;
        if (ord.notes && ord.notes !== '-') summaryText += `   - Catatan: "${ord.notes}"\n`;
        summaryText += `   - Status: [${ord.status.toUpperCase()}] | Total: Rp ${ord.total.toLocaleString('id-ID')}\n\n`;

        totalIncome += ord.total;
        if (ord.status === 'Pending') pendingCount++;
      });

      summaryText += `====================================\n`;
      summaryText += `*Total Pesanan (${batchTitle}):* ${displayedOrders.length} Order (${pendingCount} Pending)\n`;
      summaryText += `*Estimasi Pendapatan:* Rp ${totalIncome.toLocaleString('id-ID')}\n`;

      navigator.clipboard.writeText(summaryText)
        .then(() => showToast('Rekap Disalin!', `Rekap ${batchTitle} disalin ke clipboard Anda.`, 'success'))
        .catch(err => {
          showToast('Gagal Salin', 'Tidak dapat menyalin ke clipboard.', 'error');
          console.error(err);
        });
    });
  }

  // Modal Bukti Transfer Close Handlers
  const proofModal = document.getElementById('proof-viewer-modal');
  const btnCloseProof = document.getElementById('btn-close-proof-modal');
  const btnProofClose = document.getElementById('btn-proof-modal-close');
  if (proofModal) {
    const closeProofModal = () => {
      proofModal.classList.remove('active');
      proofModal.style.display = 'none';
    };
    if (btnCloseProof) btnCloseProof.addEventListener('click', closeProofModal);
    if (btnProofClose) btnProofClose.addEventListener('click', closeProofModal);
    proofModal.addEventListener('click', (e) => {
      if (e.target === proofModal) closeProofModal();
    });
  }
}

/**
 * Updates count pills on batch tabs
 */
function updateBatchPills() {
  const count2 = ordersList.filter(o => getOrderBatch(o) === 'Batch 2').length;
  const count1 = ordersList.filter(o => getOrderBatch(o) === 'Batch 1').length;
  const countAll = ordersList.length;

  const pill2 = document.getElementById('badge-count-batch-2');
  const pill1 = document.getElementById('badge-count-batch-1');
  const pillAll = document.getElementById('badge-count-batch-all');

  if (pill2) pill2.textContent = count2;
  if (pill1) pill1.textContent = count1;
  if (pillAll) pillAll.textContent = countAll;
}

/**
 * Refreshes the admin table and statistics filtered by current batch.
 */
export function refreshAdminTable() {
  updateBatchPills();

  const tableBody = document.getElementById('orders-table-body');
  const emptyState = document.getElementById('table-empty-state');
  const statOrders = document.getElementById('stat-total-orders');
  const statRevenue = document.getElementById('stat-total-revenue');
  const statRatio = document.getElementById('stat-variant-ratio');

  if (!tableBody) return;

  // Filter orders according to current selected batch
  let displayedOrders = ordersList;
  if (currentBatchFilter === 'Batch 2') {
    displayedOrders = ordersList.filter(o => getOrderBatch(o) === 'Batch 2');
  } else if (currentBatchFilter === 'Batch 1') {
    displayedOrders = ordersList.filter(o => getOrderBatch(o) === 'Batch 1');
  }

  let totalRevenue = 0, totalCheese = 0, totalOriginal = 0, totalMix = 0, totalMercon = 0;
  tableBody.innerHTML = '';

  if (displayedOrders.length === 0) {
    if (emptyState) {
      emptyState.style.display = 'flex';
      const emptyTitle = emptyState.querySelector('h3');
      const emptyDesc = emptyState.querySelector('p');
      if (emptyTitle && emptyDesc) {
        if (currentBatchFilter === 'Batch 2') {
          emptyTitle.textContent = 'Belum Ada Pre-Order di Batch 2';
          emptyDesc.textContent = 'Daftar pesanan baru Batch 2 yang dibuat lewat formulir akan otomatis muncul di sini secara real-time.';
        } else if (currentBatchFilter === 'Batch 1') {
          emptyTitle.textContent = 'Batch 1 Selesai Kosong';
          emptyDesc.textContent = 'Tidak ada rekaman pesanan untuk Batch 1.';
        } else {
          emptyTitle.textContent = 'Belum Ada Pesanan Masuk';
          emptyDesc.textContent = 'Daftar pesanan baru yang dibuat lewat formulir pesanan akan muncul di sini.';
        }
      }
    }
  } else {
    if (emptyState) emptyState.style.display = 'none';

    displayedOrders.forEach((ord, index) => {
      totalRevenue += ord.total;
      let mixCount = ord.mix;
      if (!mixCount && ord.original && ord.cheese && ord.original === ord.cheese) {
        mixCount = Math.round(ord.original / 2);
      }
      if (!mixCount && ord.total) {
        mixCount = Math.round(ord.total / 15000);
      }
      if (mixCount > 0) {
        totalMix += mixCount;
        totalOriginal += mixCount * 2;
        totalCheese += mixCount * 2;
      } else {
        totalCheese += (ord.cheese || 0);
        totalOriginal += (ord.original || 0);
      }
      totalMercon += (ord.mercon || 0);

      let statusClass = ord.status === 'Paid' ? 'status-paid' : ord.status === 'Delivered' ? 'status-delivered' : 'status-pending';
      let detailsString = '';
      if (mixCount > 0) {
        detailsString += `<div>Ori + Keju: <strong>${mixCount} porsi</strong> <small style="color: var(--text-muted);">(${mixCount * 2} Ori + ${mixCount * 2} Keju)</small></div>`;
      } else {
        if (ord.original > 0) detailsString += `<div>Original: <strong>${ord.original}</strong></div>`;
        if (ord.cheese > 0) detailsString += `<div>Keju: <strong>${ord.cheese}</strong></div>`;
      }
      if (ord.mercon > 0) detailsString += `<div>Mercon: <strong>${ord.mercon}</strong></div>`;
      detailsString += `<div>Bumbu: <strong>${ord.bumbu || 'Digabung'}</strong></div>`;
      if (ord.addonSambal) {
        detailsString += `<div style="color: var(--accent-mercon); font-size: 0.78rem; font-weight: 700; margin-top: 0.2rem;"><i class="fa-solid fa-pepper-hot"></i> + Saus Sambal</div>`;
      }

      // Badge Metode Pembayaran & Tombol Lihat Bukti Transfer
      if (ord.paymentMethod === 'BCA') {
        detailsString += `
          <div style="margin-top: 0.4rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span class="badge-payment-bca"><i class="fa-solid fa-building-columns"></i> BCA</span>
            ${ord.paymentProof ? `
              <button type="button" class="btn-admin-proof" data-action="view-proof" data-order-id="${ord.id}" title="Lihat Foto Bukti Transfer">
                <i class="fa-solid fa-receipt"></i> Bukti TF
              </button>
            ` : '<small style="color: var(--accent-mercon); font-size: 0.72rem;">(Tanpa Foto)</small>'}
          </div>
        `;
      } else {
        detailsString += `
          <div style="margin-top: 0.4rem;">
            <span class="badge-payment-cash"><i class="fa-solid fa-money-bill-wave"></i> Tunai (Cash)</span>
          </div>
        `;
      }

      const batchTag = getOrderBatch(ord);
      const batchClass = batchTag === 'Batch 2' ? 'batch-2' : 'batch-1';

      const rowHtml = `
        <tr>
          <td data-label="No">${index + 1}</td>
          <td data-label="Waktu" style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">${ord.date || '-'}</td>
          <td data-label="Nama & Kelas">
            <strong>${ord.name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">${ord.role} ${ord.classRoom && ord.classRoom !== '-' ? `| ${ord.classRoom}` : ''}</div>
          </td>
          <td data-label="Detail Pesanan"><div class="order-detail-list">${detailsString || '-'}</div></td>
          <td data-label="Catatan" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${ord.notes}">${ord.notes}</td>
          <td data-label="Total"><strong>Rp ${ord.total.toLocaleString('id-ID')}</strong></td>
          <td data-label="Status"><span class="order-badge-status ${statusClass}" style="cursor: pointer;" data-order-id="${ord.id}" data-action="cycle-status"><i class="fa-solid ${ord.status === 'Pending' ? 'fa-spinner' : ord.status === 'Paid' ? 'fa-cash-register' : 'fa-circle-check'}"></i> ${ord.status}</span></td>
          <td data-label="Aksi">
            <div style="display: flex; gap: 0.35rem; justify-content: center;">
              <button class="admin-action-btn btn-edit" data-order-id="${ord.id}" data-action="edit-order" title="Edit jumlah porsi pesanan"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="admin-action-btn btn-delete" data-order-id="${ord.id}" data-action="delete-order" title="Hapus order"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>`;
      tableBody.insertAdjacentHTML('beforeend', rowHtml);
    });
  }

  if (statOrders) statOrders.textContent = displayedOrders.length;
  if (statRevenue) statRevenue.textContent = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
  if (statRatio) {
    statRatio.textContent = totalMix > 0 
      ? `${totalMix} Porsi (${totalOriginal} Ori / ${totalCheese} Keju)` 
      : `${totalOriginal} Orig / ${totalCheese} Keju`;
  }

  // Live sync with spreadsheet modal if open
  const sheetModal = document.getElementById('spreadsheet-modal');
  if (sheetModal && sheetModal.style.display !== 'none') {
    renderSpreadsheetGrid();
  }
}

/**
 * Handles clicks on the table for actions like cycling status or deleting orders.
 * @param {Event} e The click event.
 */
export function handleTableActions(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const targetOrderId = String(target.dataset.orderId || '');
  const index = ordersList.findIndex(o => String(o.id) === targetOrderId);

  if (index === -1) {
    console.warn('Pesanan tidak ditemukan untuk ID:', targetOrderId);
    return;
  }

  if (action === 'view-proof') {
    const order = ordersList[index];
    let proofImg = order?.paymentProof;

    // Fallback pencarian ke localStorage jika di Firestore paymentProof belum sinkron
    if (!proofImg) {
      try {
        const localOrders = JSON.parse(localStorage.getItem('batagor_orders') || '[]');
        const matched = localOrders.find(lo => String(lo.id) === targetOrderId);
        if (matched && matched.paymentProof) {
          proofImg = matched.paymentProof;
        }
      } catch (err) {
        console.warn('Pencarian bukti di localStorage gagal:', err);
      }
    }

    if (!proofImg) {
      showToast('Bukti Kosong', 'Pesanan ini tidak memiliki foto bukti pembayaran.', 'error');
      return;
    }

    const modal = document.getElementById('proof-viewer-modal');
    const modalImg = document.getElementById('proof-modal-img');
    const modalName = document.getElementById('proof-modal-name');
    const modalLink = document.getElementById('proof-modal-open-link');

    if (modalImg) modalImg.src = proofImg;
    if (modalName) modalName.innerHTML = `Pemesan: <strong>${order.name}</strong> (${order.role}${order.classRoom && order.classRoom !== '-' ? ` | Kelas: ${order.classRoom}` : ''})`;
    
    // Fitur buka gambar penuh yang aman dan kompatibel di semua browser
    if (modalLink) {
      modalLink.onclick = (event) => {
        event.preventDefault();
        const win = window.open('');
        if (win) {
          win.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Bukti Pembayaran - ${order.name}</title>
                <style>
                  body { margin: 0; background: #0b0f19; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
                  img { max-width: 95vw; max-height: 95vh; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
                </style>
              </head>
              <body>
                <img src="${proofImg}" alt="Bukti Transfer">
              </body>
            </html>
          `);
          win.document.close();
        } else {
          window.location.href = proofImg;
        }
      };
    }

    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
    }
    return; // Berhenti agar tidak merefresh tabel saat modal dibuka
  } else if (action === 'cycle-status') {
    const states = ['Pending', 'Paid', 'Delivered'];
    const currentIdx = states.indexOf(ordersList[index].status);
    const nextIdx = (currentIdx + 1) % states.length;
    ordersList[index].status = states[nextIdx];

    // Sinkronkan perubahan status ke localStorage
    try {
      let localOrders = JSON.parse(localStorage.getItem('batagor_orders') || '[]');
      const locIdx = localOrders.findIndex(lo => String(lo.id) === targetOrderId);
      if (locIdx !== -1) {
        localOrders[locIdx].status = states[nextIdx];
        localStorage.setItem('batagor_orders', JSON.stringify(localOrders));
      }
    } catch (e) {
      console.warn('Local storage status update failed:', e);
    }

    updateDoc(doc(db, 'orders', targetOrderId), { status: ordersList[index].status })
      .catch(error => console.error('Firestore status update failed:', error));
    showToast('Status Diubah', `Pesanan ${ordersList[index].name} diubah menjadi ${states[nextIdx]}`, 'success');
  } else if (action === 'edit-order') {
    const order = ordersList[index];
    const currentQty = getOrderPortionCount(order) || 1;
    const promptVal = prompt(`Ubah jumlah porsi untuk ${order.name}:\n(Masukkan angka porsi baru, contoh: 1 atau 2)`, String(currentQty));
    if (promptVal === null) return;

    const newQty = parseInt(promptVal.trim(), 10);
    if (isNaN(newQty) || newQty <= 0) {
      showToast('Input Salah', 'Jumlah porsi harus berupa angka positif minimal 1.', 'error');
      return;
    }

    const newTotal = newQty * 15000;
    order.mix = newQty;
    order.original = newQty * 2;
    order.cheese = newQty * 2;
    order.total = newTotal;

    // Sinkronkan ke localStorage
    try {
      let localOrders = JSON.parse(localStorage.getItem('batagor_orders') || '[]');
      const locIdx = localOrders.findIndex(lo => String(lo.id) === targetOrderId);
      if (locIdx !== -1) {
        localOrders[locIdx].mix = newQty;
        localOrders[locIdx].original = newQty * 2;
        localOrders[locIdx].cheese = newQty * 2;
        localOrders[locIdx].total = newTotal;
        localStorage.setItem('batagor_orders', JSON.stringify(localOrders));
      }
    } catch (e) {
      console.warn('Local storage edit failed:', e);
    }

    // Sinkronkan ke Firestore
    updateDoc(doc(db, 'orders', targetOrderId), {
      mix: newQty,
      original: newQty * 2,
      cheese: newQty * 2,
      total: newTotal
    }).catch(error => console.error('Firestore order update failed:', error));

    showToast('Porsi Diperbarui!', `Pesanan ${order.name} berhasil diubah menjadi ${newQty} porsi (Rp ${newTotal.toLocaleString('id-ID')}).`, 'success');
  } else if (action === 'delete-order') {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan pesanan ini?')) return;
    ordersList = ordersList.filter(o => String(o.id) !== targetOrderId);

    // Hapus juga dari localStorage
    try {
      let localOrders = JSON.parse(localStorage.getItem('batagor_orders') || '[]');
      localOrders = localOrders.filter(lo => String(lo.id) !== targetOrderId);
      localStorage.setItem('batagor_orders', JSON.stringify(localOrders));
    } catch (e) {
      console.warn('Local storage delete failed:', e);
    }

    deleteDoc(doc(db, 'orders', targetOrderId))
      .catch(error => console.error('Firestore order delete failed:', error));
    showToast('Order Dihapus', 'Pesanan berhasil dihapus dari log lokal.', 'success');
  }

  refreshAdminTable();
}

export function listenForOrders() {
  requestBrowserNotifications();

  // Preload dari localStorage sebagai fallback cepat & offline
  try {
    const local = JSON.parse(localStorage.getItem('batagor_orders') || '[]');
    if (Array.isArray(local) && local.length > 0) {
      let localUpdated = false;
      local.forEach(o => {
        if (correctSpecificOrders(o)) localUpdated = true;
      });
      if (localUpdated) {
        localStorage.setItem('batagor_orders', JSON.stringify(local));
      }
      if (ordersList.length === 0) {
        ordersList = local;
        refreshAdminTable();
      }
    }
  } catch (err) {
    console.warn('Preload localStorage failed:', err);
  }

  const ordersQuery = query(collection(db, 'orders'), orderBy('id', 'desc'));
  onSnapshot(ordersQuery, snapshot => {
    const newOrderChanges = hasLoadedOrders
      ? snapshot.docChanges().filter(change => change.type === 'added')
      : [];

    ordersList = snapshot.docs.map(orderDoc => {
      const data = { id: orderDoc.id, ...orderDoc.data() };
      if (correctSpecificOrders(data)) {
        updateDoc(doc(db, 'orders', String(data.id)), {
          mix: 1,
          original: 2,
          cheese: 2,
          total: 15000
        }).catch(err => console.warn('Auto-correction Firestore sync error:', err));
      }
      return data;
    });

    try {
      localStorage.setItem('batagor_orders', JSON.stringify(ordersList));
    } catch (e) {}

    refreshAdminTable();

    newOrderChanges.forEach(change => {
      notifyNewOrder({ id: change.doc.id, ...change.doc.data() });
    });
    hasLoadedOrders = true;
  }, error => {
    console.error('Firestore orders listener failed:', error);
    showToast('Gagal Memuat Order', 'Periksa aturan dan koneksi Firestore.', 'error');
  });
}

function getFormattedDate() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const day = pad(d.getDate());
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const month = months[d.getMonth()];
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${day} ${month}, ${hours}:${minutes}`;
}

function requestBrowserNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;

  Notification.requestPermission().catch(error => {
    console.warn('Browser notification permission was not granted:', error);
  });
}

function notifyNewOrder(order) {
  const itemCount = (order.original || 0) + (order.cheese || 0) + (order.mercon || 0);
  const total = Number(order.total || 0).toLocaleString('id-ID');
  const batchTag = getOrderBatch(order);
  const message = `[${batchTag}] ${itemCount} porsi - Rp ${total}`;

  showToast('Order Baru Masuk', `${order.name || 'Pelanggan'}: ${message}`, 'success');

  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const browserNotification = new Notification(`Order Baru Masuk (${batchTag}) - Batagor`, {
    body: `${order.name || 'Pelanggan'} memesan ${message}.`,
    icon: '../../assets/img/foto batagor.jpg',
    tag: `batagor-order-${order.id}`
  });

  browserNotification.onclick = () => {
    window.focus();
    browserNotification.close();
  };
}

// ==========================================================================
// ADMIN SPREADSHEET ENGINE (EXCEL & GOOGLE SHEETS COMPATIBLE)
// ==========================================================================

let spreadsheetBatchFilter = 'Batch 2';
let spreadsheetSearchQuery = '';

export function initSpreadsheetModal() {
  const btnOpen = document.getElementById('btn-open-spreadsheet');
  const btnClose = document.getElementById('btn-close-spreadsheet');
  const modal = document.getElementById('spreadsheet-modal');
  const searchInput = document.getElementById('sheet-search-filter');
  const batchTabs = document.getElementById('sheet-batch-tabs');
  const btnCopySheets = document.getElementById('btn-copy-sheets');
  const btnCopyBatch2 = document.getElementById('btn-copy-batch-2');
  const btnCopyBatch1 = document.getElementById('btn-copy-batch-1');
  const btnDownload = document.getElementById('btn-download-csv');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      openSpreadsheetModal();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      closeSpreadsheetModal();
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeSpreadsheetModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
      closeSpreadsheetModal();
    }
  });

  if (batchTabs) {
    batchTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.sheet-tab-item');
      if (!btn) return;
      const targetBatch = btn.dataset.sheetBatch;
      if (!targetBatch) return;

      spreadsheetBatchFilter = targetBatch;
      batchTabs.querySelectorAll('.sheet-tab-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const viewLabel = document.getElementById('sheet-current-view-name');
      if (viewLabel) {
        viewLabel.textContent = targetBatch === 'Batch 2' 
          ? 'Tabel Batch 2' 
          : targetBatch === 'Batch 1' 
            ? 'Tabel Batch 1 Selesai' 
            : '2 Tabel Terpisah (Batch 2 & 1)';
      }

      renderSpreadsheetGrid();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      spreadsheetSearchQuery = (e.target.value || '').trim().toLowerCase();
      renderSpreadsheetGrid();
    });
  }

  if (btnCopyBatch2) {
    btnCopyBatch2.addEventListener('click', () => {
      copySpreadsheetToClipboard('Batch 2');
    });
  }

  if (btnCopyBatch1) {
    btnCopyBatch1.addEventListener('click', () => {
      copySpreadsheetToClipboard('Batch 1');
    });
  }

  if (btnCopySheets) {
    btnCopySheets.addEventListener('click', () => {
      copySpreadsheetToClipboard(spreadsheetBatchFilter);
    });
  }

  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      downloadSpreadsheetCSV();
    });
  }
}

export function openSpreadsheetModal() {
  const modal = document.getElementById('spreadsheet-modal');
  if (!modal) return;

  // Default strictly to Batch 2 so it is NEVER combined by default
  spreadsheetBatchFilter = (currentBatchFilter === 'Batch 1') ? 'Batch 1' : 'Batch 2';

  const batchTabs = document.getElementById('sheet-batch-tabs');
  if (batchTabs) {
    batchTabs.querySelectorAll('.sheet-tab-item').forEach(btn => {
      if (btn.dataset.sheetBatch === spreadsheetBatchFilter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  const viewLabel = document.getElementById('sheet-current-view-name');
  if (viewLabel) {
    viewLabel.textContent = spreadsheetBatchFilter === 'Batch 2' ? 'Tabel Batch 2' : 'Tabel Batch 1 Selesai';
  }

  modal.classList.add('active');
  modal.style.display = 'flex';
  renderSpreadsheetGrid();
}

export function closeSpreadsheetModal() {
  const modal = document.getElementById('spreadsheet-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.style.display = 'none';
}

function filterByQuery(orders) {
  if (!spreadsheetSearchQuery) return orders;
  const q = spreadsheetSearchQuery;
  return orders.filter(o => {
    const name = String(o.name || '').toLowerCase();
    const role = String(o.role || '').toLowerCase();
    const classRoom = String(o.classRoom || '').toLowerCase();
    const notes = String(o.notes || '').toLowerCase();
    const status = String(o.status || '').toLowerCase();
    const bumbu = String(o.bumbu || '').toLowerCase();
    const payment = String(o.paymentMethod || '').toLowerCase();
    const id = String(o.id || '').toLowerCase();
    return name.includes(q) || role.includes(q) || classRoom.includes(q) || notes.includes(q) || status.includes(q) || bumbu.includes(q) || payment.includes(q) || id.includes(q);
  });
}

function getOrderPortionCount(ord) {
  let mixCount = ord.mix;
  if (!mixCount && ord.original && ord.cheese && ord.original === ord.cheese) {
    mixCount = Math.round(ord.original / 2);
  }
  if (!mixCount && ord.total) {
    mixCount = Math.round(ord.total / 15000);
  }
  return mixCount || 0;
}

function renderSingleOrderRowHtml(ord, idx) {
  const portionNum = getOrderPortionCount(ord);

  const statusBadge = ord.status === 'Paid'
    ? '<span class="cell-badge cell-badge-paid"><i class="fa-solid fa-check"></i> Paid</span>'
    : ord.status === 'Delivered'
      ? '<span class="cell-badge cell-badge-delivered"><i class="fa-solid fa-truck"></i> Delivered</span>'
      : '<span class="cell-badge cell-badge-pending"><i class="fa-solid fa-clock"></i> Pending</span>';

  const payText = ord.paymentMethod === 'BCA'
    ? '<span style="color: #60a5fa; font-weight: 700;"><i class="fa-solid fa-building-columns"></i> BCA Transfer</span>'
    : '<span style="color: #4ade80; font-weight: 700;"><i class="fa-solid fa-money-bill-wave"></i> Tunai (Cash)</span>';

  const sambalText = ord.addonSambal
    ? '<span style="color: #f87171; font-weight: 700;">+ Sambal 🌶️</span>'
    : '<span style="color: #64748b;">-</span>';

  return `
    <tr>
      <td class="grid-row-index">${idx + 1}</td>
      <td class="cell-code" style="color: #94a3b8;">#${ord.id}</td>
      <td style="color: #cbd5e1; white-space: nowrap;">${ord.date || '-'}</td>
      <td style="font-weight: 700; color: #f8fafc;">${ord.name || '-'}</td>
      <td><span style="color: #94a3b8; font-weight: 600;">${ord.role || '-'}</span></td>
      <td style="font-weight: 700; color: #38bdf8;">${ord.classRoom && ord.classRoom !== '-' ? ord.classRoom : '-'}</td>
      <td style="text-align: center; font-weight: 800; color: #facc15;">${portionNum} porsi</td>
      <td>${ord.bumbu || 'Digabung'}</td>
      <td style="text-align: center;">${sambalText}</td>
      <td class="cell-currency">Rp ${(ord.total || 0).toLocaleString('id-ID')}</td>
      <td>${payText}</td>
      <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; color: #94a3b8;" title="${ord.notes || '-'}">${ord.notes || '-'}</td>
      <td>${statusBadge}</td>
    </tr>
  `;
}

export function renderSpreadsheetGrid() {
  const tbody = document.getElementById('spreadsheet-tbody');
  const tfoot = document.getElementById('spreadsheet-tfoot');
  if (!tbody) return;

  // Separate orders by batch
  const batch2All = ordersList.filter(o => getOrderBatch(o) === 'Batch 2');
  const batch1All = ordersList.filter(o => getOrderBatch(o) === 'Batch 1');

  // Update tabs badges
  const pill2 = document.getElementById('sheet-count-batch-2');
  const pill1 = document.getElementById('sheet-count-batch-1');
  const pillAll = document.getElementById('sheet-count-batch-all');
  if (pill2) pill2.textContent = batch2All.length;
  if (pill1) pill1.textContent = batch1All.length;
  if (pillAll) pillAll.textContent = ordersList.length;

  const batch2Filtered = filterByQuery(batch2All);
  const batch1Filtered = filterByQuery(batch1All);

  let activeOrders = [];
  if (spreadsheetBatchFilter === 'Batch 2') {
    activeOrders = batch2Filtered;
  } else if (spreadsheetBatchFilter === 'Batch 1') {
    activeOrders = batch1Filtered;
  } else {
    activeOrders = [...batch2Filtered, ...batch1Filtered];
  }

  // Summary Metrics for active view
  let totalPortions = 0;
  let totalRevenue = 0;
  let pendingCount = 0;
  let paidCount = 0;

  activeOrders.forEach(ord => {
    totalPortions += getOrderPortionCount(ord);
    totalRevenue += (ord.total || 0);
    if (ord.status === 'Pending') pendingCount++;
    if (ord.status === 'Paid') paidCount++;
  });

  // Mode 1: SEPARATED TABLES (2 Tabel Terpisah Berbeda)
  if (spreadsheetBatchFilter === 'Separated' || spreadsheetBatchFilter === 'All') {
    if (batch2Filtered.length === 0 && batch1Filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td class="grid-row-index">1</td>
          <td colspan="13" style="text-align: center; padding: 2.5rem; color: #94a3b8; font-style: italic;">
            <i class="fa-solid fa-folder-open" style="font-size: 1.4rem; display: block; margin-bottom: 0.5rem; color: #64748b;"></i>
            Tidak ada data pesanan yang cocok dengan pencarian.
          </td>
        </tr>
      `;
      if (tfoot) tfoot.innerHTML = '';
      return;
    }

    let b2Portions = 0, b2Rev = 0, b2Paid = 0, b2Pending = 0;
    let b2RowsHtml = '';
    batch2Filtered.forEach((ord, idx) => {
      b2Portions += getOrderPortionCount(ord);
      b2Rev += (ord.total || 0);
      if (ord.status === 'Paid') b2Paid++;
      if (ord.status === 'Pending') b2Pending++;
      b2RowsHtml += renderSingleOrderRowHtml(ord, idx);
    });

    let b1Portions = 0, b1Rev = 0, b1Paid = 0, b1Pending = 0;
    let b1RowsHtml = '';
    batch1Filtered.forEach((ord, idx) => {
      b1Portions += getOrderPortionCount(ord);
      b1Rev += (ord.total || 0);
      if (ord.status === 'Paid') b1Paid++;
      if (ord.status === 'Pending') b1Pending++;
      b1RowsHtml += renderSingleOrderRowHtml(ord, idx);
    });

    let combinedHtml = `
      <!-- TABEL 1: BATCH 2 -->
      <tr class="grid-batch-section-header">
        <td colspan="13">
          <i class="fa-solid fa-fire" style="color: #fb923c; margin-right: 0.4rem;"></i> TABEL 1: DAFTAR PRE-ORDER BATCH 2 (${batch2Filtered.length} Pesanan)
        </td>
      </tr>
      ${b2RowsHtml || '<tr><td colspan="13" style="text-align: center; padding: 1.2rem; color: #94a3b8;">Belum ada pesanan di Batch 2</td></tr>'}
      <tr class="grid-subtotal-row">
        <td class="grid-row-index" style="color: #4ade80;">∑</td>
        <td colspan="5" style="text-align: right; color: #86efac; font-family: var(--font-code);">TOTAL TABEL BATCH 2 (${batch2Filtered.length} Pesanan)</td>
        <td style="text-align: center; color: #fde047; font-size: 0.95rem;">${b2Portions} Porsi</td>
        <td colspan="2"></td>
        <td class="cell-currency" style="color: #86efac; font-size: 0.95rem;">Rp ${b2Rev.toLocaleString('id-ID')}</td>
        <td colspan="2"></td>
        <td style="color: #cbd5e1; font-size: 0.78rem;">Lunas: ${b2Paid} | Pending: ${b2Pending}</td>
      </tr>

      <!-- PEMISAH TABEL -->
      <tr class="grid-batch-gap-row">
        <td colspan="13">
          ═══════════════════════════ BATAS TABEL: ARSIP PESANAN BATCH 1 SELESAI ═══════════════════════════
        </td>
      </tr>

      <!-- TABEL 2: BATCH 1 -->
      <tr class="grid-batch-section-header batch-1-header">
        <td colspan="13">
          <i class="fa-solid fa-box-archive" style="color: #93c5fd; margin-right: 0.4rem;"></i> TABEL 2: DAFTAR PRE-ORDER BATCH 1 SELESAI (${batch1Filtered.length} Pesanan)
        </td>
      </tr>
      ${b1RowsHtml || '<tr><td colspan="13" style="text-align: center; padding: 1.2rem; color: #94a3b8;">Belum ada pesanan di Batch 1</td></tr>'}
      <tr class="grid-subtotal-row batch-1-subtotal">
        <td class="grid-row-index" style="color: #60a5fa;">∑</td>
        <td colspan="5" style="text-align: right; color: #93c5fd; font-family: var(--font-code);">TOTAL TABEL BATCH 1 (${batch1Filtered.length} Pesanan)</td>
        <td style="text-align: center; color: #fde047; font-size: 0.95rem;">${b1Portions} Porsi</td>
        <td colspan="2"></td>
        <td class="cell-currency" style="color: #93c5fd; font-size: 0.95rem;">Rp ${b1Rev.toLocaleString('id-ID')}</td>
        <td colspan="2"></td>
        <td style="color: #cbd5e1; font-size: 0.78rem;">Lunas: ${b1Paid} | Pending: ${b1Pending}</td>
      </tr>
    `;

    tbody.innerHTML = combinedHtml;

    if (tfoot) {
      tfoot.innerHTML = `
        <tr>
          <td class="grid-row-index" style="color: #facc15;">∑∑</td>
          <td colspan="5" style="text-align: right; letter-spacing: 0.05em; font-family: var(--font-code); color: #fef08a;">TOTAL GABUNGAN BATCH 1 & 2 (${activeOrders.length} Pesanan)</td>
          <td style="text-align: center; color: #fde047; font-size: 0.95rem;">${totalPortions} Porsi</td>
          <td colspan="2" style="background: rgba(0,0,0,0.2);"></td>
          <td class="cell-currency" style="font-size: 0.95rem; color: #fef08a;">Rp ${totalRevenue.toLocaleString('id-ID')}</td>
          <td colspan="2" style="background: rgba(0,0,0,0.2);"></td>
          <td style="font-size: 0.78rem; color: #cbd5e1;">Lunas: ${paidCount} | Pending: ${pendingCount}</td>
        </tr>
      `;
    }
  } else {
    // Mode 2: TABEL TUNGGAL (KHUSUS BATCH 2 atau KHUSUS BATCH 1)
    if (activeOrders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td class="grid-row-index">1</td>
          <td colspan="13" style="text-align: center; padding: 2.5rem; color: #94a3b8; font-style: italic;">
            <i class="fa-solid fa-folder-open" style="font-size: 1.4rem; display: block; margin-bottom: 0.5rem; color: #64748b;"></i>
            Tidak ada pesanan di ${spreadsheetBatchFilter}.
          </td>
        </tr>
      `;
      if (tfoot) tfoot.innerHTML = '';
    } else {
      let rowsHtml = '';
      activeOrders.forEach((ord, idx) => {
        rowsHtml += renderSingleOrderRowHtml(ord, idx);
      });
      tbody.innerHTML = rowsHtml;

      if (tfoot) {
        const batchName = spreadsheetBatchFilter === 'Batch 2' ? 'BATCH 2' : 'BATCH 1 SELESAI';
        tfoot.innerHTML = `
          <tr>
            <td class="grid-row-index" style="color: #4ade80;">∑</td>
            <td colspan="5" style="text-align: right; letter-spacing: 0.05em; font-family: var(--font-code); color: #86efac;">TOTAL REKAPITULASI TABEL ${batchName} (${activeOrders.length} Pesanan)</td>
            <td style="text-align: center; color: #fde047; font-size: 0.95rem;">${totalPortions} Porsi</td>
            <td colspan="2" style="background: rgba(0,0,0,0.2);"></td>
            <td class="cell-currency" style="font-size: 0.95rem; color: #86efac;">Rp ${totalRevenue.toLocaleString('id-ID')}</td>
            <td colspan="2" style="background: rgba(0,0,0,0.2);"></td>
            <td style="font-size: 0.78rem; color: #cbd5e1;">Lunas: ${paidCount} | Pending: ${pendingCount}</td>
          </tr>
        `;
      }
    }
  }

  // Update summary strip
  const sumRows = document.getElementById('sheet-sum-rows');
  const sumPortions = document.getElementById('sheet-sum-portions');
  const sumRevenue = document.getElementById('sheet-sum-revenue');
  const sumPending = document.getElementById('sheet-sum-pending');
  const sumPaid = document.getElementById('sheet-sum-paid');
  const timeStamp = document.getElementById('sheet-footer-timestamp');

  if (sumRows) sumRows.textContent = `${activeOrders.length} baris`;
  if (sumPortions) sumPortions.textContent = `${totalPortions} porsi`;
  if (sumRevenue) sumRevenue.textContent = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
  if (sumPending) sumPending.textContent = pendingCount;
  if (sumPaid) sumPaid.textContent = paidCount;
  if (timeStamp) timeStamp.textContent = `Sinkron Terakhir: ${getFormattedDate()}`;
}

const SPREADSHEET_HEADERS = [
  'No',
  'Order ID',
  'Waktu',
  'Nama Pemesan',
  'Status di Sekolah',
  'Kelas / Ruangan',
  'Porsi (Ori + Keju)',
  'Bumbu Kacang',
  'Add-on Sambal',
  'Total (Rp)',
  'Metode Pembayaran',
  'Catatan Khusus',
  'Status Pesanan'
];

function buildBatchTsv(title, orders) {
  let content = `=== ${title.toUpperCase()} ===\n`;
  content += SPREADSHEET_HEADERS.join('\t') + '\n';
  let totalRev = 0;
  let totalPort = 0;

  orders.forEach((ord, index) => {
    const portion = getOrderPortionCount(ord);
    totalPort += portion;
    totalRev += (ord.total || 0);

    const row = [
      index + 1,
      ord.id,
      ord.date || '-',
      ord.name || '-',
      ord.role || '-',
      ord.classRoom || '-',
      `${portion} porsi`,
      ord.bumbu || 'Digabung',
      ord.addonSambal ? 'Ya (Saus Sambal)' : 'Tidak',
      ord.total || 0,
      ord.paymentMethod === 'BCA' ? 'Transfer BCA' : 'Tunai / Cash',
      (ord.notes || '-').replace(/[\r\n\t]/g, ' '),
      ord.status || 'Pending'
    ];
    content += row.join('\t') + '\n';
  });

  content += `TOTAL ${title.toUpperCase()}\t-\t-\t-\t-\t-\t${totalPort} porsi\t-\t-\t${totalRev}\t-\t-\t-\n`;
  return content;
}

export function copySpreadsheetToClipboard(targetBatch) {
  const chosenBatch = targetBatch || spreadsheetBatchFilter || 'Batch 2';

  if (chosenBatch === 'Batch 2') {
    const list = filterByQuery(ordersList.filter(o => getOrderBatch(o) === 'Batch 2'));
    if (list.length === 0) {
      showToast('Tabel Kosong', 'Tidak ada data pesanan di Batch 2 untuk disalin.', 'error');
      return;
    }
    const tsv = buildBatchTsv('Tabel Pre-Order Batch 2', list);
    navigator.clipboard.writeText(tsv).then(() => {
      showToast('Tabel Batch 2 Disalin!', `${list.length} baris pesanan Batch 2 disalin. Buka Google Sheets lalu tekan Ctrl+V.`, 'success');
    }).catch(() => showToast('Gagal Salin', 'Tidak dapat menyalin ke clipboard.', 'error'));
  } else if (chosenBatch === 'Batch 1') {
    const list = filterByQuery(ordersList.filter(o => getOrderBatch(o) === 'Batch 1'));
    if (list.length === 0) {
      showToast('Tabel Kosong', 'Tidak ada data pesanan di Batch 1 untuk disalin.', 'error');
      return;
    }
    const tsv = buildBatchTsv('Tabel Pre-Order Batch 1 Selesai', list);
    navigator.clipboard.writeText(tsv).then(() => {
      showToast('Tabel Batch 1 Disalin!', `${list.length} baris pesanan Batch 1 disalin. Buka Google Sheets lalu tekan Ctrl+V.`, 'success');
    }).catch(() => showToast('Gagal Salin', 'Tidak dapat menyalin ke clipboard.', 'error'));
  } else {
    // Mode Separated: SALIN 2 TABEL TERPISAH
    const listB2 = filterByQuery(ordersList.filter(o => getOrderBatch(o) === 'Batch 2'));
    const listB1 = filterByQuery(ordersList.filter(o => getOrderBatch(o) === 'Batch 1'));

    if (listB2.length === 0 && listB1.length === 0) {
      showToast('Tabel Kosong', 'Tidak ada data pesanan untuk disalin.', 'error');
      return;
    }

    let fullTsv = '';
    if (listB2.length > 0) {
      fullTsv += buildBatchTsv('TABEL 1: PRE-ORDER BATCH 2', listB2) + '\n\n';
    }
    if (listB1.length > 0) {
      fullTsv += buildBatchTsv('TABEL 2: PRE-ORDER BATCH 1 (SELESAI)', listB1);
    }

    navigator.clipboard.writeText(fullTsv).then(() => {
      showToast('2 Tabel Terpisah Disalin!', 'Tabel Batch 2 & Batch 1 disalin sebagai dua tabel terpisah rapi. Tekan Ctrl+V di Sheets.', 'success');
    }).catch(() => showToast('Gagal Salin', 'Tidak dapat menyalin ke clipboard.', 'error'));
  }
}

export function downloadSpreadsheetCSV() {
  const chosenBatch = spreadsheetBatchFilter || 'Batch 2';
  const escapeCSV = (val) => {
    const s = String(val === undefined || val === null ? '' : val).replace(/"/g, '""');
    return `"${s}"`;
  };

  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel
  let fileName = '';

  const buildCsvBlock = (title, orders) => {
    let block = `=== ${title.toUpperCase()} ===\r\n`;
    block += SPREADSHEET_HEADERS.map(escapeCSV).join(',') + '\r\n';
    let totalRev = 0;
    let totalPort = 0;

    orders.forEach((ord, index) => {
      const portion = getOrderPortionCount(ord);
      totalPort += portion;
      totalRev += (ord.total || 0);

      const row = [
        index + 1,
        ord.id,
        ord.date || '-',
        ord.name || '-',
        ord.role || '-',
        ord.classRoom || '-',
        `${portion} porsi`,
        ord.bumbu || 'Digabung',
        ord.addonSambal ? 'Ya (Saus Sambal)' : 'Tidak',
        ord.total || 0,
        ord.paymentMethod === 'BCA' ? 'Transfer BCA' : 'Tunai / Cash',
        ord.notes || '-',
        ord.status || 'Pending'
      ];
      block += row.map(escapeCSV).join(',') + '\r\n';
    });

    block += [
      `TOTAL ${title.toUpperCase()}`,
      '',
      '',
      '',
      '',
      '',
      `${totalPort} porsi`,
      '',
      '',
      totalRev,
      '',
      '',
      ''
    ].map(escapeCSV).join(',') + '\r\n';

    return block;
  };

  if (chosenBatch === 'Batch 2') {
    const list = filterByQuery(ordersList.filter(o => getOrderBatch(o) === 'Batch 2'));
    if (list.length === 0) {
      showToast('Tabel Kosong', 'Tidak ada data di Batch 2 untuk diunduh.', 'error');
      return;
    }
    csvContent += buildCsvBlock('Tabel Pre-Order Batch 2', list);
    fileName = 'rekap_pesanan_batagor_batch_2.csv';
  } else if (chosenBatch === 'Batch 1') {
    const list = filterByQuery(ordersList.filter(o => getOrderBatch(o) === 'Batch 1'));
    if (list.length === 0) {
      showToast('Tabel Kosong', 'Tidak ada data di Batch 1 untuk diunduh.', 'error');
      return;
    }
    csvContent += buildCsvBlock('Tabel Pre-Order Batch 1 Selesai', list);
    fileName = 'rekap_pesanan_batagor_batch_1.csv';
  } else {
    const listB2 = filterByQuery(ordersList.filter(o => getOrderBatch(o) === 'Batch 2'));
    const listB1 = filterByQuery(ordersList.filter(o => getOrderBatch(o) === 'Batch 1'));
    csvContent += buildCsvBlock('Tabel 1: Pre-Order Batch 2', listB2) + '\r\n\r\n';
    csvContent += buildCsvBlock('Tabel 2: Pre-Order Batch 1 Selesai', listB1);
    fileName = 'rekap_pesanan_batagor_2_tabel_terpisah.csv';
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('File CSV Diunduh!', `File ${fileName} berhasil diunduh dan siap dibuka di Excel.`, 'success');
}
