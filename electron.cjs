const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;
let backendProcess = null;
let sessionTimeout = null;
let mainWindow = null;

function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, "resources", "backend.exe");
  }
  return path.join(process.resourcesPath, "resources", "backend.exe");
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 980, // <-- FIX #1: Increased window height again
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    // <-- FIX #2: Set the window icon
    icon: path.join(__dirname, "icon.ico"),
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
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

// --- FIX #2: REUSABLE FUNCTION for Python communication ---
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

    // Add a one-time error listener for this specific command
    const onError = (err) => {
      backendProcess.stderr.removeListener("data", onError);
      reject(err);
    };

    backendProcess.stdout.on("data", onData);
    backendProcess.stderr.once("data", onError); // Listen for errors too
    backendProcess.stdin.write(command + "\n");
  });
}

// --- UPDATED HANDLERS using the reusable function ---
ipcMain.handle("python:exec", (event, { action, payload }) => {
  return executePythonCommand({ action, payload });
});

ipcMain.handle("start_session", async (event, payload) => {
  // Now we correctly call our reusable function
  const response = await executePythonCommand({
    action: "start_session",
    payload,
  });
  if (response.success) {
    manageSessionTimer(response.end_time_iso);
  }
  return response;
});

// --- Session Timer Management (Unchanged) ---
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