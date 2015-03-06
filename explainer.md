<h2>Background Synchronization Explained</h2>

Modern web applications with heavy client-side logic often need to synchronize data with a server. This need is exacerbated by new offline capabilities via [Service Workers](https://github.com/slightlyoff/ServiceWorker) that enable applications to run while disconnected entirely from the server.

Consider the case of a Twitter application. Who can say when 140 characters of genius will strike? In that moment it's _clearly_ preferable for a Twitter client to provide a "send later" button in cases where sending doesn't initially succeed (e.g., while offline). Similar work-saving is natural in document editing applications and even in consumption, e.g., Kindle applications synchronizing on furthest-read page.

Periodic content updates are also important to improve performance and responsiveness of a web app. Consider a news site that wants to sync the latest articles at night while it's charging so that they're ready for the reader in the morning for use offline.

The web currently lacks any ability to provide this sort of functionality in a user-friendly or power-efficient way. Current approaches require an application (or tab) to be running and rely on slow, battery-intensive pings.

Native application platforms provide [job scheduling](https://developer.android.com/reference/android/app/job/JobScheduler.html) APIs that enable developers to collaborate with the system to ensure low power usage and background-driven processing. The web platform needs capabilities like this too.

We propose a new API that extends [Service Workers](https://github.com/slightlyoff/ServiceWorker) with a new `onsync` event and a new API for registering (and unregistering) interest in `onsync`. Together, these APIs form the basis of a powerful new capability for rich web apps.

## Use Cases

There are two general use cases that the `onsync` event is designed to address:

1. Notification when next online to upload new content (email, docs, tweets, saved state)
2. Periodic synchronization opportunities (static resources, content updates (e.g., docs, articles email), logging)

In both cases the event will fire _even if the browser is currently closed_, though it may be delayed, see the description of the register function below.

For specific use case examples, see the [use cases document](https://slightlyoff.github.io/BackgroundSync/use_cases.html).

## What Background Sync is not

Background Sync is specifically not an exact alarm API. The scheduling granularity is in milliseconds but events may be delayed from firing for several hours if the device is resource constrained (e.g., low on battery). Similarly, the user agent may ignore pending synchronization requests to accommodate for user expected behaviors on a given platform (e.g. Android's power saving mode does not allow background sync). To run background events at exact times, consider using the [Push API](https://w3c.github.io/push-api/).

BackgroundSync also is not purposefully intended as a means to synchronize large files in the background (e.g., media), though it may be possible to use it to do so.

## IDL

```javascript
partial interface ServiceWorkerRegistration {
  readonly attribute SyncManager syncManager;
};

interface SyncManager {
  Promise<SyncRegistration> register(optional SyncRegistrationOptions options);
  Promise<SyncRegistration> getRegistration(DOMString id);
  Promise<sequence<SyncRegistration>> getRegistrations();
  Promise<SyncPermissionStatus> hasPermission();
  readonly attribute unsigned long minAllowablePeriod;
};

interface SyncRegistration {
  readonly attribute DOMString id;
  readonly attribute unsigned long minDelay;
  readonly attribute unsigned long maxDelay;
  readonly attribute unsigned long minPeriod;
  readonly attribute SyncNetworkType minRequiredNetwork;
  readonly attribute boolean allowOnBattery;
  readonly attribute boolean idleRequired;

  Promise <boolean> unregister();
};

dictionary SyncRegistrationOptions {
  DOMString id = "";
  unsigned long minDelay = 0;
  unsigned long maxDelay = 0;
  unsigned long minPeriod = 0;
  SyncNetworkType minRequiredNetwork = "network-online";
  boolean allowOnBattery = true;
  boolean idleRequired = false;
};

enum SyncNetworkType {
  "network-any",
  "network-offline",
  "network-online",
  "network-non-mobile",
};

enum SyncPermissionStatus {
  "default",
  "denied",
  "granted"
};

partial interface ServiceWorkerGlobalScope {
  attribute EventHandler onsync;
};

dictionary SyncEventInit : EventInit {
  required SyncRegistration registration; // this is mostly a no-op for now
};

[Constructor(DOMString type, SyncEventInit eventInitDict), Exposed=ServiceWorker]
interface SyncEvent : ExtendableEvent {
  readonly attribute SyncRegistration registration;
};
```

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
      navigator.serviceWorker.ready.then(function(swRegistration) {
        // Returns a Promise
        swRegistration.syncManager.register({
          id: "periodicSync",                       // default: empty string
          minDelay: 60 * 60 * 1000,                 // default: 0
          maxDelay: 0,                              // default: 0
          minPeriod: 12 * 60 * 60 * 1000,           // default: 0
          minRequiredNetwork: "network-non-mobile"  // default: "network-online"
          allowOnBattery: true                      // default: true
          idleRequired: false                       // default: false
        }).then(function() {
          // Success
        }, function() {
          // Failure
          // User/UA denied permission
        });
      });
    </script>
  </head>
  <body> ... </body>
</html>
```

* `register`: registers sync events for whichever SW matches the current document, even if it's not yet active.
* `id`: Useful for recognizing distinct synchronization events. If the id is already registered, the old registration is replaced by the new one.
* `minDelay`: The suggested number of milliseconds to wait before triggering the first sync event. This may be delayed further (for coalescing purposes or to reserve resources) by a UA-determined amount of time. Subsequent intervals will be based from the requested initial trigger time.
* `maxDelay`: The suggested maximum number of milliseconds to wait before firing the event even if the conditions aren't met. In some resource constrained settings the maxDelayMs may be delayed further. Does not apply to periodic events. The default value is 0, which means no max.
* `minPeriod`: A suggestion of the minimum time between sync events. A value of 0 (the default) means the event does not repeat. This value is a suggestion and may be delayed for a UA-specific period of time in resource constrained environments (e.g., when on battery). If the value is less than SyncManager.minAllowablePeriod (which is UA and platform dependent) then the promise will reject. Periodic sync registrations will repeat until the UA determines that they shouldn't anymore (e.g., the user doesn't visit the site frequently enough to merit the periodic sync). Because of this unpredictability, put critical functionality into non-periodic syncs or use push messaging.
* `minRequiredNetwork`: One of "network-any", "network-offline", "network-online", and  or "network-non-mobile".
* `allowOnBattery`: False if the device must be on AC power when the event is fired.
* `idleRequired`: True if the device must be in an idle state (UA determined) when the event is fired.

## Handling Synchronization Events

Synchronization happens from the Service Worker context via the new `sync` event. It is passed the id from the invoking request.

```js
// sw.js
self.onsync = function(event) {

  if (event.registration.id === "periodicSync") {
    event.waitUntil(doAsyncStuffWithIndexedDBData());
  } else {
    // Delete unknown syncs (perhaps from older pages).
    event.registration.unregister();
  }
};
```

The `waitUntil` is a signal to the UA that the sync event is ongoing and that it should keep the SW alive if possible. Rejection of the event signals to the UA that the sync failed. Upon rejection the UA should reschedule (likely with a UA-determined backoff).

## Removing Sync Events

If the id is not registered the function will reject.

```js
swRegistration.syncManager.getRegistrations().then((regs) => {
  for(reg in regs) {
    if(reg.id == "string id of sync action to remove")
      reg.unregister()
  }
})
```

## Looking up Sync Events

```js
// Returned in order of registration.
swRegistration.syncManager.getRegistrations().then((regs) => {
  for(reg in regs) {
    reg.unregister();
  }
});
```

```js
swRegistration.syncManager.getRegistration('weeklySync').then((reg) => {
  reg.unregister();
});
```

## Checking for Permission

If the origin doesn't have permission to use background sync then registration will fail. A prompt for permission can only occur from the page and not the service worker (which runs in the background). So call registration from the page first to invoke the permission request before using it in the service worker.

```js
swRegistration.syncManager.hasPermission().then((status) => {
  alert("Permission status: " + status);
});
```

## Notes

* Since Service Workers are a requirement for Background Synchronization, and since Service Workers are limited to HTTPS origins, sites served without encryption will always fail to register for synchronization.
* All fetches during onsync events must be HTTPS. HTTP fetches will be rejected.
* Background Synchronization is not likely to be available to all web applications, not even all apps served over SSL. Browsers may choose to limit the set of applications which can register for synchronization based on quality signals that aren't a part of the visible API.
* `onsync` event handlers aren't allowed to run forever. Service workers may cap the total runtime of handlers, so it pays to try to batch work and count on needing to resume from failure. Also, test.
