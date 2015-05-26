# Proposed IDL

```js
partial interface ServiceWorkerRegistration {
  readonly attribute SyncManager sync;
  readonly attribute PeriodicSyncManager periodicSync;
};

interface SyncManager {
  Promise<SyncRegistration> register(optional SyncRegistrationOptions options);
  Promise<SyncRegistration> getRegistration(DOMString tag);
  Promise<sequence<SyncRegistration>> getRegistrations();
  Promise<SyncPermissionState> permissionState();
};

interface SyncRegistration {
  readonly attribute DOMString tag;

  Promise<boolean> unregister();
};

dictionary SyncRegistrationOptions {
  DOMString tag = "";
};

enum SyncPermissionState {
  "granted",
  "denied",
  "prompt"
};

enum SyncNetworkState {
  "any",
  "avoid-cellular",
  "online"
};

enum SyncPowerState {
  "auto",
  "avoid-draining"
};

interface PeriodicSyncManager {
  Promise<PeriodicSyncRegistration> register(optional PeriodicSyncRegistrationOptions options);
  Promise<PeriodicSyncRegistration> getRegistration(DOMString tag);
  Promise<sequence<PeriodicSyncRegistration>> getRegistrations();
  Promise<SyncPermissionState> permissionState();

  readonly attribute unsigned long minPossiblePeriod;
};

interface PeriodicSyncRegistration {
  readonly attribute DOMString tag;
  readonly attribute unsigned long minPeriod;
  readonly attribute SyncNetworkState networkState;
  readonly attribute SyncPowerState powerState;

  Promise<boolean> unregister();
};

dictionary PeriodicSyncRegistrationOptions {
  DOMString tag = "";
  unsigned long minPeriod = 0;
  SyncNetworkType networkState = "online";
  SyncPowerState powerState = "auto";
};

partial interface ServiceWorkerGlobalScope {
  attribute EventHandler onsync;
  attribute EventHandler onperiodicsync;
};

[Constructor(DOMString type, SyncEventInit eventInitDict), Exposed=ServiceWorker]
interface SyncEvent : ExtendableEvent {
  readonly attribute SyncRegistration registration;
};

dictionary SyncEventInit : EventInit {
  required SyncRegistration registration;
};

[Constructor(DOMString type, PeriodicSyncEventInit eventInitDict), Exposed=ServiceWorker]
interface PeriodicSyncEvent : ExtendableEvent {
  readonly attribute PeriodicSyncRegistration registration;
};

dictionary PeriodicSyncEventInit : EventInit {
  required PeriodicSyncRegistration registration;
};
```
