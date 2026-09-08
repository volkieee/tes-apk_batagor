const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

if (getApps().length === 0) initializeApp();

const db = getFirestore();

exports.sendNewOrderNotification = onDocumentCreated('orders/{orderId}', async event => {
  const order = event.data?.data();
  if (!order) return;

  const deviceSnapshot = await db.collection('adminDevices').get();
  const tokens = deviceSnapshot.docs
    .map(device => device.data().token)
    .filter(Boolean);

  if (tokens.length === 0) return;

  const itemCount = Number(order.cheese || 0) + Number(order.mercon || 0);
  const total = Number(order.total || 0).toLocaleString('id-ID');

  const message = {
    tokens: tokens.slice(0, 500),
    notification: {
      title: 'Order Baru Masuk - Batagor',
      body: `${order.name || 'Pelanggan'} memesan ${itemCount} porsi - Rp ${total}`
    },
    data: {
      orderId: String(event.params.orderId),
      url: '/admin/admin.html'
    },
    webpush: {
      fcmOptions: { link: '/admin/admin.html' }
    }
  };

  const response = await getMessaging().sendEachForMulticast(message);
  console.log(`Sent ${response.successCount} order notifications; ${response.failureCount} failed.`);
});