<h2>Background Synchronization Explained</h2>

## What's All This About?

Modern web applications with heavy client-side logic often find themselves in need of the ability to synchronize data with the server. This need is exascerbated by new [offline capabilities](https://github.com/slightlyoff/ServiceWorker) that enable applications to run while disconnected entirely from the server.

Consider the case of a Twitter application. Who can say when 140 characters of genius will strike? In that moment it's _clearly_ preferable for a Twitter client to provide a "send later" button in cases where sending doesn't initially succeed (e.g., while offline). Similar work-saving is natural in document editing applications and event in consumption, e.g.,Kindle applications synchronizing on furthest-read page.

The web currently lacks any ability to provide this sort of functionality in a power-efficient way. Current approaches require an application (or tab) to be running and rely on slow, battery-intensive pings.

Native application platforms do not suffer these indignities, instead providing [APIs that enable developers to collaborate with the system to ensure low power usage and background-driven processing](http://developer.android.com/reference/android/app/AlarmManager.html#setInexactRepeating(int, long, long, android.app.PendingIntent)).

We propose a new API which extends [Service Workers](https://github.com/slightlyoff/ServiceWorker) with the ability to handle synchronization requests. This is coupled with a new document-side API for requesting (and canceling) synchronization. Together, these APIs form the basis of a powerful new capability for rich web apps.

## Requesting A Synchronization Opportunity

```html
<!DOCTYPE html>
<!-- https://tweet.example.com/index.html -->
<html>
  <head>
    <script>
      navigator.serviceWorker.register("/sw.js");

      navigator.serviceWorker.whenReady().then(function(sw) {
        navigator.requestSync(
          "string id of sync action",
          {
            description: '',                // default: empty string
            data: '',                       // default: empty string
            interval: 1000 * 60 * 60 * 24,  // ms, default: heuristic
            repeating: true,                // default: true
            urgent: false,                  // default: false
            lang: '',                       // default: document lang
            dir: ''                         // default: document dir
          }
        ).then(function() {
          // No resolved value
          // Success, sync is now registered
        }, function() {
          // If no SW registration
          // User/UA denied permission
          // If once is true and interval is set
        });
      });
    </script>
  </head>
  <body> ... </body>
</html>
```

The 'interval' is merely a suggestion of how often relevant content will be ready for synchronizing.  The UA makes no guarantee as to when the sync event may be called.  If an event is non-'repeating', then 'interval' is meant to suggest when the sync event should run.  'urgent' requests are higher priority than non-urgent requests.  Use an 'urgent' request to send an email or tweet, while non-urgent requests are useful for occassional synchronization.  Because 'urgent' requests might be less resource-friendly, they cannot be 'repeating'.

## Handling Synchronization Events

```js
// sw.js
self.onsync = function(event) {
  var data = JSON.parse(event.data);

  if (event.id === "string id of sync action") {
    if (data.whatever === 'foo') {
      // rejection is indication that the UA should try
      // later (especially when network is ok)
      event.waitUntil(doAsyncStuff());
    }
  } else {
    // Garbage collect unknown syncs (perhaps from older pages).
    navigator.unregisterSync(event.id);
  }
};
```

## Notes
  * Since Service Workers are a requirement for Background Synchronization, and since Service Workers are limited to HTTPS origins, sites served without encryption will always fail to register for synchronization.
  * Background Synchronization is not likely to be available to all web applications, not even all apps served over SSL. Browsers may chose to limit the set of applications which can register for synchronization based on quality signals that aren't a part of the visible API.
  * `onsync` event handlers aren't allowed to run forever. Service workers cap the total runtime of handlers, so it pays to try to batch work and count on needing to resume from failure. Also, test.
