import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { initialiseRITheme } from "./lib/riTheme";
import "./index.css";

initialiseRITheme();

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
  const app = (
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );

  createRoot(rootElement).render(app);

  console.log("React app mounted");
} else {
  console.error("Root element not found!");
}
