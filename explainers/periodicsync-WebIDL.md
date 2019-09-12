# Proposed WebIDL

## Definition of the interface
```webidl
partial interface ServiceWorkerRegistration {
  readonly attribute PeriodicSyncManager periodicSync;
};

[SecureContext, Exposed=(Window,Worker)]
interface PeriodicSyncManager {
  Promise<void> register(DOMString tag, BackgroundSyncOptions options);
  Promise<void> unregister(DOMString tag);
  Promise<sequence<DOMString>> getTags();
};
```

## Definition of the Service Worker event
```webidl
partial interface ServiceWorkerGlobalScope {
  attribute EventHandler onperiodicsync;
};

[Constructor(DOMString type, PeriodicSyncEventInit init), Exposed=ServiceWorker]
interface SyncEvent : ExtendableEvent {
  readonly attribute DOMString tag;
};

dictionary PeriodicSyncEventInit : ExtendableEventInit {
  required DOMString tag;
};
```

## Extensions to the Background Sync API
```webidl
dictionary BackgroundSyncOptions {
  // …existing properties…
  unsigned long long minInterval;
};
```

## Extensions to the Permissions API
```webidl
enum PermissionsName {
  // …existing permissions…
  "periodic-background-sync",
}
```
