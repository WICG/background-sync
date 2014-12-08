<h2>Background Synchronization Explained</h2>

## What's All This About?

Modern web applications often find themselves in need of the ability to synchronize data with the server. This need is exacerbated by new [offline capabilities](https://github.com/slightlyoff/ServiceWorker) that enable applications to run while disconnected entirely from the server.

Consider the case of a news site. Wouldn't it be great if the latest articles loaded overnight so that they were already available when you stepped on the morning train (which has terrible connectivity)? The web currently lacks the ability to provide this sort of functionality in a power-efficient or consistent way. Current approaches require an application (or tab) to be running and rely on slow, battery-intensive pings. Modern web sites need to be able to synchronize data in the background, even when the tab, or even the browser, is closed.

We propose a new API which extends [Service Workers](https://github.com/slightlyoff/ServiceWorker) with a new `onsync` event. This is coupled with a new document-side API for registering (and unregistering) interest in `onsync`. Together, these APIs form the basis of a powerful new capability for rich web apps.

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
        navigator.sync.register(
          "string id of sync action",
          {
            minInterval: 86400 * 1000,       // ms, default: heuristic
            repeating: true,                 // default: false
            data: '',                        // default: empty string
            description: '',                 // default: empty string
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
* `minInterval`: A suggestion of the minimum time before the first sync event is fired and between subsequent events. If not provided the UA will heuristically determine an interval.  This value is a suggestion, the UA may fire before or after this point.
* `repeating`: If true the event will continue to fire until unregisterSync is called.  Otherwise the event is fired once.
* `data`: Any additional data that may be needed by the event.  The size of the data may be limited by the UA.
* `description`: A description string justifying the need of the sync event to be presented to the user if permissions to use background sync is required by the UA.
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
    navigator.sync.unregister(event.id);
  }
};
```

If a sync event fails (the event.waitUntil rejects or the browser crashes) then the UA will reschedule the event to fire again in the future. The UA may apply a backoff algorithm to prevent failing events from running too frequently.

## Removing Sync Events

```js
navigator.sync.unregister("string id of sync action to remove");
```

Available both in window and serviceworker.

## Looking up Sync Events

```js
// doc.html
navigator.sync.registrations().then(function(ids) {
  for(id in ids)
    navigator.sync.unregister(id);
});
```


## Notes

  * Since Service Workers are a requirement for Background Synchronization, and since Service Workers are limited to HTTPS origins, sites served without encryption will always fail to register for synchronization.
  * Background Synchronization is not likely to be available to all web applications, not even all apps served over SSL. Browsers may choose to limit the set of applications which can register for synchronization based on quality signals that aren't a part of the visible API.
  * `onsync` event handlers aren't allowed to run forever. Service workers may cap the total runtime of handlers, so it pays to try to batch work and count on needing to resume from failure. Also, test.
