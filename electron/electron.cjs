const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;
let backendProcess = null;
let sessionTimeout = null;
let mainWindow = null;

function getBackendPath() {
  if (isDev) {
    // Go up one level from /electron to find /resources
    return path.join(__dirname, "../resources/backend.exe");
  }
  return path.join(process.resourcesPath, "resources", "backend.exe");
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 980,
    webPreferences: {
      // This path is correct because preload.js is in the same folder
      preload: path.join(__dirname, "preload.js"),
    },
    // Go up one level from /electron to find /public
    icon: path.join(__dirname, "../public/icon.ico"),
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // Go up one level from /electron to find /dist
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    mainWindow.setMenu(null);
  }
}

function startBackend() {
  const backendPath = getBackendPath();
  backendProcess = spawn(backendPath);
  backendProcess.stderr.on("data", (data) =>
    console.error(`Backend Error: ${data}`)
  );
}

// Reusable function for Python communication
function executePythonCommand({ action, payload }) {
  return new Promise((resolve, reject) => {
    if (!backendProcess) {
      return reject(new Error("Backend process is not running."));
    }
    const command = JSON.stringify({ action, payload });
    const onData = (data) => {
      try {
        const response = JSON.parse(data.toString());
        backendProcess.stdout.removeListener("data", onData);
        resolve(response);
      } catch (e) {
        backendProcess.stdout.removeListener("data", onData);
        reject(new Error("Invalid JSON response from backend."));
      }
    };
    const onError = (err) => {
      backendProcess.stderr.removeListener("data", onError);
      reject(err);
    };
    backendProcess.stdout.on("data", onData);
    backendProcess.stderr.once("data", onError);
    backendProcess.stdin.write(command + "\n");
  });
}

// IPC Handlers
ipcMain.handle("python:exec", (event, { action, payload }) => {
  return executePythonCommand({ action, payload });
});

ipcMain.handle("start_session", async (event, payload) => {
  const response = await executePythonCommand({
    action: "start_session",
    payload,
  });
  if (response.success) {
    manageSessionTimer(response.end_time_iso);
  }
  return response;
});

// Session Timer Management
async function manageSessionTimer(endTimeIso) {
  if (sessionTimeout) clearTimeout(sessionTimeout);
  const delay = new Date(endTimeIso).getTime() - Date.now();
  if (delay > 0) {
    sessionTimeout = setTimeout(async () => {
      await executePythonCommand({ action: "unblock" });
      if (mainWindow) {
        mainWindow.webContents.send("backend-event", {
          event: "session_ended",
        });
      }
    }, delay);
  }
}

async function checkInitialSession() {
  try {
    const status = await executePythonCommand({ action: "get_status" });
    if (status.success && status.is_blocking) {
      manageSessionTimer(status.end_time_iso);
    }
  } catch (e) {
    console.error("Failed to check initial session status:", e);
  }
}

// App Lifecycle
app.whenReady().then(() => {
  createMainWindow();
  startBackend();
  setTimeout(checkInitialSession, 1000);
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill();
  if (sessionTimeout) clearTimeout(sessionTimeout);
  if (process.platform !== "darwin") app.quit();
});