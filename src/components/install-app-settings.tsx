"use client";

import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppSettings() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches);

  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const complete = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }

  return <details className="settings-disclosure card"><summary><span><Smartphone size={19} /></span><span><strong>Install SPND</strong><small>{installed ? "Installed on this device" : "Add SPND to your home screen"}</small></span></summary><div className="install-app-copy">{installed ? <p>SPND is running as an installed app.</p> : <><p><strong>iPhone or iPad:</strong> open SPND in Safari, tap Share, then Add to Home Screen.</p><p><strong>Android or desktop:</strong> use Install app in the browser menu.</p>{prompt ? <button className="primary-button install-app-button" type="button" onClick={() => void install()}><Download size={18} /> Install now</button> : null}</>}</div></details>;
}
