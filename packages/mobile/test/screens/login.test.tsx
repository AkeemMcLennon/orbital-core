import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { authClient } from "../../src/lib/auth-client";
import { renderAppRoute } from "../helpers/render";

const WAIT_OPTIONS = { timeout: 10000 };

const socialSignIn = authClient.signIn.social as jest.Mock;

beforeEach(() => {
  socialSignIn.mockClear();
});

/**
 * Guards the vendor-compliant social sign-in buttons on the login screen.
 *
 * The marks are now <Image>s of Google's and Apple's official artwork rather than Ionicons
 * glyphs (both vendors prohibit redrawn or recolored logos), so there is no icon name left to
 * assert on. These tests pin the accessible labels instead, and check that swapping the
 * presentation didn't disturb the auth calls underneath.
 */
describe("Login Screen social sign-in", () => {
  it("renders both provider buttons with accessible labels", async () => {
    renderAppRoute({ initialUrl: "/login" });

    await waitFor(() => {
      expect(screen.getByLabelText("Continue with Google")).toBeTruthy();
    }, WAIT_OPTIONS);

    expect(screen.getByLabelText("Continue with Apple")).toBeTruthy();
  });

  it("starts Google OAuth when the Google button is pressed", async () => {
    renderAppRoute({ initialUrl: "/login" });

    await waitFor(() => {
      expect(screen.getByLabelText("Continue with Google")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByLabelText("Continue with Google"));

    await waitFor(() => {
      expect(socialSignIn).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/auth-callback",
      });
    }, WAIT_OPTIONS);
  });

  it("starts Apple OAuth when the Apple button is pressed", async () => {
    renderAppRoute({ initialUrl: "/login" });

    await waitFor(() => {
      expect(screen.getByLabelText("Continue with Apple")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByLabelText("Continue with Apple"));

    await waitFor(() => {
      expect(socialSignIn).toHaveBeenCalledWith({
        provider: "apple",
        callbackURL: "/auth-callback",
      });
    }, WAIT_OPTIONS);
  });

  // Apple's HIG asks that the Sign in with Apple button not be less prominent than other
  // sign-in options, so on Apple platforms it leads the list. jest-expo runs as iOS.
  it("puts the Apple button above the Google button on iOS", async () => {
    renderAppRoute({ initialUrl: "/login" });

    await waitFor(() => {
      expect(screen.getByLabelText("Continue with Apple")).toBeTruthy();
    }, WAIT_OPTIONS);

    const labels = screen
      .getAllByRole("button")
      .map((node) => node.props.accessibilityLabel);

    expect(labels.indexOf("Continue with Apple")).toBeLessThan(
      labels.indexOf("Continue with Google"),
    );
  });
});
