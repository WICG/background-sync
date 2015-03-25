## Proposed IDL
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
