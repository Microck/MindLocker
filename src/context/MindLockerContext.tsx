import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { siteCategories as initialSiteCategories } from "../utils/constants";

// Define the shape of the API exposed by preload.js
// This is the new, more robust API
declare global {
  interface Window {
    api: {
      execPython: (
        action: string,
        payload?: any
      ) => Promise<{ success: boolean; [key: string]: any }>;
      onBackendEvent: (
        callback: (event: { event: string; data?: any }) => void
      ) => () => void;
    };
  }
}

type DurationOption = "15" | "30" | "60" | "120" | "custom";

interface Site {
  id: string;
  name: string;
  checked: boolean;
}

interface SiteCategory {
  id: string;
  name: string;
  sites: Site[];
}

interface MindLockerContextType {
  duration: DurationOption;
  setDuration: (duration: DurationOption) => void;
  customDuration: string;
  setCustomDuration: (value: string) => void;
  siteCategories: SiteCategory[];
  toggleSite: (categoryId: string, siteId: string) => void;
  isSessionActive: boolean;
  startSession: () => Promise<void>; // Now async
  timeRemainingFormatted: string;
  sessionStatusMessage: string;
  isLoading: boolean;
  isBackendAdmin: boolean | null;
  errorMessage: string | null;
}

const MindLockerContext = createContext<MindLockerContextType | undefined>(
  undefined
);

export const MindLockerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // --- STATE ---
  const [duration, setDuration] = useState<DurationOption>("15");
  const [customDuration, setCustomDuration] = useState("10");
  const [categories, setCategories] =
    useState<SiteCategory[]>(initialSiteCategories);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [endTimeISO, setEndTimeISO] = useState<string | null>(null);
  const [timeRemainingFormatted, setTimeRemainingFormatted] = useState("00:00");
  const [sessionStatusMessage, setSessionStatusMessage] = useState(
    "Checking backend status..."
  );
  const [isLoading, setIsLoading] = useState(true); // Start loading
  const [isBackendAdmin, setIsBackendAdmin] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uiTimer, setUiTimer] = useState<number | null>(null);

  // --- HELPER FUNCTIONS ---
  const clearError = () => setErrorMessage(null);

  const updateSessionState = (
    active: boolean,
    endTime: string | null,
    message: string
  ) => {
    setIsSessionActive(active);
    setEndTimeISO(endTime);
    setSessionStatusMessage(message);
    if (!active) {
      setTimeRemainingFormatted("00:00");
    }
  };

  // --- EFFECTS ---

  // 1. Check initial backend status when the app loads
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        // First, check for admin rights
        const adminCheck = await window.api.execPython("admin_check");
        setIsBackendAdmin(adminCheck.success && adminCheck.is_admin);

        if (!adminCheck.is_admin) {
          throw new Error("Backend not running with admin privileges.");
        }

        // Then, get the current session status from the backend
        const status = await window.api.execPython("get_status");
        if (status.success) {
          if (status.is_blocking) {
            updateSessionState(
              true,
              status.end_time_iso,
              "MindLock Active!"
            );
          } else {
            updateSessionState(false, null, "Ready to lock in your focus.");
          }
        } else {
          throw new Error(status.error || "Failed to get status.");
        }
      } catch (error: any) {
        setErrorMessage(error.message);
        updateSessionState(false, null, "Error connecting to backend.");
      } finally {
        setIsLoading(false);
      }
    };
    checkInitialStatus();
  }, []);

  // 2. Listen for events pushed from the backend (e.g., session ending)
  useEffect(() => {
    const cleanup = window.api.onBackendEvent((event) => {
      if (event.event === "session_ended") {
        updateSessionState(
          false,
          null,
          "Session complete. Sites unblocked!"
        );
      }
    });
    return cleanup; // Cleanup the listener on unmount
  }, []);

  // 3. Manage the UI countdown timer
  useEffect(() => {
    if (uiTimer) clearInterval(uiTimer);

    if (isSessionActive && endTimeISO) {
      const intervalId = setInterval(() => {
        const diffSeconds = Math.round(
          (new Date(endTimeISO).getTime() - Date.now()) / 1000
        );

        if (diffSeconds <= 0) {
          setTimeRemainingFormatted("00:00");
          // No need to update state here, the backend event will handle it
          clearInterval(intervalId);
          return;
        }

        const hours = Math.floor(diffSeconds / 3600);
        const minutes = Math.floor((diffSeconds % 3600) / 60);
        const seconds = diffSeconds % 60;
        let timeString = `${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`;
        if (hours > 0) {
          timeString = `${hours.toString().padStart(2, "0")}:${timeString}`;
        }
        setTimeRemainingFormatted(timeString);
      }, 1000);
      setUiTimer(intervalId as unknown as number);
    }

    return () => {
      if (uiTimer) clearInterval(uiTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionActive, endTimeISO]);

  // --- USER ACTIONS ---

  const toggleSite = (categoryId: string, siteId: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              sites: cat.sites.map((site) =>
                site.id === siteId
                  ? { ...site, checked: !site.checked }
                  : site
              ),
            }
          : cat
      )
    );
  };

  const startSession = async () => {
    setIsLoading(true);
    clearError();

    const siteKeysToBlock = categories
      .flatMap((cat) => cat.sites)
      .filter((site) => site.checked)
      .map((site) => site.name);

    if (siteKeysToBlock.length === 0) {
      setErrorMessage("No sites selected to block.");
      setIsLoading(false);
      return;
    }

    const durationMinutes =
      duration === "custom" ? parseInt(customDuration) || 10 : parseInt(duration);

    try {
      const response = await window.api.execPython("start_session", {
        duration_minutes: durationMinutes,
        site_keys_to_block: siteKeysToBlock,
      });

      if (response.success) {
        updateSessionState(true, response.end_time_iso, "MindLock Active!");
      } else {
        throw new Error(response.error || "Failed to start session.");
      }
    } catch (error: any) {
      setErrorMessage(error.message);
      updateSessionState(false, null, "Failed to start session.");
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    duration,
    setDuration,
    customDuration,
    setCustomDuration,
    siteCategories: categories,
    toggleSite,
    isSessionActive,
    startSession,
    timeRemainingFormatted,
    sessionStatusMessage,
    isLoading,
    isBackendAdmin,
    errorMessage,
  };

  return (
    <MindLockerContext.Provider value={value}>
      {children}
    </MindLockerContext.Provider>
  );
};

export const useMindLocker = () => {
  const context = useContext(MindLockerContext);
  if (context === undefined) {
    throw new Error("useMindLocker must be used within a MindLockerProvider");
  }
  return context;
};