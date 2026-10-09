import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { PwaInstall } from "./pwa-install";

export function SilviaHeader() {
  return (
    <>
      <header className="silvia-header">
        <Link to="/" className="wordmark">
          <Heart size={21} strokeWidth={1.3} />
          <span>
            For Silvia<span className="wordmark-dot">.</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/" activeProps={{ className: "nav-active" }} activeOptions={{ exact: true }}>
            Today’s haiku
          </Link>
          <Link to="/collection" activeProps={{ className: "nav-active" }}>
            Our collection
          </Link>
        </nav>
        <PwaInstall />
      </header>
    </>
  );
}

export function SilviaFooter() {
  return (
    <footer className="silvia-footer">
      <span>A little corner of the world, just for you.</span>
      <span lang="ko">
        언제나 너를 사랑해 <Heart size={12} />
      </span>
    </footer>
  );
}
