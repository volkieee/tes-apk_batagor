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
  const qty = order.mix || (order.total ? Math.round(order.total / ITEM_PRICE) : (order.original || 0));
  if (qty > 0) {
    itemsBreakdown += `- *${qty} porsi* Batagor Original + Keju (${qty * 2} Ori + ${qty * 2} Keju) (Rp ${(qty * ITEM_PRICE).toLocaleString('id-ID')})\n`;
  } else {
    if (order.original > 0) {
      itemsBreakdown += `- *${order.original} porsi* Batagor Original (Rp ${(order.original * ITEM_PRICE).toLocaleString('id-ID')})\n`;
    }
    if (order.cheese > 0) {
      itemsBreakdown += `- *${order.cheese} porsi* Batagor Keju (Rp ${(order.cheese * ITEM_PRICE).toLocaleString('id-ID')})\n`;
    }
  }

  if (order.addonSambal) {
    itemsBreakdown += `- *Add-on:* Saus Sambal 🌶️ (Gratis)\n`;
  }

  const classLine = order.role === 'Siswa' ? `*Kelas:* ${order.classRoom}\n` : '';
  const bumbuLine = `*Bumbu Kacang:* ${order.bumbu || 'Digabung'}\n`;

  let paymentText = '';
  if (order.paymentMethod === 'BCA') {
    paymentText = `*Metode Pembayaran:* Transfer BCA (5390903440 a/n Sugata Joeng)\n*Status Pembayaran:* Bukti Transfer Terlampir ✅\n`;
  } else {
    paymentText = `*Metode Pembayaran:* 💵 Tunai / Cash (Bayar Saat Diterima)\n`;
  }

  return `*PRE-ORDER BATAGOR-IN (BATCH 2)* 🥟
--------------------------------------------
*Nama:* ${order.name}
*Status:* ${order.role}
${classLine}${bumbuLine}--------------------------------------------
*Rincian Pesanan:*
${itemsBreakdown}
*Catatan:* ${order.notes || '-'}
--------------------------------------------
${paymentText}*Total Tagihan:* Rp ${order.total.toLocaleString('id-ID')}
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
  const mixQty = Number(order.mix || 0) || (order.total ? Math.round(order.total / ITEM_PRICE) : 0);
  if (mixQty > 0) {
    itemsHtml += `
      <div class="receipt-item-row">
        <div class="item-name-col">
          <span class="item-title">Batagor Original + Keju</span>
          <span class="item-subtitle">${mixQty} porsi (${mixQty * 2} Ori + ${mixQty * 2} Keju)</span>
        </div>
        <div class="item-price-col">
          Rp ${(mixQty * ITEM_PRICE).toLocaleString('id-ID')}
        </div>
      </div>
    `;
  } else {
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
  }

  if (order.addonSambal) {
    itemsHtml += `
      <div class="receipt-item-row">
        <div class="item-name-col">
          <span class="item-title"><i class="fa-solid fa-pepper-hot" style="color: var(--accent-mercon);"></i> Saus Sambal</span>
          <span class="item-subtitle">Add-on pelengkap rasa</span>
        </div>
        <div class="item-price-col" style="color: var(--accent-green); font-weight: 800;">
          Gratis
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

  const bumbuRow = `
    <div class="receipt-info-row">
      <span class="info-label"><i class="fa-solid fa-droplet"></i> Bumbu Kacang</span>
      <span class="info-value highlight" style="color: var(--primary); font-weight: 800;">${order.bumbu || 'Digabung'}</span>
    </div>`;

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
          ${bumbuRow}
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

      <!-- Metode Pembayaran: Cash atau Transfer BCA -->
      <div class="receipt-section payment-section">
        <h4 class="receipt-section-title"><i class="fa-solid fa-wallet"></i> Metode Pembayaran <span class="req">*</span></h4>
        
        <div class="payment-method-grid">
          <label class="payment-choice-card" id="card-pay-cash">
            <input type="radio" name="payment-method" value="Cash" checked>
            <div class="payment-choice-box">
              <div class="payment-choice-icon">
                <i class="fa-solid fa-money-bill-wave"></i>
              </div>
              <div class="payment-choice-text">
                <strong>Tunai / Cash</strong>
                <span>Bayar saat pesanan tiba</span>
              </div>
            </div>
          </label>

          <label class="payment-choice-card" id="card-pay-bca">
            <input type="radio" name="payment-method" value="BCA">
            <div class="payment-choice-box">
              <div class="payment-choice-icon bca-blue">
                <i class="fa-solid fa-building-columns"></i>
              </div>
              <div class="payment-choice-text">
                <strong>Transfer BCA</strong>
                <span>a/n Sugata Joeng</span>
              </div>
            </div>
          </label>
        </div>

        <!-- Detail Transfer BCA & Upload Bukti (Wajib jika BCA) -->
        <div class="bca-panel" id="bca-panel" style="display: none;">
          <div class="bca-atm-card">
            <div class="bca-atm-header">
              <span class="bca-atm-logo">BCA</span>
              <span class="bca-atm-type"><i class="fa-solid fa-shield-halved"></i> Rekening Resmi</span>
            </div>
            <div class="bca-atm-body">
              <span class="bca-label-rek">Nomor Rekening BCA Penjual:</span>
              <div class="bca-rekening-wrapper">
                <span class="bca-rekening-digits" id="bca-rek-number">5390903440</span>
                <button type="button" class="btn-copy-rek" id="btn-copy-rek" title="Salin nomor rekening">
                  <i class="fa-solid fa-copy"></i> Salin
                </button>
              </div>
              <div class="bca-holder-name">
                Atas Nama: <strong>Sugata Joeng</strong>
              </div>
            </div>
            <div class="bca-atm-footer">
              <span>Total Transfer:</span>
              <strong>Rp ${order.total.toLocaleString('id-ID')}</strong>
            </div>
          </div>

          <!-- Upload Bukti Pembayaran -->
          <div class="proof-upload-container" id="proof-upload-container">
            <label class="proof-upload-label">
              <span class="proof-label-title">
                <i class="fa-solid fa-cloud-arrow-up" style="color: var(--primary);"></i> Upload Bukti Pembayaran
              </span>
              <span class="req-star">* (Wajib Diisi)</span>
            </label>
            <p class="proof-upload-desc">
              Harap upload tangkapan layar (screenshot) / foto bukti transfer Anda sebelum lanjut ke WhatsApp.
            </p>

            <input type="file" id="input-payment-proof" accept="image/*" style="display: none;">

            <div class="proof-drop-area" id="proof-drop-area">
              <div class="drop-area-placeholder" id="drop-area-placeholder">
                <div class="drop-icon-circle">
                  <i class="fa-solid fa-camera"></i>
                </div>
                <span class="drop-main-text">Klik untuk Pilih / Ambil Foto Bukti</span>
                <span class="drop-sub-text">Mendukung format JPG, PNG, WEBP</span>
              </div>

              <div class="drop-area-preview" id="drop-area-preview" style="display: none;">
                <img id="payment-proof-preview-img" src="" alt="Bukti Pembayaran">
                <div class="preview-overlay">
                  <span class="preview-success-tag"><i class="fa-solid fa-circle-check"></i> Foto Bukti Terpasang</span>
                  <button type="button" class="btn-reupload" id="btn-reupload">
                    <i class="fa-solid fa-rotate-right"></i> Ganti Foto
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="receipt-footer-instructions">
        <div class="instruction-box warning-box">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div>
            <strong><span class="wajib-badge">WAJIB</span> Langkah Terakhir: Kirim ke WhatsApp</strong>
            <p>Pesanan Anda <strong>BELUM RESMI MASUK & TIDAK AKAN DIPROSES</strong> sebelum Anda menekan tombol di bawah dan mengirimkan pesan konfirmasi ke WhatsApp penjual!</p>
          </div>
        </div>

        <div class="receipt-actions">
          <button type="button" class="btn-checkout pulse-wa" id="btn-confirm-wa">
            <i class="fa-brands fa-whatsapp"></i> (Wajib) Kirim Order via WhatsApp
          </button>
          <a href="index.html#preorder" class="btn-summary-back" id="btn-edit-order" style="text-align: center; text-decoration: none;">
            <i class="fa-solid fa-arrow-left"></i> Kembali ke Formulir
          </a>
        </div>
      </div>
    </div>
  `;

  // Interaktivitas Metode Pembayaran (Cash vs BCA)
  const payRadios = document.querySelectorAll('input[name="payment-method"]');
  const bcaPanel = document.getElementById('bca-panel');
  let uploadedProofBase64 = null;

  payRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const selected = document.querySelector('input[name="payment-method"]:checked')?.value || 'Cash';
      if (selected === 'BCA') {
        if (bcaPanel) bcaPanel.style.display = 'block';
      } else {
        if (bcaPanel) bcaPanel.style.display = 'none';
      }
    });
  });

  // Salin Nomor Rekening BCA
  const btnCopyRek = document.getElementById('btn-copy-rek');
  if (btnCopyRek) {
    btnCopyRek.addEventListener('click', () => {
      navigator.clipboard.writeText('5390903440')
        .then(() => {
          btnCopyRek.classList.add('copied');
          btnCopyRek.innerHTML = '<i class="fa-solid fa-check"></i> Tersalin!';
          showToast('Nomor Rekening Disalin', '5390903440 (BCA a/n Sugata Joeng) disalin ke clipboard.', 'success');
          setTimeout(() => {
            btnCopyRek.classList.remove('copied');
            btnCopyRek.innerHTML = '<i class="fa-solid fa-copy"></i> Salin';
          }, 2500);
        })
        .catch(() => {
          showToast('Salin Manual', 'No. Rekening BCA: 5390903440 a/n Sugata Joeng', 'info');
        });
    });
  }

  // Upload & Kompresi Foto Bukti Transfer
  const inputProof = document.getElementById('input-payment-proof');
  const dropArea = document.getElementById('proof-drop-area');
  const btnReupload = document.getElementById('btn-reupload');
  const placeholder = document.getElementById('drop-area-placeholder');
  const previewWrap = document.getElementById('drop-area-preview');
  const previewImg = document.getElementById('payment-proof-preview-img');

  if (dropArea && inputProof) {
    dropArea.addEventListener('click', (e) => {
      if (e.target.closest('#btn-reupload')) return;
      inputProof.click();
    });

    if (btnReupload) {
      btnReupload.addEventListener('click', (e) => {
        e.stopPropagation();
        inputProof.click();
      });
    }

    inputProof.addEventListener('change', () => {
      const file = inputProof.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('Format Salah', 'Mohon unggah file berupa foto atau gambar (JPG, PNG, WEBP).', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 900;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          uploadedProofBase64 = canvas.toDataURL('image/jpeg', 0.75);

          if (previewImg) previewImg.src = uploadedProofBase64;
          if (placeholder) placeholder.style.display = 'none';
          if (previewWrap) previewWrap.style.display = 'block';
          if (dropArea) dropArea.classList.remove('has-error');
          showToast('Foto Terpasang', 'Bukti pembayaran transfer BCA berhasil diunggah.', 'success');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Listener tombol kirim WA
  const btnConfirmWA = document.getElementById('btn-confirm-wa');
  if (!btnConfirmWA) return;

  btnConfirmWA.addEventListener('click', () => {
    const selectedPayMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'Cash';

    // VALIDASI WAJIB BUKTI TF JIKA BCA
    if (selectedPayMethod === 'BCA' && !uploadedProofBase64) {
      showToast('Bukti Transfer Wajib', 'Silakan upload bukti pembayaran transfer BCA Anda terlebih dahulu sebelum lanjut ke WhatsApp!', 'error');
      if (dropArea) {
        dropArea.classList.add('has-error');
        dropArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    btnConfirmWA.disabled = true;
    btnConfirmWA.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membuka WhatsApp...';

    const timestamp = order.id || Date.now();
    const finalOrder = {
      id: timestamp,
      name: order.name,
      role: order.role,
      classRoom: order.classRoom || '-',
      mix: order.mix || 0,
      original: originalQty,
      cheese: cheeseQty,
      bumbu: order.bumbu || 'Digabung',
      addonSambal: Boolean(order.addonSambal),
      paymentMethod: selectedPayMethod,
      paymentProof: selectedPayMethod === 'BCA' ? uploadedProofBase64 : null,
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

    showToast('Wajib Kirim Chat di WA!', 'Membuka WhatsApp... Pastikan Anda menekan tombol KIRIM (Send) di WA agar pesanan resmi diproses!', 'success');

    // Setelah WA terbuka, redirect ke halaman utama setelah jeda singkat
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1200);
  });
}

