self.addEventListener('sync', function(event) {
  self.registration.showNotification("Sync event fired!");
});