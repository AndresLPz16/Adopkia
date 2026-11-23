import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const storage = new Map<string, string>();
const localStorage: Storage = {
  get length() {
    return storage.size;
  },
  clear: () => storage.clear(),
  getItem: (key) => storage.get(key) ?? null,
  key: (index) => Array.from(storage.keys())[index] ?? null,
  removeItem: (key) => {
    storage.delete(key);
  },
  setItem: (key, value) => {
    storage.set(key, String(value));
  },
};

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: localStorage,
});

// jsdom no implementa IntersectionObserver; los navegadores sí. Los
// componentes animados (motion) lo usan para empezar al ser visibles: en las
// pruebas todo cuenta como visible desde el principio.
class VisibleIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [{ target, isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      this,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (typeof window.IntersectionObserver === "undefined") {
  window.IntersectionObserver = VisibleIntersectionObserver;
  globalThis.IntersectionObserver = VisibleIntersectionObserver;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});
