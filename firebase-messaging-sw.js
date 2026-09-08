importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAqfCDGF1dk8ydP_KnJUI2h6locu3LCUDk',
  authDomain: 'tesbatagor-rin.firebaseapp.com',
  projectId: 'tesbatagor-rin',
  storageBucket: 'tesbatagor-rin.firebasestorage.app',
  messagingSenderId: '988973820460',
  appId: '1:988973820460:web:92b62f0697525dd9e8bf89'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'Order Baru Masuk';
  const options = {
    body: payload.notification?.body || 'Ada pesanan baru di dashboard.',
    icon: '/img/batagor_cheese.png',
    tag: payload.data?.orderId || 'batagor-order'
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/admin/admin.html'));
});