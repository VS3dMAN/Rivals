/* eslint-disable no-undef */
// Firebase Cloud Messaging service worker.
//
// At deploy time the build pipeline writes `/firebase-config.js` from the
// EXPO_PUBLIC_FIREBASE_* env vars; that file exposes self.__FIREBASE_CONFIG__
// which we read below. If the file is missing the worker no-ops gracefully so
// the rest of the web app keeps working.

importScripts('/firebase-config.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

if (self.__FIREBASE_CONFIG__ && self.__FIREBASE_CONFIG__.apiKey) {
  firebase.initializeApp(self.__FIREBASE_CONFIG__);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {};
    self.registration.showNotification(title || 'Rivals', {
      body: body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data,
    });
  });
} else {
  console.warn('[fcm-sw] no Firebase config — web push disabled');
}
