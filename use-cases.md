# BackgroundSync use-cases

## One-off sync

### Use-cases

* **Code sharing site** - retry sending a new document or change to an existing document to the server
* **Document authoring sites** - retry sending a new document or change to an existing document to the server. Show notification if save fails due to merge conflict.
* **Social media site** - retry sending various interactions in the order they were commited

The above are from actual customers, but not naming names until they agree to being in a public document.

### Requirements

* Don’t sync until the user has connectivity - we don’t have any use-cases that don’t require connectivity. “connectivity” is our best guess of course.
* If sync fails, reschedule it - `event.waitUntil` can be used to extend lifetime and indicate failure. We’ll want some kind of back-off for reschedules.
* Multiple sync requests for the same name are coalesced into one sync event in the SW - allows multiple independent systems to add to an idb “outbox” and request an an outbox sync.

# Concerns

* **Location tracking** - an interval sync or failing one-off sync could lead to user tracking via IP
* **Deliberate battery usage** - background sync could be used by evil sites for battery intensive work. Bitcoin mining, DDOS attacks etc
* **Accidental battery usage** - exact alarms cannot be coalesced
