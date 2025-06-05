import React from "react";
import { useMindLocker } from "../context/MindLockerContext";
import { Clock, AlertTriangle } from "lucide-react";

export const Controls: React.FC = () => {
  const {
    isSessionActive,
    startSession,
    sessionStatusMessage,
    timeRemainingFormatted,
    isLoading,
    isBackendAdmin, // Use this new state
    errorMessage,
  } = useMindLocker();

  const handleStartSession = () => {
    if (isLoading || isSessionActive || !isBackendAdmin) return;
    startSession(); // No longer needs await here, context handles it
  };

  const getButtonText = () => {
    if (isLoading) return "Processing...";
    if (isSessionActive) return "Session Active";
    if (isBackendAdmin === false) return "Admin Rights Required";
    return "Start MindLock Session";
  };

  return (
    <div className="mt-4 rounded-lg bg-light-purple p-6 shadow-sm">
      <div className="flex flex-col items-center">
        <button
          onClick={handleStartSession}
          disabled={isSessionActive || isLoading || isBackendAdmin === false}
          className={`
            flex w-full max-w-xs items-center justify-center rounded-lg py-3 px-6
            font-medium text-white shadow-sm transition-all duration-200
            ${
              isSessionActive || isLoading || isBackendAdmin === false
                ? "cursor-not-allowed bg-gray-400"
                : "transform bg-primary-purple hover:-translate-y-0.5 hover:bg-primary-purple/90 active:translate-y-0"
            }
          `}
        >
          {getButtonText()}
        </button>

        <div className="mt-6 min-h-[40px] text-center">
          {errorMessage && (
            <div className="mb-2 flex items-center justify-center space-x-2 text-red-600">
              <AlertTriangle size={20} />
              <span>{errorMessage}</span>
            </div>
          )}
          {isSessionActive ? (
            <div className="flex items-center justify-center space-x-2 text-primary-purple">
              <Clock size={20} className="mr-1" />
              <span className="text-lg font-bold">
                {timeRemainingFormatted}
              </span>
            </div>
          ) : (
            !errorMessage && (
              <div className="text-gray-700">{sessionStatusMessage}</div>
            )
          )}
        </div>
      </div>
    </div>
  );
};