import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { IslandSceneShell } from "./scene/IslandSceneShell.js";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <IslandSceneShell>
      <App />
    </IslandSceneShell>
  </React.StrictMode>
);
