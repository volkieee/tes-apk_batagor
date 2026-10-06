// ============================================================
// RINGKASAN.JS — Halaman Ringkasan Pesanan Batagor-in
// Membaca draft order dari sessionStorage / localStorage
// Menampilkan receipt digital, lalu kirim ke WhatsApp + Firestore
// ============================================================

const ITEM_PRICE = 15000;
const DEFAULT_SELLER_WA = '6285921214331';

// Firestore safe dynamic import
async function saveOrderToFirestore(order) {
  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');
    const { db } = await import('../../src/config/firebase-config.js');
    await setDoc(doc(db, 'orders', String(order.id)), order);
    console.log('Order synced to Firestore:', order.id);
  } catch (err) {
    console.warn('Firestore sync failed (offline?):', err);
  }
}

function getSellerWANumber() {
  let number = (localStorage.getItem('seller_wa_number') || DEFAULT_SELLER_WA).replace(/[^0-9]/g, '');
  if (number.startsWith('0')) {
    number = '62' + number.substring(1);
  } else if (!number.startsWith('62')) {
    number = '62' + number;
  }
  return number;
}

function buildWhatsAppUrl(message) {
  const phone = getSellerWANumber();
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
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

function constructWhatsAppMessage(order) {
  let itemsBreakdown = '';
  if (order.original > 0) {
    itemsBreakdown += `- *${order.original} porsi* Batagor Original (Rp ${(order.original * ITEM_PRICE).toLocaleString('id-ID')})\n`;
  }
  if (order.cheese > 0) {
    itemsBreakdown += `- *${order.cheese} porsi* Batagor Keju (Rp ${(order.cheese * ITEM_PRICE).toLocaleString('id-ID')})\n`;
  }

  const classLine = order.role === 'Siswa' ? `*Kelas:* ${order.classRoom}\n` : '';

  return `*PRE-ORDER BATAGOR-IN* 🥟
--------------------------------------------
*Nama:* ${order.name}
*Status:* ${order.role}
${classLine}--------------------------------------------
*Rincian Pesanan:*
${itemsBreakdown}
*Catatan:* ${order.notes || '-'}
--------------------------------------------
*Total Tagihan:* Rp ${order.total.toLocaleString('id-ID')}
--------------------------------------------
_Halo kak, saya ingin mengonfirmasi pesanan Batagor-in saya di atas. Terima kasih!_ 🙏`;
}

// Toast Notification
let toastTimeout;
function showToast(title, desc, type = 'success') {
  const toast = document.getElementById('toast-notif');
  const tIcon = document.getElementById('toast-icon');
  const tTitle = document.getElementById('toast-title');
  const tDesc = document.getElementById('toast-desc');

  if (!toast) return;
  clearTimeout(toastTimeout);

  tTitle.textContent = title;
  tDesc.textContent = desc;

  if (type === 'success') {
    tIcon.className = 'toast-icon success';
    tIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    toast.style.borderColor = 'var(--accent-green)';
  } else {
    tIcon.className = 'toast-icon error';
    tIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    toast.style.borderColor = 'var(--accent-mercon)';
  }

  toast.classList.add('show');
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  const rawDraft = sessionStorage.getItem('batagor_draft_order') || localStorage.getItem('batagor_draft_order');
  const wrapper = document.getElementById('receipt-wrapper');

  if (!rawDraft) {
    renderEmptyState(wrapper);
    return;
  }

  let orderData;
  try {
    orderData = JSON.parse(rawDraft);
  } catch (e) {
    console.error('Invalid draft data', e);
    renderEmptyState(wrapper);
    return;
  }

  const originalQty = Number(orderData.original || 0);
  const cheeseQty = Number(orderData.cheese || 0);
  const totalItems = originalQty + cheeseQty;

  if (totalItems <= 0 || !orderData.name) {
    renderEmptyState(wrapper);
    return;
  }

  const totalCost = totalItems * ITEM_PRICE;
  orderData.total = totalCost;

  renderReceipt(wrapper, orderData);
});

function renderEmptyState(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-receipt-card">
      <div class="empty-receipt-icon">
        <i class="fa-solid fa-cart-shopping"></i>
      </div>
      <h2>Belum Ada Pesanan Aktif</h2>
      <p>Anda belum mengisi formulir pemesanan atau data pesanan telah selesai dikirim.</p>
      <div style="margin-top: 1.5rem;">
        <a href="index.html#preorder" class="btn-primary" style="display: inline-flex;">
          <i class="fa-solid fa-arrow-left"></i> Mulai Pre-Order Sekarang
        </a>
      </div>
    </div>
  `;
}

function renderReceipt(container, order) {
  if (!container) return;

  const originalQty = Number(order.original || 0);
  const cheeseQty = Number(order.cheese || 0);
  const formattedDate = order.date || getFormattedDate();

  let itemsHtml = '';
  if (originalQty > 0) {
    itemsHtml += `
      <div class="receipt-item-row">
        <div class="item-name-col">
          <span class="item-title">Batagor Original</span>
          <span class="item-subtitle">${originalQty} porsi × Rp ${ITEM_PRICE.toLocaleString('id-ID')}</span>
        </div>
        <div class="item-price-col">
          Rp ${(originalQty * ITEM_PRICE).toLocaleString('id-ID')}
        </div>
      </div>
    `;
  }
  if (cheeseQty > 0) {
    itemsHtml += `
      <div class="receipt-item-row">
        <div class="item-name-col">
          <span class="item-title">Batagor Keju</span>
          <span class="item-subtitle">${cheeseQty} porsi × Rp ${ITEM_PRICE.toLocaleString('id-ID')}</span>
        </div>
        <div class="item-price-col">
          Rp ${(cheeseQty * ITEM_PRICE).toLocaleString('id-ID')}
        </div>
      </div>
    `;
  }

  const classRow = order.role === 'Siswa'
    ? `<div class="receipt-info-row">
         <span class="info-label"><i class="fa-solid fa-chalkboard"></i> Kelas</span>
         <span class="info-value">${order.classRoom || '-'}</span>
       </div>`
    : '';

  const notesRow = order.notes && order.notes !== '-'
    ? `<div class="receipt-info-row">
         <span class="info-label"><i class="fa-solid fa-message"></i> Catatan Khusus</span>
         <span class="info-value">${order.notes}</span>
       </div>`
    : '';

  container.innerHTML = `
    <div class="digital-receipt-card">
      <div class="receipt-header">
        <div class="receipt-header-left">
          <span class="receipt-date"><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
        </div>
        <div class="receipt-header-right">
          <span class="status-pill status-ready">
            <i class="fa-solid fa-circle-dot"></i> Siap Dikonfirmasi
          </span>
        </div>
      </div>

      <div class="receipt-section">
        <h4 class="receipt-section-title"><i class="fa-solid fa-user-check"></i> Data Pemesan</h4>
        <div class="receipt-info-grid">
          <div class="receipt-info-row">
            <span class="info-label"><i class="fa-solid fa-id-badge"></i> Nama Lengkap</span>
            <span class="info-value highlight">${order.name}</span>
          </div>
          <div class="receipt-info-row">
            <span class="info-label"><i class="fa-solid fa-graduation-cap"></i> Status</span>
            <span class="info-value">${order.role}</span>
          </div>
          ${classRow}
          ${notesRow}
        </div>
      </div>

      <div class="receipt-section">
        <h4 class="receipt-section-title"><i class="fa-solid fa-utensils"></i> Rincian Menu Pesanan</h4>
        <div class="receipt-items-table">
          ${itemsHtml}
        </div>
        <div class="receipt-total-row">
          <span>Total Pembayaran</span>
          <span class="total-amount">Rp ${order.total.toLocaleString('id-ID')}</span>
        </div>
      </div>

      <div class="receipt-footer-instructions">
        <div class="instruction-box">
          <i class="fa-solid fa-shield-halved"></i>
          <div>
            <strong>Langkah Terakhir:</strong>
            <p>Klik tombol hijau di bawah untuk mengirim data pesanan Anda langsung ke WhatsApp penjual dengan format otomatis.</p>
          </div>
        </div>

        <div class="receipt-actions">
          <button type="button" class="btn-checkout" id="btn-confirm-wa">
            <i class="fa-brands fa-whatsapp"></i> Kirim Order via WhatsApp
          </button>
          <a href="index.html#preorder" class="btn-summary-back" id="btn-edit-order" style="text-align: center; text-decoration: none; display: block;">
            <i class="fa-solid fa-pen-to-square"></i> Ubah / Edit Formulir
          </a>
        </div>
      </div>
    </div>
  `;

  // Listener tombol kirim WA
  const btnConfirmWA = document.getElementById('btn-confirm-wa');
  if (!btnConfirmWA) return;

  btnConfirmWA.addEventListener('click', () => {
    btnConfirmWA.disabled = true;
    btnConfirmWA.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membuka WhatsApp...';

    const timestamp = order.id || Date.now();
    const finalOrder = {
      id: timestamp,
      name: order.name,
      role: order.role,
      classRoom: order.classRoom || '-',
      original: originalQty,
      cheese: cheeseQty,
      total: order.total,
      notes: order.notes || '-',
      date: order.date || getFormattedDate(),
      status: 'Pending'
    };

    // Simpan ke local history (sinkron, cepat)
    let ordersList = JSON.parse(localStorage.getItem('batagor_orders')) || [];
    ordersList.unshift(finalOrder);
    localStorage.setItem('batagor_orders', JSON.stringify(ordersList));

    // Simpan ke Firestore di background — TIDAK ditunggu agar cepat
    saveOrderToFirestore(finalOrder);

    // Bersihkan draft order
    sessionStorage.removeItem('batagor_draft_order');
    localStorage.removeItem('batagor_draft_order');

    const waText = constructWhatsAppMessage(finalOrder);
    const waUrl = buildWhatsAppUrl(waText);

    // Buka WA langsung (tab baru), tetap di halaman ringkasan
    const newTab = window.open(waUrl, '_blank');
    if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
      // Popup diblokir: fallback langsung redirect
      window.location.href = waUrl;
      return;
    }

    showToast('Pesanan Terkirim!', 'Membuka WhatsApp di tab baru...', 'success');

    // Setelah WA terbuka, redirect ke halaman utama setelah jeda singkat
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1200);
  });
}

