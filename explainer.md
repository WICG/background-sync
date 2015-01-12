<h2>Background Synchronization Explained</h2>

Modern web applications with heavy client-side logic often need to synchronize data with a server. This need is exacerbated by new [offline capabilities](https://github.com/slightlyoff/ServiceWorker) that enable applications to run while disconnected entirely from the server.

Consider the case of a Twitter application. Who can say when 140 characters of genius will strike? In that moment it's _clearly_ preferable for a Twitter client to provide a "send later" button in cases where sending doesn't initially succeed (e.g., while offline). Similar work-saving is natural in document editing applications and even in consumption, e.g., Kindle applications synchronizing on furthest-read page.

Periodic content updates are also important to improve performance and responsiveness of a web app. Consider a news site that wants to sync the latest articles at night while it's charging so that they're ready for the reader in the morning for use offline.

The web currently lacks any ability to provide this sort of functionality in a user-friendly or power-efficient way. Current approaches require an application (or tab) to be running and rely on slow, battery-intensive pings.

Native application platforms provide  [sync](https://developer.android.com/training/sync-adapters/running-sync-adapter.html) APIs that enable developers to collaborate with the system to ensure low power usage and background-driven processing. The web platform needs capabilities like this too.

We propose a new API that extends [Service Workers](https://github.com/slightlyoff/ServiceWorker) with a new `onsync` event and a new API for registering (and unregistering) interest in `onsync`. Together, these APIs form the basis of a powerful new capability for rich web apps.

## Use Cases

There are two general use cases that the `onsync` event is designed to address:

1. Notification when next online to upload new content (email, docs, tweets, saved state)
2. Periodic synchronization opportunities (static resources, content updates, logging)

In both cases the event will fire _even if the browser is currently closed_, though it may be delayed, see the description of the register function below.

For specific use case examples, see the [use cases document](https://slightlyoff.github.io/BackgroundSync/use_cases.html).

## What Background Sync is not
Background Sync is specifically not an exact alarm API. The scheduling granularity is in milliseconds but events may be delayed from firing for several hours if the device is resource constrained (e.g., low on battery). To run background events events at exact times, consider using the [Push API](https://w3c.github.io/push-api/).

BackgroundSync also is not purposefully intended as a means to synchronize large files in the background (e.g., media), though it may be possible to use it to do so.

## Requesting A Synchronization Opportunity

```html
<!DOCTYPE html>
<!-- https://tweet.example.com/index.html -->
<html>
  <head>
    <script>
      navigator.serviceWorker.register("/sw.js");

      // Registering for sync will fail unless a viable SW is available, so wait
      // for that to happen.
      navigator.serviceWorker.ready.then(function(sw) {
        // Returns a Promise
        sw.syncManager.register(
          "string id of sync action",
          {
            minDelayMs: 0,                            // default: 0
            maxDelayMs: 0,                            // default: 0
            minPeriodMs: 12 * 60 * 60 * 1000,         // default: 0
            minRequiredNetwork: "network_not_mobile"  // default: "network_any"
            chargingRequired: true                    // default: false
            idleRequired: false                       // default: false
            data: '',                                 // default: empty string
            description: '',                          // default: empty string
            lang: '',                                 // default: document lang
            dir: ''                                   // default: document dir
          })
        .then(function() { // Success 
               },
               function() { // Failure
                 // If no SW registration
                 // User/UA denied permission
                 // Sync id already registered
               });
      });
    </script>
  </head>
  <body> ... </body>
</html>
```
* `register` registers sync events for whichever SW matches the current document, even if it's not yet active.
* `id`: The name given to the sync request.  This name is required to later unregister the request.  A new request will override an old request with the same id.
* `minDelayMs`: The suggested number of milliseconds to wait before triggering the first sync event. This may be delayed further (for coalescing purposes or to reserve resources) by a UA-determined amount of time. Subsequent intervals will be based from the requested initial trigger time.
* `maxDelayMs`: The suggested maximum number of milliseconds to wait before firing the event. Typically, the event will be fired by this deadline even if the other conditions are not met. In some resource constrained settings the maxDelayMs may be delayed further. Does not apply to periodic events. The default value is 0, which means no max.
* `minPeriodMs`: A suggestion of the minimum time between sync events. A value of 0 (the default) means the event does not repeat. This value is a suggestion and may be delayed for a UA-specific period of time in resource constrained environments (e.g., when on battery). 
* `minRequiredNetwork`: One of "network_none", "network_any", or "network_not_mobile". "network_none" means there is no restriction on the network status, no connection is necessary. "network_any" means that any network connection will do, as long as there is something. And "network_not_mobile" means any network type that's not a mobile network, such as 2G, 3G, or 4G. The default value is "network_any".
* `chargingRequired`: True if the device must be on AC power when the event is fired.
* `idleRequired`: True if the device must be in an idle state (UA determined) when the event is fired.
* `data`: Any additional data that may be needed by the event.  The size of the data may be limited by the UA.
* `description`: A description string justifying the need of the sync event to be presented to the user if permissions to use background sync is required by the UA.
* `lang`: The language used in the description string.
* `dir`: The direction of text for displaying the description string.

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
    syncManager.unregister(event.id);
  }
};
```
The `waitUntil` is a signal to the UA that the sync event is ongoing and the rejection of the event signals to the UA that the sync failed. Whether or not the UA reschedules the sync is out of scope of the spec.

## Removing Sync Events

### From a Window
```js
ServiceWorkerRegistration.syncManager.unregister("string id of sync action to remove");
```

### From a ServiceWorker
```js
syncManager.unregister("string id of sync action to remove");
```

## Looking up Sync Events

```js
// doc.html
ServiceWorkerRegistration.syncManager.getRegistrations().then(function(ids) {
  for(id in ids)
    ServiceWorkerRegistration.syncManager.unregister(id);
});
```


## Notes

  * Since Service Workers are a requirement for Background Synchronization, and since Service Workers are limited to HTTPS origins, sites served without encryption will always fail to register for synchronization.
  * Background Synchronization is not likely to be available to all web applications, not even all apps served over SSL. Browsers may choose to limit the set of applications which can register for synchronization based on quality signals that aren't a part of the visible API.
  * `onsync` event handlers aren't allowed to run forever. Service workers may cap the total runtime of handlers, so it pays to try to batch work and count on needing to resume from failure. Also, test.
