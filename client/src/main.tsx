import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { CapabilityStandaloneApp } from "./capabilityStandaloneApp";
import "./index.css";

console.log("main.tsx executing...");

// Get the root element
const rootElement = document.getElementById("root");
console.log("Root element:", rootElement);

// Hide the loader
const loader = document.getElementById("root-loader");
console.log("Loader element:", loader);
if (loader) {
  loader.remove(); // Remove instead of just hiding
  console.log("Loader removed");
}

if (rootElement) {
  const currentPath = window.location.pathname;
  const isCapabilityRoute =
    currentPath.startsWith("/operational/specialist/capability/") ||
    currentPath === "/operational/specialist/capability-practicals" ||
    currentPath === "/operational/capability-review/practicals" ||
    currentPath === "/operational/capability-review/oral-defense";

  const app = (
    <React.StrictMode>
      <BrowserRouter>
        {isCapabilityRoute ? <CapabilityStandaloneApp /> : <App />}
      </BrowserRouter>
    </React.StrictMode>
  );

  createRoot(rootElement).render(app);

  console.log("React app mounted");
} else {
  console.error("Root element not found!");
}
