import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

document.documentElement.setAttribute('dir', 'rtl');
document.documentElement.setAttribute('lang', 'ar');

createRoot(document.getElementById("root")!).render(<App />);
