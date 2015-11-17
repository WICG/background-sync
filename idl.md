# Proposed IDL

```js
partial interface ServiceWorkerRegistration {
  readonly attribute SyncManager sync;
};

interface SyncManager {
  Promise<SyncRegistration> register(optional SyncRegistrationOptions options);
  Promise<SyncRegistration> getRegistration(DOMString tag);
  Promise<sequence<SyncRegistration>> getRegistrations();
  Promise<SyncPermissionState> permissionState();
};

interface SyncRegistration {
  readonly attribute DOMString tag;
  readonly attribute Promise<boolean> done;

  Promise<boolean> unregister();
};

dictionary SyncRegistrationOptions {
  DOMString tag = "";
};

enum SyncPermissionState {
  "default",
  "denied",
  "granted"
};

partial interface ServiceWorkerGlobalScope {
  attribute EventHandler onsync;
};

[Constructor(DOMString type, SyncEventInit eventInitDict), Exposed=ServiceWorker]
interface SyncEvent : ExtendableEvent {
  readonly attribute SyncRegistration registration;
};

dictionary SyncEventInit : EventInit {
  required SyncRegistration registration;
};
```
