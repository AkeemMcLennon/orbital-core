import { initializeApiClient } from "@orbital/client";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { renderAppRoute } from "../helpers/render";
import { getServerInfo } from "../helpers/server";

const WAIT_OPTIONS = { timeout: 10000 };

beforeAll(() => {
  const { url, token } = getServerInfo();
  initializeApiClient({
    baseURL: `${url}/rpc`,
    getToken: () => token,
  });
});

describe("Onboarding Screen", () => {
  it("renders the intro carousel on the /onboarding route", async () => {
    renderAppRoute({ initialUrl: "/onboarding" });

    expect(screen).toHavePathname("/onboarding");
    expect(screen.getByText("Welcome to Orbital")).toBeTruthy();
    expect(screen.getByText("Skip")).toBeTruthy();
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("first-run completion replaces to the dashboard", async () => {
    renderAppRoute({ initialUrl: "/onboarding" });

    // Skip calls the same done handler as Get started.
    fireEvent.press(screen.getByText("Skip"));

    await waitFor(() => {
      expect(screen).toHavePathname("/");
    }, WAIT_OPTIONS);
  });

  it("replay from Settings pushes /onboarding and pops back to Settings", async () => {
    renderAppRoute({ initialUrl: "/settings" });

    await waitFor(() => {
      expect(screen.getByText("Replay Intro Tour")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText("Replay Intro Tour"));

    await waitFor(() => {
      expect(screen).toHavePathname("/onboarding");
      expect(screen.getByText("Welcome to Orbital")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText("Skip"));

    await waitFor(() => {
      expect(screen).toHavePathname("/settings");
    }, WAIT_OPTIONS);
  });
});
