# Background synchronization explained

This is a specification that brings background synchronization to the web, in the form of a [Service Worker](https://github.com/slightlyoff/ServiceWorker) event.

If you write an email, instant message, or simply favourite a tweet, the application needs to communicate that data to the server. If that fails, either due to user connectivity, service availability, or anything in-between, the app can store that action in some kind of 'outbox' for retry later.

Unfortunately, on the web, that outbox can only be processed while the site is displayed in a browsing context. If the user navigates away, closes the tab, or closes the browser, the outbox can't be synced until the page is visited again. This is particularly problematic on mobile, where browsing contexts are frequently shut down to free memory.

Native application platforms provide [job scheduling](https://developer.android.com/reference/android/app/job/JobScheduler.html) APIs that enable developers to collaborate with the system to ensure low power usage and background-driven processing. The web platform needs capabilities like this too.

We propose a new API that extends [Service Workers](https://github.com/slightlyoff/ServiceWorker) with a `sync` event and an API for signalling the desire for this event to fire.

### The API

**To request a sync:**

```js
navigator.serviceWorker.ready.then(function(registration) {
  registration.sync.register({
    tag: 'outbox' // default: ''
  }).then(function(syncReg) {
    // success
  }, function() {
    // failure
  })
});
```

* `tag`: This operates like a notification's tag. If you register a sync and an existing sync with the same tag is pending, it returns the existing registration.

`navigator.serviceWorker.ready` resolves when the in-scope service worker registration gains an active worker, if you try to register for sync before this, `sync.register` will reject.

The above is how a *page* would register for a one-off sync, although this can also be done within a service worker, as `self.registration` gives access to the service worker registration. Since the registration requires an active worker, this should only be attempted after your service worker has activated. Although you can register for sync from a service worker, if there's no active window open for the origin, registration will fail.

**To respond to a sync:**

Over in the service worker:

```js
self.addEventListener('sync', function(event) {
  if (event.registration.tag == 'outbox') {
    event.waitUntil(sendEverythingInTheOutbox());
  }
});
```

`sync` will fire when the UA believes the user has connectivity.

The promise passed to `waitUntil` is a signal to the UA that the sync event is ongoing and that it should keep the SW alive if possible. Rejection of the event signals to the UA that the sync failed. Upon rejection the UA should reschedule (likely with a UA-determined backoff).

The UA may coalesce synchronizations to reduce the number of times the device, radio and browser need to wake up. The coalescing can be across origins, and even coalesced across the OS with native synchronizations. Although the event timings are coalesced, you still get an event per pending sync registration.

## Getting pending sync details

As seen in the previous code examples, `sync.register()` and `syncEvent.registration` expose a sync registration object. You can also fetch them using `sync.getRegistration`, and `sync.getRegistrations`.

For example, to unregister a single sync:

```js
navigator.serviceWorker.ready.then(function(registration) {
  registration.sync.getRegistration('outbox').then(function(syncReg) {
    syncReg.unregister();
  });
});
```

To unregister all syncs, except "get-latest-news":

```js
navigator.serviceWorker.ready.then(function(registration) {
  registration.sync.getRegistrations().then(function(syncRegs) {
    syncRegs.filter(function(reg) {
      return reg.tag != 'get-latest-news';
    }).forEach(function(reg) {
      reg.unregister();
    });
  });
});
```

## Checking for Permission

```js
navigator.serviceWorker.ready.then(function(registration) {
  registration.sync.permissionState().then(function(state) {
    if (state == 'prompt') showSyncRegisterUI();
  });
});
```

## Notes

* Since Service Workers are a requirement for sync, and since Service Workers are limited to HTTPS origins, that restriction applies here too.
* All fetches during sync events must be HTTPS. HTTP fetches will be rejected.
* Like all ServiceWorker events, 'sync' may be terminated if they're taking an unreasonable amount of time or CPU. This is not a tool for distributed bitcoin mining :)
