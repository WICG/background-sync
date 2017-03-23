self.addEventListener('sync', function(sync_event) {
  var responseData;
  fetch(new Request("/BackgroundSync/demo/sample.json", {cache: "no-store"}))
  .then(response => {
    if (response.status == 200) {
      return response.text();
    } else {
      throw new Error("" + response.status + " " + response.statusText);
    }
  })
  .then(responseText => {
      responseData = JSON.parse(responseText);
      return openBgSyncDB();
  })
  .then(db => updateSyncTime(db, "one-shot", +new Date()))
  .then(syncCount => {
    self.registration.showNotification("Sync fired! (" +syncCount +
        ") Fetched list v" + responseData.list_version);
  })
  .catch(err => {
    self.registration.showNotification("Sync fired! There was an error.");
    self.registration.showNotification(err.message);
    postErrorToClients(err);
  });
});

function openBgSyncDB() {
  return new Promise((resolve, reject) => {
    var open_request = indexedDB.open("BgSyncDemoDB", 1);
    open_request.onerror = function(event) {
       reject(new Error("Error opening database."));
    };
    open_request.onsuccess = function(event) {
        resolve(event.target.result);
    };
    open_request.onupgradeneeded = function(event) {
      var db = event.target.result;
      db.createObjectStore("syncs", { keyPath: "type" });
    };
  })
}

function updateSyncTime(db, syncType, syncTime) {
  return new Promise((resolve, reject) => {
    var store = db.transaction(["syncs"], "readwrite").objectStore("syncs");
    var get_request = store.get(syncType);

    get_request.onerror = function(event) {
      reject(new Error("Error getting value from database."));
    }

    get_request.onsuccess = function(event) {
      var data = get_request.result || { type: syncType };
      data.time = syncTime;
      data.syncCount = (data.syncCount || 0) + 1;
      var put_request = store.put(data);

      put_request.onerror = function(event) {
        reject(new Error("Error saving value to database."));
      }

      put_request.onsuccess = function(event) {
        resolve(data.syncCount);
      };
    };
  });
}

function postErrorToClients(err) {
  clients.matchAll({includeUncontrolled: true})
  .then(clientList => {
     clientList.forEach(client => client.postMessage(err.message));
  });
}
