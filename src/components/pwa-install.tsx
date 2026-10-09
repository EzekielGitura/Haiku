import { useEffect, useId, useRef, useState } from "react";
import { Download, Heart, WifiOff, X } from "lucide-react";
import { Button } from "./ui/button";
import { registerPwa, useOnlineStatus } from "@/lib/pwa";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [ios, setIos] = useState(false);
  const controls = useRef<HTMLDivElement>(null);
  const installButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const helpId = useId();
  const online = useOnlineStatus();

  useEffect(() => {
    void registerPwa();
    setInstalled(isInstalled());
    setIos(
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const completed = () => {
      setInstalled(true);
      setPrompt(null);
      setInstructions(false);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", completed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", completed);
    };
  }, []);

  useEffect(() => {
    if (!instructions) return;
    closeButton.current?.focus();
    const dismissOutside = (event: PointerEvent | FocusEvent) => {
      if (event.target instanceof Node && !controls.current?.contains(event.target))
        setInstructions(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setInstructions(false);
        installButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", escape);
    };
  }, [instructions]);

  function closeInstructions() {
    setInstructions(false);
    installButton.current?.focus();
  }

  async function install() {
    if (!prompt) {
      setInstructions((open) => !open);
      return;
    }
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setInstructions(true);
    } finally {
      setPrompt(null);
    }
  }

  return (
    <div className="pwa-controls" ref={controls}>
      {!online && (
        <span className="pwa-offline-status" role="status">
          <WifiOff size={13} /> Offline · saved poems
        </span>
      )}
      {!installed && (
        <Button
          ref={installButton}
          type="button"
          variant="outline"
          className="pwa-install-button"
          onClick={() => void install()}
          aria-expanded={instructions}
          aria-haspopup="dialog"
          aria-controls={instructions ? helpId : undefined}
        >
          <Download size={14} />
          <span>Add to home</span>
        </Button>
      )}
      {instructions && (
        <div
          id={helpId}
          className="pwa-install-help"
          role="dialog"
          aria-labelledby={`${helpId}-title`}
        >
          <button
            ref={closeButton}
            type="button"
            className="pwa-help-close"
            onClick={closeInstructions}
            aria-label="Close install instructions"
          >
            <X size={15} />
          </button>
          <Heart size={17} aria-hidden="true" />
          <h2 id={`${helpId}-title`}>A home for your haikus.</h2>
          <p>
            {ios
              ? "In Safari, tap Share, then Add to Home Screen."
              : "Open your browser menu and choose Install app or Add to Home Screen."}
          </p>
          <p className="pwa-help-note">Your saved poems stay close, even offline.</p>
        </div>
      )}
    </div>
  );
}
