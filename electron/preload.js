const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Use a specific handler for starting a session to manage the timer
  execPython: (action, payload = {}) => {
    if (action === "start_session") {
      return ipcRenderer.invoke("start_session", payload);
    }
    return ipcRenderer.invoke("python:exec", { action, payload });
  },
  // Listener for events pushed from the main process (like session ending)
  onBackendEvent: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("backend-event", listener);
    // Return a cleanup function
    return () => ipcRenderer.removeListener("backend-event", listener);
  },
});