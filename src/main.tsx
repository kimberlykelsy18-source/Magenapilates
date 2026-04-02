import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { initDevProtection } from "./app/utils/devprotect";

initDevProtection();

createRoot(document.getElementById("root")!).render(<App />);
