(function () {
  window.addEventListener("error", function (event) {
    var msg = (event && (event.message || (event.error && event.error.message))) || "";
    if (
      msg.indexOf("Unexpected token") === -1 &&
      msg.indexOf("Failed to fetch dynamically imported module") === -1 &&
      msg.indexOf("Loading chunk") === -1 &&
      msg.indexOf("client.navigate") === -1
    ) {
      return;
    }
    try {
      if (sessionStorage.getItem("safari_cache_recovery_run")) return;
      sessionStorage.setItem("safari_cache_recovery_run", "1");
      if (window.caches) {
        caches.keys().then(function (names) {
          names.forEach(function (name) {
            caches.delete(name);
          });
        });
      }
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
          registrations.forEach(function (registration) {
            registration.unregister();
          });
        });
      }
      setTimeout(function () {
        window.location.reload();
      }, 100);
    } catch {
      // Ignore storage errors in restricted private mode.
    }
  });
})();
