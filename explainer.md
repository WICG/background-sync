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

      // Requesting to sync will fail unless a viable SW is available, so wait
      // for that to happen.
      navigator.serviceWorker.whenReady().then(function(sw) {
        // Returns a Promise
        navigator.requestSync(
          "string id of sync action",
          {
            description: '',                 // default: empty string
            data: '',                        // default: empty string
            suggestedInterval: 86400 * 1000, // ms, default: heuristic
            repeating: true,                 // default: true
            urgent: false,                   // default: false
            lang: '',                        // default: document lang
            dir: ''                          // default: document dir
          }
        ).then(function() { // Success
                 // No resolved value
                 // Success, sync is now registered
               },
               function() { // Failure
                 // If no SW registration
                 // User/UA denied permission
                 // If repeating is false and suggestedInterval is set
               });
      });
    </script>
  </head>
  <body> ... </body>
</html>
```
* `id`: The name given to the sync request.  This name is required to later unregister the request.  A new request will override an old request with the same id.
* `description`: A description string justifying the need of the sync event to be presented to the user if permissions to use background sync is required by the UA.
* `data`: Any additional data that may be needed by the event.  The size of the data may be limited by the UA.
* `suggestedInterval`: A suggestion of the interval between sync events.  The UA makes no guarantee as to when the event will be fired, but takes note of the suggested interval.  If `repeating` is false then the value should represent the suggested time delta before the event should fire.
* `repeating`: If true the event will continue to fire until unregisterSync is called, otherwise it is only fired once.
* `urgent`: 
* `lang`:
* `dir`:

## Handling Synchronization Events

Synchronization happens from the Service Worker context via the new `sync` event. It is passed the `data` string and the id from the invoking request.

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
