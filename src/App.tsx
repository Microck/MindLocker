import { Header } from "./components/Header";
import { SessionSetup } from "./components/SessionSetup";
import { Controls } from "./components/Controls";
import { useMindLocker } from "./context/MindLockerContext";

function App() {
  const { isLoading, errorMessage, isBackendAdmin } = useMindLocker();

  // The context now handles the initial loading state.
  // We can show a single, simple loading indicator here.
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-light-bg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary-purple">
            MindLocker
          </h1>
          <p className="mt-2 animate-pulse-slow text-lg text-gray-600">
            Initializing...
          </p>
        </div>
      </div>
    );
  }

  // The context also handles major errors, like the backend not being an admin.
  if (isBackendAdmin === false) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-light-bg">
        <div className="max-w-md rounded-lg bg-red-100 p-8 text-center shadow-md">
          <h1 className="text-2xl font-bold text-red-700">
            Administrator Rights Required
          </h1>
          <p className="mt-2 text-red-600">
            MindLocker needs to be run as an administrator to modify system
            files.
          </p>
          <p className="mt-4 text-sm text-gray-600">
            Please close the application and run it again as an administrator.
          </p>
          {errorMessage && (
            <p className="mt-2 text-xs text-gray-500">Details: {errorMessage}</p>
          )}
        </div>
      </div>
    );
  }

  // If loading is complete and we have admin rights, render the main app.
  return (
    <div className="min-h-screen bg-light-bg font-sans text-gray-800">
      <main className="mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
        <Header />
        <div className="mt-8 space-y-6">
          <SessionSetup />
          <Controls />
        </div>
      </main>
    </div>
  );
}

export default App;