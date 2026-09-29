import { createContext, useContext } from "react";

export interface SessionControls {
  /**
   * Clears this tab's in-memory answers, results and session credential, then returns to the home page.
   * Nothing is deleted on the server; the UI must say so.
   */
  restart(): void;
}

export const SessionContext = createContext<SessionControls>({ restart: () => undefined });

export const useSession = () => useContext(SessionContext);
