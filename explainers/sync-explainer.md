# Background synchronization explained

This is a specification that brings both one-off and periodic synchronization to the web, in the form of [Service Workers](https://github.com/slightlyoff/ServiceWorker) events.

## One-off synchronization

If you write an email, instant message, or simply favorite a tweet, the application needs to communicate that data to the server. If that fails, either due to user connectivity, service availability or anything in-between, the app can store that action in some kind of 'outbox' for retry later.

Unfortunately, on the web, that outbox can only be processed while the site is displayed in a browsing context. This is particularly problematic on mobile, where browsing contexts are frequently shut down to free memory.

Native application platforms provide [job scheduling](https://developer.android.com/reference/android/app/job/JobScheduler.html) APIs that enable developers to collaborate with the system to ensure low power usage and background-driven processing. The web platform needs capabilities like this too.

We propose a new API that extends [Service Workers](https://github.com/slightlyoff/ServiceWorker) with a `sync` event and an API for signalling the desire for this event to fire.

### The API

**To request a sync:**

```js
navigator.serviceWorker.ready.then(function(registration) {
  registration.sync.register('outbox').then(function() {
    // registration succeeded
  }, function() {
    // registration failed
  });
});
```

* The string argument to `register`, tag, operates like a notification's tag. It is passed to the service worker event.

The above is how a main frame *page* would register for a one-off sync, although this can also be done within a service worker, as `self.registration` gives access to the service worker registration. Since the registration requires an active worker, this should only be attempted after your service worker has activated. Although you can register for sync from a service worker, if there's no top-level window open for the origin, registration will fail.

**To respond to a sync:**

Over in the service worker:

```js
self.addEventListener('sync', function(event) {
  if (event.tag == 'outbox') {
    event.waitUntil(sendEverythingInTheOutbox());
  }
});
```

`sync` will fire when the user agent believes the user has connectivity.

The promise passed to `waitUntil` is a signal to the user agent that the sync event is ongoing and that it should keep the service worker alive if possible. Rejection of the event signals to the user agent that the sync failed. Upon rejection the user agent should reschedule (likely with a user agent determined backoff).

The user agent may coalesce synchronizations to reduce the number of times the device, radio and browser need to wake up. The coalescing can be across origins, and even coalesced across the OS with native synchronizations. Although the event timings are coalesced, you still get an event per pending sync registration.

## Periodic synchronization (in design)

Opening a news or social media app to find content you hadn't seen before - without going to the network, is a user experience currently limited to native apps.

[The push API](https://w3c.github.io/push-api/) allows the server to dictate when the service worker should wake up and seek updates, but these are not sensitive to connection and charging state. Also, some sites update too frequently to warrant a push message per update (think Twitter, or a news site).

Periodic syncs are simple to set up, don't require any server configuration, and allow the user agent to optimize when they fire to be most-helpful and least-disruptive to the user. E.g. if the user agent knows the user has a morning alarm set, it may run synchronizations shortly beforehand, giving the user quick and up-to-date information from their favorite sites.

### The API

**To request a periodic sync:**

```js
navigator.serviceWorker.ready.then(function(registration) {
  registration.periodicSync.register({
    tag: 'get-latest-news',         // default: ''
    minPeriod: 12 * 60 * 60 * 1000, // default: 0
    powerState: 'avoid-draining',   // default: 'auto'
    networkState: 'avoid-cellular'  // default: 'online'
  }).then(function(periodicSyncReg) {
    // success
  }, function() {
    // failure
  })
});
```

* `tag`: This operates like a notification's tag. If you register a sync and an existing sync with the same tag is pending, it returns the existing registration and updates it with the options provided. **Note:** one-off and periodic sync tags have separate namespaces.
* `minPeriod`: The minimum time between successful sync events. A value of 0 (the default) means the UI may fire the event as frequently as it wishes. This value is a suggestion to prevent over-syncing. Syncing may be less frequent depending on heuristics such as visit frequency & device status. If timing is critical, [the push API](https://w3c.github.io/push-api/) may better suit your requirements.
* `powerState`: Either "auto" (default) or "avoid-draining". "avoid-draining" will delay syncs on battery-powered devices while that battery isn't charging. "auto" allows syncs to occur during battery-drain, although the user agent may choose to avoid this depending on global device status (such as battery-saving mode) or user preferences.
* `networkState`: One of "online" (default), "avoid-cellular", or "any". "avoid-cellular" will delay syncs if the device is on a [cellular connection](https://w3c.github.io/netinfo/#idl-def-ConnectionType.cellular) - but be aware that some users may never use another connection type. "online" will delay syncs if the device is online, although the user agent may choose to avoid particular connection types depending on global device status (such as roaming) or user preferences. "any" is similar to "online", except syncs may happen while the device is offline.

**To respond to a periodic sync:**

Over in the service worker:

```js
self.addEventListener('periodicsync', function(event) {
  if (event.registration.tag == 'get-latest-news') {
    event.waitUntil(fetchAndCacheLatestNews());
  }
  else {
    // unknown sync, may be old, best to unregister
    event.registration.unregister();
  }
});
```

Like one-off syncs, the promise passed to `waitUntil` is a signal to the user agent that the sync event is ongoing and that it should keep the service worker alive if possible. Rejection of the event signals to the user agent that the sync failed. Upon rejection the user agent should reschedule (likely with a user agent determined backoff). `minPeriod` may be ignored for rescheduling.

Also like one-off syncs, the user agent may coalesce synchronizations to reduce the number of times the device, radio and browser need to wake up. In fact, the coalescing is more extreme for periodic syncs, as the result is perceived to be "beneficial" as opposed to "critical".


### What periodic sync is not

Periodic sync is specifically not an exact alarm API. The scheduling granularity is in milliseconds but events may be delayed from firing for several hours depending on usage frequency and device state (battery, connection, location).

The results of a sync running should be "beneficial" not "critical". If your use-case is critical, one-off syncs or [the push API](https://w3c.github.io/push-api/) may serve your requirements.

## Getting pending sync details

As seen in the previous code examples,  `syncEvent.registration` exposes a sync registration object. You can also fetch them using `periodicSync.getRegistration`, `periodicSync.getRegistrations`.

For example, unregister all periodic syncs, except "get-latest-news":

```js
navigator.serviceWorker.ready.then(function(registration) {
  registration.periodicSync.getRegistrations().then(function(syncRegs) {
    syncRegs.filter(function(reg) {
      return reg.tag != 'get-latest-news';
    }).forEach(function(reg) {
      reg.unregister();
    });
  });
});
```

## Checking for Permission

Permissions for `sync` and `periodicSync` are entirely separate, and `periodicSync` is expected to be more difficult to obtain permission for.

```js
navigator.serviceWorker.ready.then(function(registration) {
  registration.periodicSync.permissionState().then(function(state) {
    if (state == 'prompt') showSyncRegisterUI();
  });
});
```

## Notes

* Since Service Workers are a requirement for sync, and since Service Workers are limited to HTTPS origins, that restriction applies here too.
* All fetches during sync events must be HTTPS. HTTP fetches will be rejected.
* Sync may not be available to all web applications, not even all apps served over SSL. Browsers may choose to limit the set of applications which can register for synchronization based on quality signals that aren't a part of the visible API. This is especially true of periodic sync.
* Like all ServiceWorker events, 'sync' and 'periodicsync' may be terminated if they're taking an unreasonable amount of time or CPU. This is not a tool for distributed bitcoin mining :)
