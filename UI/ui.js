// ==========================================================================
// ADMIN - UI MODULE
// Manages authentication, modals, clock, and notifications.
// ==========================================================================

import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { auth } from '../database/firebase-config.js';

/**
 * Initializes the authentication flow (login/logout).
 */
export function initAdminAuth(onAuthenticated) {
  const loginScreen = document.getElementById('admin-login-screen');
  const dashboardView = document.getElementById('admin-dashboard-view');
  const loginForm = document.getElementById('admin-login-form');
  const passwordInput = document.getElementById('admin-password');
  const btnLogout = document.getElementById('btn-logout');

  onAuthStateChanged(auth, user => {
    const isAuthenticated = Boolean(user);
    loginScreen.style.display = isAuthenticated ? 'none' : 'flex';
    dashboardView.style.display = isAuthenticated ? 'block' : 'none';
    if (isAuthenticated) onAuthenticated();
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const password = passwordInput.value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      passwordInput.value = '';
      showToast('Akses Diterima', 'Selamat datang kembali, Penjual!', 'success');
    } catch (error) {
      showToast('Akses Ditolak', 'PIN / Kata sandi salah!', 'error');
      passwordInput.value = '';
      passwordInput.focus();
    }
  });

  btnLogout.addEventListener('click', async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari panel admin?')) {
      await signOut(auth);
      showToast('Keluar', 'Anda telah log out dari panel penjual.', 'success');
    }
  });
}

/**
 * Initializes the settings modal for the seller's WA number.
 */
export function initModal() {
  const btnSettings = document.getElementById('btn-settings-modal');
  const modal = document.getElementById('settings-modal');
  const btnClose = document.getElementById('btn-close-modal');
  const btnSave = document.getElementById('btn-save-wa');
  const inputWa = document.getElementById('input-wa-number');

  let sellerWANumber = localStorage.getItem('seller_wa_number') || '6285921214331';
  inputWa.value = sellerWANumber;

  const openModal = () => modal.classList.add('active');
  const closeModal = () => modal.classList.remove('active');

  btnSettings.addEventListener('click', openModal);
  btnClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  btnSave.addEventListener('click', () => {
    let rawNumber = inputWa.value.trim().replace(/[^0-9]/g, '');
    if (rawNumber.length < 9) {
      showToast('Nomor Salah', 'Silakan masukkan nomor WhatsApp yang valid.', 'error');
      return;
    }
    if (rawNumber.startsWith('0')) {
      rawNumber = '62' + rawNumber.substring(1);
    } else if (!rawNumber.startsWith('62')) {
      rawNumber = '62' + rawNumber;
    }
    localStorage.setItem('seller_wa_number', rawNumber);
    inputWa.value = rawNumber;
    closeModal();
    showToast('Pengaturan Disimpan', `Nomor WA penerima diubah menjadi ${rawNumber}`, 'success');
  });
}

/**
 * Initializes the live date and time display on the dashboard.
 */
export function initLiveDateTime() {
  const dateTimeElement = document.getElementById('current-datetime');
  if (!dateTimeElement) return;

  function updateTime() {
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const pad = (n) => n.toString().padStart(2, '0');
    const finalString = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    dateTimeElement.textContent = finalString;
  }

  updateTime();
  setInterval(updateTime, 1000);
}

/**
 * Displays a toast notification.
 * @param {string} title The title of the toast.
 * @param {string} desc The description message.
 * @param {'success'|'error'} type The type of toast.
 */
let toastTimeout;
export function showToast(title, desc, type = 'success') {
  const toast = document.getElementById('toast-notif');
  const tIcon = document.getElementById('toast-icon');
  const tTitle = document.getElementById('toast-title');
  const tDesc = document.getElementById('toast-desc');

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